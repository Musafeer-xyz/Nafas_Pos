const jwt = require('jsonwebtoken');

// টোকেন চেক করার ফাংশন
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { role: 'admin' বা 'assistant' }
    next();
  } catch (error) {
    res.status(401).json({ message: 'Authentication required' });
  }
};

// শুধুমাত্র এডমিনদের জন্য ফাংশন
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

module.exports = { auth, adminOnly };