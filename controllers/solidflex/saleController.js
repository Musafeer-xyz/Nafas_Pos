const mongoose = require('mongoose');
const SfSale = require('../../models/solidflex/SfSale');
const SfProduct = require('../../models/solidflex/SfProduct');
const SfShipment = require('../../models/solidflex/SfShipment');
const SfStockGuard = require('../../models/solidflex/SfStockGuard');
const { normalizePid } = require('../../services/solidflex/pidService');
const { nextSaleSerial } = require('../../services/solidflex/serialService');
const { writeAudit, snapshot } = require('../../services/solidflex/auditService');

// GET /api/solidflex/sales?pid=&seller=&from=&to=&status=&limit=
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.pid) {
      const pid = normalizePid(req.query.pid);
      if (!pid) return res.status(400).json({ message: 'Invalid PID' });
      filter.pid = pid;
    }
    // Sellers only see their own sales (server-side, not just UI)
    if (req.user.role !== 'admin' && !req.user.permissions?.sfManageShipments && !req.user.permissions?.sfViewProfit) {
      filter.seller = req.user.name;
    } else if (req.query.seller) {
      filter.seller = req.query.seller;
    }
    if (req.query.status && ['active', 'returned', 'voided'].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) { const d = new Date(req.query.to); d.setHours(23, 59, 59, 999); filter.date.$lte = d; }
    }
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const sales = await SfSale.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/solidflex/sales/next-serial (for UI preview; the real serial is assigned in the transaction)
exports.nextSerial = async (req, res) => {
  try {
    res.json({ serial: `SF-${new Date().getFullYear()}-####` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/solidflex/sales  { pid, qty, price?, customerName?, customerPhone?, seller?, date?, note? }
exports.create = async (req, res) => {
  const pid = normalizePid(req.body.pid);
  if (!pid) return res.status(400).json({ message: 'Invalid PID format' });

  const qty = Number(req.body.qty);
  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ message: 'qty must be a whole number ≥ 1' });
  }

  const isPrivileged = req.user.role === 'admin' || req.user.permissions?.sfManageShipments || req.user.permissions?.sfManageMasters;
  const sellerName = isPrivileged && req.body.seller ? String(req.body.seller).trim().slice(0, 80) : (req.user.name || 'Staff');

  /**
   * One transactional attempt. Concurrency design (oversell-proof):
   *  1. totalReceived = Σ shipments (stable under sale contention)
   *  2. $inc the per-PID SfStockGuard counter INSIDE this transaction —
   *     all simultaneous sales of a PID contend on this single document;
   *     MongoDB aborts all but one with WriteConflict.
   *  3. WriteConflict losers retry the whole transaction, re-read the
   *     committed counter, and get a clean "Only X left" rejection.
   * Invariant: guard.unitsSold === Σ active sale qty for the PID.
   */
  const attemptSale = async () => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const product = await SfProduct.findOne({ pid }).session(session);
      if (!product) throw new Error(`Unknown product: ${pid}`);
      if (product.isActive === false) throw new Error(`Product ${pid} is deactivated`);

      const shipments = await SfShipment.find({ pid, voided: false }).session(session).lean();
      const totalReceived = shipments.reduce((s, r) => s + r.qty, 0);

      const guard = await SfStockGuard.findOneAndUpdate(
        { pid },
        { $inc: { unitsSold: qty } },
        { new: true, upsert: true, session }
      );

      const soldBefore = guard.unitsSold - qty;
      const availableBefore = totalReceived - soldBefore;
      if (availableBefore < qty) {
        const err = new Error(
          availableBefore <= 0
            ? `Out of stock for ${pid} — nothing sellable right now`
            : `Only ${availableBefore} left of ${pid} (asked for ${qty})`
        );
        err.isOversell = true;
        throw err;
      }

      const price = req.body.price !== undefined && req.body.price !== null && req.body.price !== ''
        ? Math.max(0, Number(req.body.price))
        : product.sellingPrice;
      if (!Number.isFinite(price)) throw new Error('Invalid price');

      const date = req.body.date ? new Date(req.body.date) : new Date();
      if (isNaN(date.getTime())) throw new Error('Invalid date');

      const sale = new SfSale({
        serial: await nextSaleSerial(session), // atomic inside this transaction
        pid,
        qty,
        price,
        unitCost: product.unitCost || 0,
        customerName: String(req.body.customerName || 'Walk-in').trim().slice(0, 80) || 'Walk-in',
        customerPhone: String(req.body.customerPhone || '').trim().slice(0, 20),
        seller: sellerName,
        sellerUserId: req.user.userId || '',
        date,
        note: String(req.body.note || '').slice(0, 300),
        status: 'active',
      });
      await sale.save({ session });

      await writeAudit({
        user: req.user.name, userId: req.user.userId || '', role: req.user.role,
        action: 'sf_sale.create', entity: 'SfSale', entityId: sale.serial,
        after: snapshot(sale.toObject()),
        ip: req.ip,
      }, session);

      await session.commitTransaction();
      return sale;
    } catch (err) {
      if (session.inTransaction?.()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  };

  // Retry transient write conflicts (contention), max 3 attempts
  let sale, lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      sale = await attemptSale();
      break;
    } catch (err) {
      lastErr = err;
      const transient = err.hasErrorLabel?.('TransientTransactionError')
        || err.code === 112
        || err.codeName === 'WriteConflict'
        || /WriteConflict|transaction/i.test(err.message || '');
      if (!transient || err.isOversell || attempt === 3) break;
    }
  }

  if (!sale) {
    if (lastErr.isOversell || /stock|left of/i.test(lastErr.message || '')) {
      return res.status(409).json({ message: lastErr.message });
    }
    return res.status(400).json({ message: lastErr.message });
  }

  const stockAfter = await SfSale.aggregate([
    { $match: { pid: sale.pid, status: 'active' } },
    { $group: { _id: null, out: { $sum: '$qty' } } },
  ]).then(r => r[0]?.out || 0);
  const received = await SfShipment.aggregate([
    { $match: { pid: sale.pid, voided: false } },
    { $group: { _id: null, in: { $sum: '$qty' } } },
  ]).then(r => r[0]?.in || 0);

  res.status(201).json({
    ...sale.toObject(),
    stockAfter: received - stockAfter,
  });
};

