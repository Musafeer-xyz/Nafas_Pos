const mongoose = require('mongoose');

const extraCostSchema = new mongoose.Schema({
  name: { type: String, required: true },     // e.g. "Raw material", "Printer", "Sticker Paper"
  amount: { type: Number, required: true },
  category: {
    type: String,
    enum: ['Raw', 'Packaging', 'Equipment', 'Food', 'Marketing', 'Other'],
    default: 'Other'
  },
  paidStatus: { type: String, enum: ['Paid', 'Due', 'Partial'], default: 'Paid' },
  dueAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.ExtraCost || mongoose.model('ExtraCost', extraCostSchema);
