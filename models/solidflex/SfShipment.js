const mongoose = require('mongoose');

// Stock IN for a PID. Stock is derived from these — never stored as a bare number.
const sfShipmentSchema = new mongoose.Schema({
  pid: { type: String, required: true, uppercase: true, trim: true },
  qty: { type: Number, required: true, min: 0.5 },
  note: { type: String, default: '', trim: true, maxlength: 300 },
  receivedBy: { type: String, default: '', trim: true },
  date: { type: Date, required: true },
  voided: { type: Boolean, default: false },
  voidedBy: { type: String, default: '' },
}, { timestamps: true });

sfShipmentSchema.index({ pid: 1, date: -1 });
sfShipmentSchema.index({ voided: 1 });

module.exports = mongoose.models.SfShipment || mongoose.model('SfShipment', sfShipmentSchema);
