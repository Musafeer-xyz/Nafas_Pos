const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'No token, access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const can = (permission) => (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.permissions?.[permission]) return next();
  return res.status(403).json({ message: `Permission denied: ${permission}` });
};

module.exports = { auth, adminOnly, can };