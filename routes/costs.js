const express = require('express');
const router = express.Router();
const ExtraCost = require('../models/ExtraCost');
const { auth, adminOnly } = require('../middleware/auth');

// GET all costs
router.get('/', auth, adminOnly, async (req, res) => {
  try {
    const costs = await ExtraCost.find().sort({ date: -1 });
    res.json(costs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create cost
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const cost = new ExtraCost(req.body);
    await cost.save();
    res.status(201).json(cost);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE cost
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await ExtraCost.findByIdAndDelete(req.params.id);
    res.json({ message: 'Cost deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
