const mongoose = require('mongoose');

/**
 * Per-PID sold-units counter. THE concurrency guard for oversell prevention:
 * every sale transaction increments this document for its PID inside the same
 * transaction. Two simultaneous sales of the same PID must both write to this
 * one document → MongoDB aborts one with WriteConflict → exactly one wins.
 *
 * Invariant (maintained transactionally, never edited by hand):
 *   unitsSold === Σ(qty of sf_sales where status = 'active' and pid = this)
 */
const sfStockGuardSchema = new mongoose.Schema({
  pid: { type: String, required: true, unique: true, uppercase: true, trim: true },
  unitsSold: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.models.SfStockGuard || mongoose.model('SfStockGuard', sfStockGuardSchema);
