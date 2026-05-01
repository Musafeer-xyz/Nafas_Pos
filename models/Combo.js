const mongoose = require('mongoose');

const comboSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  products: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, default: 3.5 } // ml or pieces
  }],
  comboPrice: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  notes: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Combo', comboSchema);
