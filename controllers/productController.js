const Product = require('../models/Product');

// GET all products
exports.getAll = async (req, res) => {
  try {
    const { category, lowStock } = req.query;
    let filter = { isActive: true };
    if (category) filter.category = category;
    if (lowStock === 'true') filter.$expr = { $lte: ['$stock', '$lowStockAlert'] };
    
    const products = await Product.find(filter).sort({ name: 1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single product
exports.getOne = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST create product
exports.create = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT update product
exports.update = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH adjust stock manually
exports.adjustStock = async (req, res) => {
  try {
    const { amount, reason } = req.body; // amount can be + or -
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    product.stock += Number(amount);
    if (product.stock < 0) product.stock = 0;
    await product.save();
    res.json({ message: `Stock adjusted by ${amount}`, newStock: product.stock });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE (soft delete)
exports.remove = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Product removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
