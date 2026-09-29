const mongoose = require('mongoose');

const sfProductSchema = new mongoose.Schema({
  pid: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, required: true, uppercase: true, trim: true },
  color: { type: String, required: true, uppercase: true, trim: true },
  design: { type: String, required: true, uppercase: true, trim: true },
  size: { type: String, required: true, uppercase: true, trim: true },
  unitCost: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, default: 0, min: 0 },
  lowStockThreshold: { type: Number, default: 5, min: 0 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: '', trim: true },
}, { timestamps: true });

// Human-readable label, e.g. "BLACK / ABC · M"
sfProductSchema.virtual('label').get(function () {
  return `${this.color} / ${this.design} · ${this.size}`;
});

sfProductSchema.set('toJSON', { virtuals: true });
sfProductSchema.set('toObject', { virtuals: true });

// Canonical PID builder: Type-Color-Design-Size (uppercased, hyphen-joined)
sfProductSchema.statics.buildPid = (type, color, design, size) =>
  [type, color, design, size].map(p => String(p || '').trim().toUpperCase()).join('-');

// Loose shape check: four non-empty segments. Real validity = master-list membership.
sfProductSchema.statics.PID_RE = /^[A-Z0-9][A-Z0-9& ._'-]*(-[A-Z0-9& ._'-]*){3}$/;

module.exports = mongoose.models.SfProduct || mongoose.model('SfProduct', sfProductSchema);
