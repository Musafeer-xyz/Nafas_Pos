const mongoose = require('mongoose');

const sfAuditLogSchema = new mongoose.Schema({
  // Who — free-form name plus optional user id; works for admin + custom users + imports
  user: { type: String, required: true, trim: true },
  userId: { type: String, default: '' },
  role: { type: String, default: '' },

  action: { type: String, required: true, trim: true },
  // Examples: sf_product.create, sf_sale.create, sf_sale.void,
  // sf_master.update, sf_shipment.create, sf_shipment.void, sf_expense.create, sf_import.commit

  entity: { type: String, required: true, trim: true }, // e.g. 'SfSale', 'SfProduct'
  entityId: { type: String, default: '' },              // doc id or pid/serial
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
  ip: { type: String, default: '' },
}, { timestamps: true });

sfAuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
sfAuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.models.SfAuditLog || mongoose.model('SfAuditLog', sfAuditLogSchema);
