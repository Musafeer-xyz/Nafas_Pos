require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB Connection — only when run directly (tests connect their own DB)
if (require.main === module) {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Error:', err));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/branches', require('./routes/branches'));
app.use('/api/products', require('./routes/products'));
app.use('/api/combos', require('./routes/combos'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/costs', require('./routes/costs'));
app.use('/api/dashboard', require('./routes/dashboard'));

// SOLID FLEX module (additive, namespaced — safe to remove for rollback)
app.use('/api/solidflex', require('./routes/solidflex'));

// Liveness probe — cheap, unauthenticated, DB-independent (leaks no data,
// never 500s on DB trouble). Used by uptime monitors and the keep-alive
// pinger below. Must stay registered BEFORE the catch-all route.
app.get('/healthz', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Listen only when run directly; exported for integration tests
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 NAFAS Server running on port ${PORT}`));

  // Keep-alive: ping ourselves periodically so free hosts (e.g. Render free
  // tier) don't spin the service down after 15 idle minutes. Opt-in via env:
  //   KEEP_ALIVE=true                                  → ping own /healthz
  //   KEEP_ALIVE_URL=https://nafas-pos.onrender.com/healthz  → ping any URL
  const keepAliveUrl = process.env.KEEP_ALIVE_URL
    || (process.env.KEEP_ALIVE === 'true' ? `http://127.0.0.1:${PORT}/healthz` : null);
  if (keepAliveUrl) {
    const minutes = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES) || 10;
    let inFlight = false;
    const ping = async () => {
      if (inFlight) return; // never stack pings if one hangs
      inFlight = true;
      try {
        const res = await fetch(keepAliveUrl);
        if (!res.ok) console.warn(`⚠️ Keep-alive ping got HTTP ${res.status}`);
      } catch (err) {
        console.warn(`⚠️ Keep-alive ping failed: ${err.message}`);
      } finally {
        inFlight = false;
      }
    };
    setInterval(ping, minutes * 60 * 1000).unref(); // never blocks process exit
    console.log(`💓 Keep-alive pinging ${keepAliveUrl} every ${minutes} min`);
  }
}

module.exports = app;