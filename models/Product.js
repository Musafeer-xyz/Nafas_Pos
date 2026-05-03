const mongoose = require('mongoose');

const branchStockSchema = new mongoose.Schema({
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
  qty: { type: Number, default: 0 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, enum: ['Attar', 'Apparel', 'Gadget'], default: 'Attar' },
  grade: { type: String, enum: ['A', 'B', 'C', ''], default: '' },
  stock: { type: Number, default: 0 },
  purchaseRate: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  unit: { type: String, default: 'ml' },
  lowStockAlert: { type: Number, default: 10 },
  lotInfo: {
    lotName: String,
    purchaseDate: Date,
    perMLCost: Number,
  },
  notes: { type: String, default: '' },
  tanjimStock: { type: Number, default: 0 }, // kept for migration
  branchStock: [branchStockSchema],           // dynamic branch stock
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);