const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    pin: { type: String, required: true }, // 4-digit PIN
    role: { type: String, default: 'custom' }, // 'admin' or 'custom'
    isActive: { type: Boolean, default: true },
    permissions: {
        viewDashboard: { type: Boolean, default: false },
        viewStock: { type: Boolean, default: true },
        viewHistory: { type: Boolean, default: false },
        sellSiam: { type: Boolean, default: true },
        sellTanjim: { type: Boolean, default: false },
        addProducts: { type: Boolean, default: false },
        manageCosts: { type: Boolean, default: false },
        giveStockTanjim: { type: Boolean, default: false },
        deleteSales: { type: Boolean, default: false },
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);