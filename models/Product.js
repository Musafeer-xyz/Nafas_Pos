const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Attar', 'Apparel', 'Gadget'], default: 'Attar' },
  grade: { type: String, enum: ['A', 'B', 'C', ''], default: '' },
  stock: { type: Number, default: 0 },       // ml for Attar, pieces for others
  purchaseRate: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  unit: { type: String, default: 'ml' },     // 'ml' or 'piece'
  lowStockAlert: { type: Number, default: 10 },
  lotInfo: {
    lotName: String,      // e.g. "1st LOT", "2nd LOT"
    purchaseDate: Date,
    perMLCost: Number,    // calculated cost per ml
  },
  notes: { type: String, default: '' },
  tanjimStock: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
