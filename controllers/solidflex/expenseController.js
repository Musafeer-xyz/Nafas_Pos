const SfExpense = require('../../models/solidflex/SfExpense');
const { normalizePid } = require('../../services/solidflex/pidService');
const { writeAudit, snapshot } = require('../../services/solidflex/auditService');

// GET /api/solidflex/expenses?scope=&pid=&from=&to=&limit=   (Owner/admin only)
exports.list = async (req, res) => {
  try {
    const filter = {};
    if (req.query.scope && ['per_pid', 'overhead'].includes(req.query.scope)) filter.scope = req.query.scope;
    if (req.query.pid) filter.pid = normalizePid(req.query.pid);
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) { const d = new Date(req.query.to); d.setHours(23, 59, 59, 999); filter.date.$lte = d; }
    }
    const limit = Math.min(parseInt(req.query.limit) || 300, 1000);
    const expenses = await SfExpense.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit).lean();
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/solidflex/expenses  { date, category, amount, scope, pid?, note? }
exports.create = async (req, res) => {
  try {
    const { scope, category, note } = req.body;
    if (!['per_pid', 'overhead'].includes(scope)) {
      return res.status(400).json({ message: "scope must be 'per_pid' or 'overhead'" });
    }
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'amount must be > 0' });

    let pid = null;
    if (scope === 'per_pid') {
      pid = normalizePid(req.body.pid);
      if (!pid) return res.status(400).json({ message: 'per_pid expense requires a valid PID' });
    }

    const date = req.body.date ? new Date(req.body.date) : new Date();
    if (isNaN(date.getTime())) return res.status(400).json({ message: 'Invalid date' });

    const expense = await SfExpense.create({
      date, scope, pid,
      amount,
      category: category || 'Other',
      note: String(note || '').slice(0, 300),
      recordedBy: req.user.name || '',
    });

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_expense.create', entity: 'SfExpense', entityId: String(expense._id),
      after: snapshot(expense.toObject()), ip: req.ip,
    });
    res.status(201).json(expense);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PATCH /api/solidflex/expenses/:id/void — soft remove from calculations
exports.void = async (req, res) => {
  try {
    const expense = await SfExpense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    if (expense.voided) return res.status(409).json({ message: 'Already voided' });
    const before = snapshot(expense.toObject());

    expense.voided = true;
    expense.voidedBy = req.user.name || '';
    await expense.save();

    await writeAudit({
      user: req.user.name, userId: req.user.userId || '', role: req.user.role,
      action: 'sf_expense.void', entity: 'SfExpense', entityId: String(expense._id),
      before: { voided: false, amount: before.amount }, after: { voided: true }, ip: req.ip,
    });
    res.json({ message: 'Expense voided', expense });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
