const Combo = require('../models/Combo');

exports.getAll = async (req, res) => {
  try {
    const combos = await Combo.find({ isActive: true }).populate('products.productId', 'name stock unit');
    res.json(combos);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const combo = await Combo.findById(req.params.id).populate('products.productId');
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    res.json(combo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const combo = new Combo(req.body);
    await combo.save();
    res.status(201).json(combo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const combo = await Combo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!combo) return res.status(404).json({ message: 'Combo not found' });
    res.json(combo);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await Combo.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Combo removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
