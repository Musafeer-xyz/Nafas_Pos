const SfProduct = require('../../models/solidflex/SfProduct');
const { normalizePid, parsePid, validatePartsAgainstMaster, buildPid, PART_KEYS } = require('../../services/solidflex/pidService');
const { getStockMap } = require('../../services/solidflex/stockService');
const { writeAudit, snapshot } = require('../../services/solidflex/auditService');

// GET /api/solidflex/products?active=true&withStock=true
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active === 'true') filter.isActive = true;
    const products = await SfProduct.find(filter).sort({ type: 1, color: 1, design: 1, size: 1 }).lean();

    const withStock = req.query.withStock === 'true';
    if (withStock && products.length) {
      const stockMap = await getStockMap(products.map(p => p.pid));
      const thresholds = new Map(products.map(p => [p.pid, p.lowStockThreshold ?? 5]));
      for (const p of products) {
        p.stock = stockMap[p.pid] || 0;
        p.isLow = p.stock <= (thresholds.get(p.pid) ?? 5);
      }
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/solidflex/products/:pid
exports.getOne = async (req, res) => {
  try {
    const pid = normalizePid(req.params.pid);
    if (!pid) return res.status(400).json({ message: 'Invalid PID format' });
    const product = await SfProduct.findOne({ pid }).lean();
    if (!product) return res.status(404).json({ message: `Product ${pid} not found` });
    const stock = await getStockMap([pid]);
    res.json({ ...product, stock: stock[pid] || 0 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/solidflex/products  { type, color, design, size, unitCost, sellingPrice, lowStockThreshold }
exports.create = async (req, res) => {
  try {
    const parts = {};
    for (const k of PART_KEYS) parts[k] = String(req.body[k] || '').trim();
    const missing = PART_KEYS.filter(k => !parts[k]);
    if (missing.length) return res.status(400).json({ message: `Missing: ${missing.join(', ')}` });

    const { ok, errors } = await validatePartsAgainstMaster(parts);
    if (!ok) return res.status(400).json({ message: errors.join('; ') });

    const pid = buildPid(parts);
    const exists = await SfProduct.findOne({ pid }).lean();
    if (exists) return res.status(409).json({ message: `Product ${pid} already exists` });

    const product = await SfProduct.create({
      ...parts,
      pid,
      unitCost: Math.max(0, Number(req.body.unitCost) || 0),
      sellingPrice: Math.max(0, Number(req.body.sellingPrice) || 0),
      lowStockThreshold: Math.max(0, Number(req.body.lowStockThreshold) || 0) || 5,
      createdBy: req.user.name || '',
    });

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_product.create', entity: 'SfProduct', entityId: pid,
      after: snapshot(product.toObject()), ip: req.ip,
    });
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/solidflex/products/:pid  — cost/price/threshold/active; attributes only via delete+recreate
exports.update = async (req, res) => {
  try {
    const pid = normalizePid(req.params.pid);
    if (!pid) return res.status(400).json({ message: 'Invalid PID format' });
    const product = await SfProduct.findOne({ pid });
    if (!product) return res.status(404).json({ message: `Product ${pid} not found` });
    const before = snapshot(product.toObject());

    const { unitCost, sellingPrice, lowStockThreshold, isActive } = req.body;
    if (unitCost !== undefined) product.unitCost = Math.max(0, Number(unitCost) || 0);
    if (sellingPrice !== undefined) product.sellingPrice = Math.max(0, Number(sellingPrice) || 0);
    if (lowStockThreshold !== undefined) product.lowStockThreshold = Math.max(0, Number(lowStockThreshold) || 0);
    if (isActive !== undefined) product.isActive = !!isActive;
    await product.save();

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_product.update', entity: 'SfProduct', entityId: pid,
      before, after: snapshot(product.toObject()), ip: req.ip,
    });
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/solidflex/products/:pid — soft deactivate only
exports.deactivate = async (req, res) => {
  try {
    const pid = normalizePid(req.params.pid);
    const product = await SfProduct.findOne({ pid });
    if (!product) return res.status(404).json({ message: `Product ${pid} not found` });

    product.isActive = false;
    await product.save();
    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_product.deactivate', entity: 'SfProduct', entityId: pid,
      before: { isActive: true }, after: { isActive: false }, ip: req.ip,
    });
    res.json({ message: `Product ${pid} deactivated (history preserved)` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
