const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

router.post('/login', async (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ message: 'PIN required' });

  if (pin === process.env.ADMIN_PIN) {
    const token = jwt.sign(
      { role: 'admin', name: 'Tanjim', permissions: null },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({ token, role: 'admin', name: 'Tanjim', permissions: null });
  }

  try {
    const user = await User.findOne({ pin, isActive: true });
    if (!user) return res.status(401).json({ message: 'Invalid PIN' });

    const token = jwt.sign(
      { role: 'custom', userId: user._id, name: user.name, permissions: user.permissions },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.json({
      token,
      role: 'custom',
      name: user.name,
      permissions: user.permissions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;