const mongoose = require('mongoose');

const SF_SALE_STATUS = ['active', 'returned', 'voided'];

const sfSaleSchema = new mongoose.Schema({
  serial: { type: String, unique: true }, // e.g. SF-2026-0001
  pid: { type: String, required: true, uppercase: true, trim: true },
  qty: { type: Number, required: true, min: 1 }, // pieces; integers for apparel
  price: { type: Number, required: true, min: 0 }, // per piece, as sold (editable override)
  unitCost: { type: Number, required: true, min: 0 }, // snapshot of product unit cost at sale time
  customerName: { type: String, default: 'Walk-in', trim: true, maxlength: 80 },
  customerPhone: { type: String, default: '', trim: true, maxlength: 20 },
  seller: { type: String, required: true, trim: true, maxlength: 80 },
  sellerUserId: { type: String, default: '' }, // JWT sub when the seller is a logged-in user
  date: { type: Date, required: true },
  status: { type: String, enum: SF_SALE_STATUS, default: 'active' },
  note: { type: String, default: '', trim: true, maxlength: 300 },
  statusChangedBy: { type: String, default: '' },
  statusChangedAt: { type: Date, default: null },
}, { timestamps: true });

sfSaleSchema.index({ pid: 1, status: 1 });
sfSaleSchema.index({ seller: 1, date: -1 });
sfSaleSchema.index({ date: -1 });

// Only these statuses count against stock
sfSaleSchema.statics.STOCK_COUNTING_STATUSES = ['active'];

module.exports = mongoose.models.SfSale || mongoose.model('SfSale', sfSaleSchema);
