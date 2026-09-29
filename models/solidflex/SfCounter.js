const mongoose = require('mongoose');

// Shared counters (used for sale serials: SF-<year>-<seq>). Idempotent-friendly.
const sfCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. 'sf_sale_serial_2026'
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.models.SfCounter || mongoose.model('SfCounter', sfCounterSchema);
