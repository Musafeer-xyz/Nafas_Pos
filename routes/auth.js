const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// PIN-based login
router.post('/login', (req, res) => {
  const { pin } = req.body;
  
  let role = null;
  if (pin === process.env.ADMIN_PIN) role = 'admin';
  else if (pin === process.env.ASSISTANT_PIN) role = 'assistant';
  
  if (!role) return res.status(401).json({ message: 'Invalid PIN' });

  const token = jwt.sign({ role }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, role });
});

module.exports = router;
