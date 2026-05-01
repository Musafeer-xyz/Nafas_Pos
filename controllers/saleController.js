const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Combo = require('../models/Combo');
const mongoose = require('mongoose');

// POST: Record a new sale (handles products + combos, deducts stock)
exports.create = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerName, customerPhone, items, extraCosts, channel, notes, store } = req.body;
    const soldBy = req.user.role === 'admin' ? 'Admin' : 'Assistant';
    const isTanjim = store === 'tanjim';

    let totalRevenue = 0;
    const processedItems = [];

    for (const item of items) {
      if (item.itemType === 'Product') {
        const product = await Product.findById(item.itemId).session(session);
        if (!product) throw new Error(`Product not found: ${item.itemId}`);

        if (isTanjim) {
          // Tanjim sale: deduct from tanjimStock only
          if ((product.tanjimStock || 0) < item.qty) {
            throw new Error(`Tanjim has insufficient stock for "${product.name}". Available: ${product.tanjimStock || 0}${product.unit}`);
          }
          product.tanjimStock -= item.qty;
        } else {
          // Siam sale: deduct from main stock
          if (product.stock < item.qty) {
            throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock}${product.unit}`);
          }
          product.stock -= item.qty;
        }
        await product.save({ session });

        const unitPrice = item.overridePrice ?? product.sellingPrice;
        totalRevenue += unitPrice * item.qty;

        processedItems.push({
          itemId: product._id,
          itemType: 'Product',
          name: product.name,
          qty: item.qty,
          unitPrice,
          originalPrice: product.sellingPrice,
          isOverridden: item.overridePrice != null && item.overridePrice !== product.sellingPrice
        });

      } else if (item.itemType === 'Combo') {
        const combo = await Combo.findById(item.itemId).populate('products.productId').session(session);
        if (!combo) throw new Error(`Combo not found: ${item.itemId}`);

        // Check stock for ALL products first
        for (const cp of combo.products) {
          const needed = cp.quantity * item.qty;
          const available = isTanjim ? (cp.productId.tanjimStock || 0) : cp.productId.stock;
          if (available < needed) {
            const store = isTanjim ? 'Tanjim' : 'main';
            throw new Error(`Insufficient ${store} stock for "${cp.productId.name}" in combo "${combo.name}". Available: ${available}${cp.productId.unit}, needed: ${needed}`);
          }
        }

        // Deduct stock for each product in combo
        for (const cp of combo.products) {
          const needed = cp.quantity * item.qty;
          const update = isTanjim
            ? { $inc: { tanjimStock: -needed } }
            : { $inc: { stock: -needed } };
          await Product.findByIdAndUpdate(cp.productId._id, update, { session });
        }

        const unitPrice = item.overridePrice ?? combo.comboPrice;
        totalRevenue += unitPrice * item.qty;

        processedItems.push({
          itemId: combo._id,
          itemType: 'Combo',
          name: combo.name,
          qty: item.qty,
          unitPrice,
          originalPrice: combo.comboPrice,
          isOverridden: item.overridePrice != null && item.overridePrice !== combo.comboPrice
        });
      }
    }

    const sale = new Sale({
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || '',
      items: processedItems,
      totalRevenue,
      extraCosts: extraCosts || {},
      soldBy,
      store: store || 'siam',
      channel: channel || 'Direct',
      notes: notes || ''
    });

    await sale.save({ session });
    await session.commitTransaction();
    res.status(201).json(sale);

  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET all sales (admin only - full view)
exports.getAll = async (req, res) => {
  try {
    const { from, to, soldBy, channel } = req.query;
    let filter = {};

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.date.$lte = toDate;
      }
    }
    if (soldBy) filter.soldBy = soldBy;
    if (channel) filter.channel = channel;

    const sales = await Sale.find(filter).sort({ date: -1 }).limit(200);
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single sale
exports.getOne = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE a sale (admin only - also restores stock)
exports.remove = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const isTanjim = sale.store === 'tanjim';

    // Restore correct stock field
    for (const item of sale.items) {
      if (item.itemType === 'Product') {
        const update = isTanjim
          ? { $inc: { tanjimStock: item.qty } }
          : { $inc: { stock: item.qty } };
        await Product.findByIdAndUpdate(item.itemId, update, { session });
      } else if (item.itemType === 'Combo') {
        const combo = await Combo.findById(item.itemId).populate('products.productId').session(session);
        if (combo) {
          for (const cp of combo.products) {
            const update = isTanjim
              ? { $inc: { tanjimStock: cp.quantity * item.qty } }
              : { $inc: { stock: cp.quantity * item.qty } };
            await Product.findByIdAndUpdate(cp.productId._id, update, { session });
          }
        }
      }
    }

    await Sale.findByIdAndDelete(req.params.id, { session });
    await session.commitTransaction();
    res.json({ message: 'Sale deleted and stock restored' });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// POST: Historical import - saves the sale record WITHOUT touching current stock
exports.importHistorical = async (req, res) => {
  try {
    const { customerName, items, date, notes } = req.body;

    // Build processed items without touching stock
    const processedItems = (items || []).map(item => ({
      itemId: item.itemId,
      itemType: item.itemType || 'Product',
      name: item.name || 'Imported Product',
      qty: item.qty,
      unitPrice: item.overridePrice || 0,
      originalPrice: item.overridePrice || 0,
      isOverridden: false
    }));

    const totalRevenue = processedItems.reduce((s, i) => s + (i.qty * i.unitPrice), 0);

    const sale = new Sale({
      customerName: customerName || 'Historical',
      items: processedItems,
      totalRevenue,
      extraCosts: {},
      soldBy: 'Admin',
      notes: notes || 'Historical import',
      date: date ? new Date(date) : new Date()
    });

    await sale.save();
    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
