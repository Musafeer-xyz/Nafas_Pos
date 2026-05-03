const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  customerName: { type: String, default: 'Walk-in' },
  customerPhone: { type: String, default: '' },
  items: [{
    itemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    itemType: { type: String, enum: ['Product', 'Combo'], required: true },
    name: { type: String },          // snapshot name
    qty: { type: Number, required: true },
    unitPrice: { type: Number, required: true },  // actual sold price (may be overridden)
    originalPrice: { type: Number }, // original DB price for reference
    isOverridden: { type: Boolean, default: false }
  }],
  totalRevenue: { type: Number, required: true },
  extraCosts: {
    packaging: { type: Number, default: 0 },
    delivery: { type: Number, default: 0 },
    others: { type: Number, default: 0 },
    otherNote: { type: String, default: '' }
  },
  netProfit: { type: Number }, // calculated: totalRevenue - extraCosts
  soldBy: { type: String, default: 'Admin' },
  store: { type: String, enum: ['siam', 'tanjim'], default: 'siam' }, // which branch
  channel: { type: String, enum: ['Direct', 'Facebook', 'WhatsApp', 'Other'], default: 'Direct' },
  notes: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

// Auto-calculate netProfit before save
saleSchema.pre('save', function (next) {
  const costs = this.extraCosts;
  const totalCosts = (costs.packaging || 0) + (costs.delivery || 0) + (costs.others || 0);
  this.netProfit = this.totalRevenue - totalCosts;
  next();
});

module.exports = mongoose.model('Sale', saleSchema);

module.exports = mongoose.model('Sale', saleSchema);
