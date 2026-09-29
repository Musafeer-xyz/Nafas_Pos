const mongoose = require('mongoose');

const SF_MASTER_TYPES = ['type', 'color', 'design', 'size'];

const sfMasterSchema = new mongoose.Schema({
  kind: { type: String, enum: SF_MASTER_TYPES, required: true },
  value: { type: String, required: true, trim: true, uppercase: true, maxlength: 40 },
  isActive: { type: Boolean, default: true },
  note: { type: String, default: '', trim: true, maxlength: 200 },
}, { timestamps: true });

// One "BLACK" per kind; "M" under size is separate from "M" under color
sfMasterSchema.index({ kind: 1, value: 1 }, { unique: true });

sfMasterSchema.statics.TYPES = SF_MASTER_TYPES;

module.exports = mongoose.models.SfMaster || mongoose.model('SfMaster', sfMasterSchema);