// PATCH /api/solidflex/sales/:serial/status  { status: 'returned' | 'voided' }
// Returned/voided sales stop counting against stock (restores availability)
exports.changeStatus = async (req, res) => {
  const { status } = req.body;
  if (!['returned', 'voided'].includes(status)) {
    return res.status(400).json({ message: "status must be 'returned' or 'voided'" });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await SfSale.findOne({ serial: req.params.serial }).session(session);
    if (!sale) throw new Error('Sale not found');
    if (sale.status !== 'active') {
      return res.status(409).json({ message: `Sale is already ${sale.status}` });
    }
    const before = snapshot(sale.toObject());

    sale.status = status;
    sale.statusChangedBy = req.user.name || '';
    sale.statusChangedAt = new Date();
    await sale.save({ session });

    // Keep the stock-guard invariant: returned/voided units no longer count as sold
    await SfStockGuard.findOneAndUpdate(
      { pid: sale.pid },
      { $inc: { unitsSold: -sale.qty } },
      { session, upsert: true }
    );

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: `sf_sale.${status}`, entity: 'SfSale', entityId: sale.serial,
      before: { status: before.status }, after: { status, by: sale.statusChangedBy },
      ip: req.ip,
    }, session);

    await session.commitTransaction();
    res.json({ ...sale.toObject(), message: `Sale ${sale.serial} ${status} — stock restored` });
  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

module.exports = { list: exports.list, create: exports.create, changeStatus: exports.changeStatus, nextSerial: exports.nextSerial };
