const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Combo = require('../models/Combo');
const mongoose = require('mongoose');

// Helper: get available stock for a product (main or branch)
function getAvailable(product, branchId) {
  if (!branchId) return product.stock; // main store
  const entry = product.branchStock?.find(b => b.branchId.toString() === branchId);
  return entry ? entry.qty : 0;
}

// Helper: deduct stock from product (main or branch)
function deductStock(product, branchId, qty) {
  if (!branchId) {
    product.stock = parseFloat((product.stock - qty).toFixed(2));
  } else {
    const entry = product.branchStock?.find(b => b.branchId.toString() === branchId);
    if (entry) {
      entry.qty = parseFloat((entry.qty - qty).toFixed(2));
      product.markModified('branchStock');
    }
  }
}

// Helper: restore stock to product (main or branch)
function restoreStock(product, branchId, qty) {
  if (!branchId) {
    product.stock = parseFloat((product.stock + qty).toFixed(2));
  } else {
    const entry = product.branchStock?.find(b => b.branchId.toString() === branchId);
    if (entry) {
      entry.qty = parseFloat((entry.qty + qty).toFixed(2));
      product.markModified('branchStock');
    } else {
      if (!product.branchStock) product.branchStock = [];
      product.branchStock.push({ branchId, qty });
      product.markModified('branchStock');
    }
  }
}

// POST: Record a new sale
exports.create = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { customerName, customerPhone, items, extraCosts, channel, notes, branchId, branchName, date } = req.body;
    const soldBy = req.user.role === 'admin' ? 'Admin' : (req.user.name || 'Assistant');
    const isMain = !branchId;

    let totalRevenue = 0;
    const processedItems = [];

    for (const item of items) {
      if (item.itemType === 'Product') {
        const product = await Product.findById(item.itemId).session(session);
        if (!product) throw new Error(`Product not found: ${item.itemId}`);

        const available = getAvailable(product, branchId);
        if (available < item.qty) {
          const storeName = isMain ? 'Main Store' : (branchName || 'Branch');
          throw new Error(`Insufficient stock for "${product.name}" in ${storeName}. Available: ${available}${product.unit}`);
        }

        deductStock(product, branchId, item.qty);
        await product.save({ session });

        // ✅ Price Logic Fixed: overridePrice is now treated as the exact line total customized by user
        let lineTotal = 0;
        if (item.overridePrice != null) {
          lineTotal = parseFloat(Number(item.overridePrice).toFixed(2));
        } else if (product.unit === 'piece') {
          // Flat per-piece: sellingPrice × qty
          lineTotal = parseFloat((product.sellingPrice * item.qty).toFixed(2));
        } else {
          // Attar ml formula: (sellingPrice / 3.5) × qty
          const perMl = product.sellingPrice / 3.5;
          lineTotal = parseFloat((perMl * item.qty).toFixed(2));
        }

        totalRevenue += lineTotal;

        processedItems.push({
          itemId: product._id,
          itemType: 'Product',
          name: product.name,
          qty: item.qty,
          unitPrice: lineTotal,
          originalPrice: product.sellingPrice,
          isOverridden: item.overridePrice != null
        });

      } else if (item.itemType === 'Combo') {
        const combo = await Combo.findById(item.itemId).populate('products.productId').session(session);
        if (!combo) throw new Error(`Combo not found: ${item.itemId}`);

        // Check all products first
        for (const cp of combo.products) {
          const needed = cp.quantity * item.qty;
          const available = getAvailable(cp.productId, branchId);
          if (available < needed) {
            const storeName = isMain ? 'Main Store' : (branchName || 'Branch');
            throw new Error(`Insufficient stock for "${cp.productId.name}" in ${storeName}. Available: ${available}${cp.productId.unit}, needed: ${needed}`);
          }
        }

        // Deduct all
        for (const cp of combo.products) {
          const needed = cp.quantity * item.qty;
          const prod = await Product.findById(cp.productId._id).session(session);
          deductStock(prod, branchId, needed);
          await prod.save({ session });
        }

        // ✅ Price Logic Fixed for Combo
        let lineTotal = 0;
        if (item.overridePrice != null) {
          lineTotal = parseFloat(Number(item.overridePrice).toFixed(2));
        } else {
          lineTotal = parseFloat((combo.comboPrice * item.qty).toFixed(2));
        }

        totalRevenue += lineTotal;

        processedItems.push({
          itemId: combo._id,
          itemType: 'Combo',
          name: combo.name,
          qty: item.qty,
          unitPrice: lineTotal,
          originalPrice: combo.comboPrice,
          isOverridden: item.overridePrice != null
        });
      }
    }

    const sale = new Sale({
      customerName: customerName || 'Walk-in',
      customerPhone: customerPhone || '',
      items: processedItems,
      totalRevenue,
      extraCosts: extraCosts || {},
      soldBy,
      store: branchId ? 'branch' : 'main',
      branchId: branchId || null,
      branchName: branchName || 'Main Store',
      channel: channel || 'Direct',
      notes: notes || '',
      date: date ? new Date(date) : new Date()
    });

    await sale.save({ session });
    await session.commitTransaction();
    res.status(201).json(sale);

  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// GET all sales
exports.getAll = async (req, res) => {
  try {
    const { from, to, soldBy, channel, branchId } = req.query;
    let filter = {};
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); filter.date.$lte = d; }
    }
    if (soldBy) filter.soldBy = soldBy;
    if (channel) filter.channel = channel;
    if (branchId === 'main') filter.branchId = null;
    else if (branchId) filter.branchId = branchId;

    const sales = await Sale.find(filter).sort({ date: -1 }).limit(200);
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET single sale
exports.getOne = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE sale + restore stock
exports.remove = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const sale = await Sale.findById(req.params.id).session(session);
    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const branchId = sale.branchId ? sale.branchId.toString() : null;

    for (const item of sale.items) {
      if (item.itemType === 'Product') {
        const product = await Product.findById(item.itemId).session(session);
        if (product) { restoreStock(product, branchId, item.qty); await product.save({ session }); }
      } else if (item.itemType === 'Combo') {
        const combo = await Combo.findById(item.itemId).populate('products.productId').session(session);
        if (combo) {
          for (const cp of combo.products) {
            const prod = await Product.findById(cp.productId._id).session(session);
            if (prod) { restoreStock(prod, branchId, cp.quantity * item.qty); await prod.save({ session }); }
          }
        }
      }
    }

    await Sale.findByIdAndDelete(req.params.id, { session });
    await session.commitTransaction();
    res.json({ message: 'Sale deleted and stock restored' });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

// POST historical import
exports.importHistorical = async (req, res) => {
  try {
    const { customerName, items, date, notes } = req.body;
    const processedItems = (items || []).map(item => ({
      itemId: item.itemId,
      itemType: item.itemType || 'Product',
      name: item.name || 'Imported Product',
      qty: item.qty,
      unitPrice: item.overridePrice || 0,
      originalPrice: item.overridePrice || 0,
      isOverridden: false
    }));
    const totalRevenue = processedItems.reduce((s, i) => s + i.unitPrice, 0);
    const sale = new Sale({
      customerName: customerName || 'Historical',
      items: processedItems,
      totalRevenue,
      extraCosts: {},
      soldBy: 'Admin',
      store: 'main',
      branchName: 'Main Store',
      notes: notes || 'Historical import',
      date: date ? new Date(date) : new Date()
    });
    await sale.save();
    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};