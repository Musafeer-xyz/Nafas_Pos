const SfShipment = require('../../models/solidflex/SfShipment');
const SfSale = require('../../models/solidflex/SfSale');

/**
 * Derived stock for one PID: Σ shipments (not voided) − Σ active sales.
 * Stock is computed, never stored as a bare editable number.
 */
async function getStock(pid, session = null) {
  const shp = session ? SfShipment.find({ pid, voided: false }).session(session) : SfShipment.find({ pid, voided: false });
  const [received, sold] = await Promise.all([
    shp.lean(),
    activeSalesFor(pid, session),
  ]);
  const totalIn = received.reduce((s, r) => s + r.qty, 0);
  const totalOut = sold.reduce((s, r) => s + r.qty, 0);
  return totalIn - totalOut;
}

async function activeSalesFor(pid, session = null) {
  const q = SfSale.find({ pid, status: { $in: SfSale.STOCK_COUNTING_STATUSES } }).lean();
  return session ? q.session(session) : q;
}

/** Batch stock map { pid: stock } for the given PIDs (or all products when omitted) */
async function getStockMap(pids = null, session = null) {
  const shpMatch = { voided: false };
  const saleMatch = { status: { $in: SfSale.STOCK_COUNTING_STATUSES } };
  if (pids) {
    const list = Array.isArray(pids) ? pids : [...pids];
    if (!list.length) return {};
    shpMatch.pid = { $in: list };
    saleMatch.pid = { $in: list };
  }

  const [shpAgg, saleAgg] = await Promise.all([
    aggregate(SfShipment, shpMatch, session),
    aggregate(SfSale, saleMatch, session),
  ]);

  const map = {};
  const add = (key, val) => { map[key] = (map[key] || 0) + val; };
  for (const r of shpAgg) add(r._id, r.total);
  for (const r of saleAgg) add(r._id, -r.total);
  return map;
}

function aggregate(Model, match, session) {
  const agg = Model.aggregate([{ $match: match }, { $group: { _id: '$pid', total: { $sum: '$qty' } } }]);
  return session ? agg.session(session) : agg;
}

module.exports = { getStock, getStockMap, activeSalesFor };
