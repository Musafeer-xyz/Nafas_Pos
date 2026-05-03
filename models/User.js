const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    pin: { type: String, required: true },
    role: { type: String, default: 'custom' },
    isActive: { type: Boolean, default: true },
    assignedBranch: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    permissions: {
        viewDashboard: { type: Boolean, default: false },
        viewStock: { type: Boolean, default: true },
        viewHistory: { type: Boolean, default: false },
        sellMain: { type: Boolean, default: false },
        sellBranch: { type: Boolean, default: true },
        addProducts: { type: Boolean, default: false },
        manageCosts: { type: Boolean, default: false },
        transferStock: { type: Boolean, default: false },
        deleteSales: { type: Boolean, default: false },
    }
}, { timestamps: true });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);