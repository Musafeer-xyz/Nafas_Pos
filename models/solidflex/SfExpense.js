const mongoose = require('mongoose');

const SF_EXPENSE_SCOPES = ['per_pid', 'overhead'];

const SF_EXPENSE_CATEGORIES = [
  'Shipping', 'Ads', 'Rent', 'Utilities', 'Salary', 'Packaging',
  'Photoshoot', 'Maintenance', 'Other',
];

const sfExpenseSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  category: { type: String, enum: SF_EXPENSE_CATEGORIES, default: 'Other', trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  scope: { type: String, enum: SF_EXPENSE_SCOPES, required: true },
  pid: {
    type: String, uppercase: true, trim: true, default: null,
    validate: {
      validator(v) { return this.scope === 'per_pid' ? !!v : true; },
      message: 'per_pid expense requires a PID',
    },
  },
  note: { type: String, default: '', trim: true, maxlength: 300 },
  recordedBy: { type: String, default: '', trim: true },
  voided: { type: Boolean, default: false },
  voidedBy: { type: String, default: '' },
}, { timestamps: true });

sfExpenseSchema.index({ scope: 1, pid: 1, date: -1 });
sfExpenseSchema.index({ date: -1 });

sfExpenseSchema.statics.CATEGORIES = SF_EXPENSE_CATEGORIES;

module.exports = mongoose.models.SfExpense || mongoose.model('SfExpense', sfExpenseSchema);
