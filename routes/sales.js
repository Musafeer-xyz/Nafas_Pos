const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/saleController');
const { auth, adminOnly } = require('../middleware/auth');

router.post('/', auth, ctrl.create);
router.post('/import', auth, adminOnly, ctrl.importHistorical); // bulk historical import
router.get('/', auth, adminOnly, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.delete('/:id', auth, adminOnly, ctrl.remove);

module.exports = router;
