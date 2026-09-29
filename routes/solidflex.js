const express = require('express');
const router = express.Router();

const { auth, adminOnly, can } = require('../middleware/auth');
const master = require('../controllers/solidflex/masterController');
const product = require('../controllers/solidflex/productController');
const shipment = require('../controllers/solidflex/shipmentController');
const sale = require('../controllers/solidflex/saleController');
const expense = require('../controllers/solidflex/expenseController');
const reports = require('../controllers/solidflex/reportController');

router.use(auth); // every SOLID FLEX route requires a valid PIN-issued JWT

// ── Master lists (Type/Color/Design/Size) ──
router.get('/master', can('sfManageMasters'), master.list);
router.post('/master', can('sfManageMasters'), master.create);
router.put('/master/:id', can('sfManageMasters'), master.update);
router.put('/master/:id/deactivate', can('sfManageMasters'), master.deactivate);

// ── Products (PID master list) ──
router.get('/products', can('sfSell'), product.list);
router.get('/products/:pid', can('sfSell'), product.getOne);
router.post('/products', can('sfManageMasters'), product.create);
router.put('/products/:pid', can('sfManageMasters'), product.update);
router.delete('/products/:pid', can('sfManageMasters'), product.deactivate);

// ── PID autofill both ways ──
router.post('/pid/resolve', can('sfSell'), product.getOne);

// ── Shipments (stock IN) ──
router.get('/shipments', can('sfManageShipments'), shipment.list);
router.post('/shipments', can('sfManageShipments'), shipment.create);
router.patch('/shipments/:id/void', can('sfVoid'), shipment.void);

// ── Sales (stock OUT) ──
router.get('/sales', can('sfSell'), sale.list);
router.post('/sales', can('sfSell'), sale.create);
router.patch('/sales/:serial/status', can('sfVoid'), sale.changeStatus);
router.get('/sales/next-serial', can('sfSell'), sale.nextSerial);

// ── Expenses (Owner only — costs stay away from Manager/Seller) ──
router.get('/expenses', adminOnly, expense.list);
router.post('/expenses', adminOnly, expense.create);
router.patch('/expenses/:id/void', adminOnly, expense.void);

// ── Reports ──
router.get('/reports/revenue', can('sfSell'), reports.revenue);
router.get('/reports/team', can('sfSell'), reports.team);
router.get('/reports/stock', can('sfSell'), reports.stock);
router.get('/reports/dashboard', can('sfSell'), reports.dashboard);

// ── Audit log (Owner/admin) ──
router.get('/audit', adminOnly, reports.auditList);

module.exports = router;
