const SfShipment = require('../../models/solidflex/SfShipment');
const SfProduct = require('../../models/solidflex/SfProduct');
const { normalizePid } = require('../../services/solidflex/pidService');
const { writeAudit, snapshot } = require('../../services/solidflex/auditService');

// GET /api/solidflex/shipments?pid=&from=&to=&limit=
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.pid) {
      const pid = normalizePid(req.query.pid);
      if (!pid) return res.status(400).json({ message: 'Invalid PID' });
      filter.pid = pid;
    }
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) { const d = new Date(req.query.to); d.setHours(23, 59, 59, 999); filter.date.$lte = d; }
    }
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const shipments = await SfShipment.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    res.json(shipments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/solidflex/shipments  { pid, qty, note, date }
exports.create = async (req, res) => {
  try {
    const pid = normalizePid(req.body.pid);
    if (!pid) return res.status(400).json({ message: 'Invalid PID format' });

    const product = await SfProduct.findOne({ pid }).lean();
    if (!product) return res.status(400).json({ message: `Unknown product: ${pid}. Add it in Master first.` });
    if (product.isActive === false) return res.status(400).json({ message: `Product ${pid} is deactivated` });

    const qty = Number(req.body.qty);
    if (!Number.isFinite(qty) || qty < 0.5) return res.status(400).json({ message: 'qty must be at least 0.5' });

    const date = req.body.date ? new Date(req.body.date) : new Date();
    if (isNaN(date.getTime())) return res.status(400).json({ message: 'Invalid date' });

    const shipment = await SfShipment.create({
      pid, qty, date,
      note: String(req.body.note || '').slice(0, 300),
      receivedBy: req.user.name || '',
    });

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_shipment.create', entity: 'SfShipment', entityId: String(shipment._id),
      after: snapshot(shipment.toObject()), ip: req.ip,
    });
    res.status(201).json(shipment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/solidflex/shipments/:id/void — never hard delete; history intact
exports.void = async (req, res) => {
  try {
    const shipment = await SfShipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
    if (shipment.voided) return res.status(409).json({ message: 'Already voided' });
    const before = snapshot(shipment.toObject());

    shipment.voided = true;
    shipment.voidedBy = req.user.name || '';
    await shipment.save();

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_shipment.void', entity: 'SfShipment', entityId: String(shipment._id),
      before, after: { voided: true, voidedBy: shipment.voidedBy }, ip: req.ip,
    });
    res.json({ message: `Shipment voided — stock for ${shipment.pid} reduced`, shipment });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
