const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, adminOnly } = require('../middleware/auth');

// GET all users (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await User.find({}, '-pin').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create user (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const { name, pin, permissions } = req.body;
        if (!name || !pin) return res.status(400).json({ message: 'Name and PIN required' });
        if (pin === process.env.ADMIN_PIN) return res.status(400).json({ message: 'PIN already in use' });

        const existing = await User.findOne({ pin });
        if (existing) return res.status(400).json({ message: 'PIN already in use by another user' });

        const user = new User({ name, pin, permissions });
        await user.save();
        res.status(201).json({ ...user.toObject(), pin: undefined });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT update user permissions (admin only)
router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const { name, pin, permissions, isActive } = req.body;
        if (pin === process.env.ADMIN_PIN) return res.status(400).json({ message: 'PIN already in use' });

        // Check PIN not used by another user
        if (pin) {
            const existing = await User.findOne({ pin, _id: { $ne: req.params.id } });
            if (existing) return res.status(400).json({ message: 'PIN already in use by another user' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { name, pin, permissions, isActive },
            { new: true }
        );
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ ...user.toObject(), pin: undefined });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE user (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;