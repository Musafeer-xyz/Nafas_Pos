const mongoose = require('mongoose');

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  location: { type: String, default: '' },
  notes: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  createdBy: { type: String, default: 'Admin' }
}, { timestamps: true });

module.exports = mongoose.models.Branch || mongoose.model('Branch', branchSchema);
