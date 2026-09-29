const SfSale = require('../../models/solidflex/SfSale');
const SfExpense = require('../../models/solidflex/SfExpense');
const SfProduct = require('../../models/solidflex/SfProduct');
const SfAuditLog = require('../../models/solidflex/SfAuditLog');
const { getStockMap } = require('../../services/solidflex/stockService');

function dateRange(query) {
  const range = {};
  if (query.from || query.to) {
    if (query.from) range.$gte = new Date(query.from);
    if (query.to) { const d = new Date(query.to); d.setHours(23, 59, 59, 999); range.$lte = d; }
  }
  return range;
}

const canViewProfit = (user) =>
  user.role === 'admin' || !!user.permissions?.sfViewProfit;

// GET /api/solidflex/reports/revenue?from=&to=&group=day|pid
// Revenue for everyone; cost & profit ONLY for sfViewProfit roles (stripped server-side)
exports.revenue = async (req, res) => {
  try {
    const match = { status: 'active' };
    const range = dateRange(req.query);
    if (Object.keys(range).length) match.date = range;

    const sales = await SfSale.find(match).lean();
    const revenue = sales.reduce((s, x) => s + x.price * x.qty, 0);
    const units = sales.reduce((s, x) => s + x.qty, 0);
    const cogs = sales.reduce((s, x) => s + (x.unitCost || 0) * x.qty, 0);

    const expenseMatch = { voided: false };
    if (Object.keys(range).length) expenseMatch.date = range;
    const expenses = await SfExpense.find(expenseMatch).lean();
    const overhead = expenses.filter(e => e.scope === 'overhead').reduce((s, e) => s + e.amount, 0);

    const base = { revenue, units, salesCount: sales.length, overhead };
    if (!canViewProfit(req.user)) return res.json(base); // cost/profit never leave the server

    const perPidCost = expenses.filter(e => e.scope === 'per_pid').reduce((s, e) => s + e.amount, 0);
    const cost = cogs + overhead + perPidCost;
    return res.json({ ...base, cogs, perPidCost, cost, profit: revenue - cost });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/solidflex/reports/team?from=&to=
exports.team = async (req, res) => {
  try {
    const match = { status: 'active' };
    const range = dateRange(req.query);
    if (Object.keys(range).length) match.date = range;

    const rows = await SfSale.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$seller',
          unitsSold: { $sum: '$qty' },
          totalSalesValue: { $sum: { $multiply: ['$price', '$qty'] } },
          salesCount: { $sum: 1 },
          lastSaleAt: { $max: '$date' },
        },
      },
      { $sort: { totalSalesValue: -1 } },
    ]);

    // Active sales only — returned/voided sales are excluded by the match above,
    // so cash collected = value of sales that stand (returns already excluded)
    res.json(rows.map(r => ({
      seller: r._id,
      unitsSold: r.unitsSold,
      totalSalesValue: r.totalSalesValue,
      cashCollected: r.totalSalesValue,
      salesCount: r.salesCount,
      lastSaleAt: r.lastSaleAt,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/solidflex/reports/stock — stock per PID with low-stock flags
exports.stock = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    const products = await SfProduct.find(filter).lean();
    const stockMap = await getStockMap(products.map(p => p.pid));

    const rows = products.map(p => ({
      pid: p.pid,
      type: p.type, color: p.color, design: p.design, size: p.size,
      stock: stockMap[p.pid] || 0,
      lowStockThreshold: p.lowStockThreshold,
      isLow: (stockMap[p.pid] || 0) <= (p.lowStockThreshold ?? 5),
      isActive: p.isActive,
      sellingPrice: p.sellingPrice,
    })).sort((a, b) => a.pid.localeCompare(b.pid));

    res.json({
      rows,
      summary: {
        totalUnits: rows.reduce((s, r) => s + r.stock, 0),
        lowStockCount: rows.filter(r => r.isLow && r.isActive).length,
        activeProducts: rows.filter(r => r.isActive).length,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  };
};

// GET /api/solidflex/reports/dashboard
exports.dashboard = async (req, res) => {
  try {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesThisMonth = await SfSale.find({ status: 'active', date: { $gte: from } }).lean();
    const revenueThisMonth = salesThisMonth.reduce((s, x) => s + x.price * x.qty, 0);

    const products = await SfProduct.find({}).lean();
    const stockMap = await getStockMap(products.map(p => p.pid));
    const lowStock = products
      .filter(p => p.isActive && (stockMap[p.pid] || 0) <= (p.lowStockThreshold ?? 5))
      .map(p => ({ pid: p.pid, stock: stockMap[p.pid] || 0, threshold: p.lowStockThreshold }));

    const recentSales = await SfSale.find({}).sort({ date: -1 }).limit(8).lean();
    const topProducts = await SfSale.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$pid', units: { $sum: '$qty' }, revenue: { $sum: { $multiply: ['$price', '$qty'] } } } },
      { $sort: { units: -1 } },
      { $limit: 5 },
    ]);

    const base = {
      salesThisMonth: salesThisMonth.length,
      revenueThisMonth,
      unitsInStock: Object.values(stockMap).reduce((s, v) => s + v, 0),
      lowStock,
      topProducts,
      recentSales,
    };
    if (!canViewProfit(req.user)) return res.json(base);

    const cogsThisMonth = salesThisMonth.reduce((s, x) => s + (x.unitCost || 0) * x.qty, 0);
    const expenses = await SfExpense.find({ voided: false, date: { $gte: from } }).lean();
    const expensesThisMonth = expenses.reduce((s, e) => s + e.amount, 0);
    return res.json({
      ...base,
      profitThisMonth: revenueThisMonth - cogsThisMonth - expensesThisMonth,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/solidflex/audit?entity=&entityId=&limit=  (Owner/admin)
exports.auditList = async (req, res) => {
  try {
    const filter = {};
    if (req.query.entity) filter.entity = req.query.entity;
    if (req.query.entityId) filter.entityId = req.query.entityId;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const logs = await SfAuditLog.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
