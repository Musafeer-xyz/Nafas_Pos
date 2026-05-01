const express = require('express');
const router = express.Router();
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const ExtraCost = require('../models/ExtraCost');
const { auth, adminOnly } = require('../middleware/auth');

// GET dashboard stats - admin only
router.get('/stats', auth, adminOnly, async (req, res) => {
  try {
    const { period } = req.query; // 'today', 'week', 'month', 'all'
    
    let dateFilter = {};
    const now = new Date();
    
    if (period === 'today') {
      const start = new Date(now); start.setHours(0,0,0,0);
      dateFilter = { date: { $gte: start } };
    } else if (period === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 7);
      dateFilter = { date: { $gte: start } };
    } else if (period === 'month') {
      const start = new Date(now); start.setDate(1); start.setHours(0,0,0,0);
      dateFilter = { date: { $gte: start } };
    }

    const [sales, products, costs] = await Promise.all([
      Sale.find(dateFilter).sort({ date: -1 }),
      Product.find({ isActive: true }),
      ExtraCost.find()
    ]);

    const totalRevenue = sales.reduce((s, x) => s + x.totalRevenue, 0);
    const totalNetProfit = sales.reduce((s, x) => s + (x.netProfit || 0), 0);
    const totalExtraCosts = costs.reduce((s, x) => s + x.amount, 0);
    const lowStock = products.filter(p => p.stock <= p.lowStockAlert);
    const tanjimRevenue = sales.filter(s => s.store === 'tanjim').reduce((s, x) => s + x.totalRevenue, 0);
    const siamRevenue = sales.filter(s => s.store !== 'tanjim').reduce((s, x) => s + x.totalRevenue, 0);

    // Top selling products
    const productSales = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!productSales[item.name]) productSales[item.name] = { qty: 0, revenue: 0 };
        productSales[item.name].qty += item.qty;
        productSales[item.name].revenue += item.unitPrice * item.qty;
      });
    });
    const topProducts = Object.entries(productSales)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Sales by channel
    const byChannel = {};
    sales.forEach(s => {
      byChannel[s.channel] = (byChannel[s.channel] || 0) + s.totalRevenue;
    });

    res.json({
      totalRevenue,
      totalNetProfit,
      totalSales: sales.length,
      totalExtraCosts,
      tanjimRevenue,
      siamRevenue,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock.map(p => ({ name: p.name, stock: p.stock, unit: p.unit, alert: p.lowStockAlert })),
      topProducts,
      byChannel,
      recentSales: sales.slice(0, 10)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET assistant dashboard (limited - stock only)
router.get('/assistant', auth, async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }, 'name stock unit lowStockAlert category').sort({ name: 1 });
    const lowStock = products.filter(p => p.stock <= p.lowStockAlert);
    res.json({ products, lowStockCount: lowStock.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
