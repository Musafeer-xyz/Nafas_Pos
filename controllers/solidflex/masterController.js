const SfMaster = require('../../models/solidflex/SfMaster');
const SfProduct = require('../../models/solidflex/SfProduct');
const { writeAudit, snapshot } = require('../../services/solidflex/auditService');

// GET /api/solidflex/master?kind=type&activeOnly=true
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.kind) filter.kind = req.query.kind;
    if (req.query.activeOnly === 'true') filter.isActive = true;
    const items = await SfMaster.find(filter).sort({ kind: 1, value: 1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/solidflex/master  { kind, value, note }
exports.create = async (req, res) => {
  try {
    const { kind, value, note = '' } = req.body;
    if (!['type', 'color', 'design', 'size'].includes(kind)) {
      return res.status(400).json({ message: 'kind must be one of type/color/design/size' });
    }
    if (!value || !String(value).trim()) return res.status(400).json({ message: 'value is required' });

    const clean = String(value).trim().toUpperCase();
    const exists = await SfMaster.findOne({ kind, value: clean }).lean();
    if (exists) {
      if (!exists.isActive) {
        // reactivate instead of erroring (idempotent-friendly)
        exists.isActive = true;
        await SfMaster.findByIdAndUpdate(exists._id, { isActive: true, note });
        await writeAudit({
          user: req.user.name, userId: req.user.userId || '', role: req.user.role,
          action: 'sf_master.reactivate', entity: 'SfMaster', entityId: String(exists._id),
          before: { isActive: false }, after: { isActive: true }, ip: req.ip,
        });
        return res.json({ ...exists, isActive: true, reactivated: true });
      }
      return res.status(409).json({ message: `"${clean}" already exists in ${kind} list` });
    }

    const item = await SfMaster.create({ kind, value: clean, note });
    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_master.create', entity: 'SfMaster', entityId: String(item._id),
      after: snapshot(item.toObject()), ip: req.ip,
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/solidflex/master/:id  { value?, note?, isActive? }
exports.update = async (req, res) => {
  try {
    const item = await SfMaster.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Master item not found' });
    const before = snapshot(item.toObject());

    const { value, note, isActive } = req.body;
    if (value !== undefined) {
      const clean = String(value).trim().toUpperCase();
      if (!clean) return res.status(400).json({ message: 'value cannot be empty' });
      if (clean !== item.value) {
        // Renaming would orphan products + stock/sales history that reference the old value.
        const inUse = await SfProduct.countDocuments({ [item.kind]: item.value });
        if (inUse > 0) {
          return res.status(409).json({ message: `Cannot rename "${item.value}" — ${inUse} product(s) use it. Deactivate it and create the new value instead.` });
        }
        const dupe = await SfMaster.findOne({ kind: item.kind, value: clean, _id: { $ne: item._id } }).lean();
        if (dupe) return res.status(409).json({ message: `"${clean}" already exists in ${item.kind} list` });
      }
      item.value = clean;
    }
    if (note !== undefined) item.note = String(note).slice(0, 200);
    if (isActive !== undefined) item.isActive = !!isActive;
    await item.save();

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_master.update', entity: 'SfMaster', entityId: String(item._id),
      before, after: snapshot(item.toObject()), ip: req.ip,
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE = soft deactivate only; hard-blocked if referenced by products
exports.deactivate = async (req, res) => {
  try {
    const item = await SfMaster.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Master item not found' });

    // Never hard-delete referenced values; deactivate keeps history valid.
    const inUse = await SfProduct.countDocuments({ [item.kind]: item.value });
    if (item.isActive && inUse > 0) {
      await SfMaster.findByIdAndUpdate(item._id, { isActive: false });
      await writeAudit({
        user: req.user.name, userId: req.user.userId || '', role: req.user.role,
        action: 'sf_master.deactivate', entity: 'SfMaster', entityId: String(item._id),
        before: { isActive: true }, after: { isActive: false, referencedByProducts: inUse }, ip: req.ip,
      });
      return res.json({ message: `Deactivated (referenced by ${inUse} product(s)); value kept for history` });
    }

    await SfMaster.findByIdAndUpdate(item._id, { isActive: false });
    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_master.deactivate', entity: 'SfMaster', entityId: String(item._id),
      before: { isActive: true }, after: { isActive: false }, ip: req.ip,
    });
    res.json({ message: 'Master item deactivated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
