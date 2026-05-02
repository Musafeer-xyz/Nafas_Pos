const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/saleController');
const { auth, adminOnly, can } = require('../middleware/auth');

router.post('/', auth, ctrl.create);
router.post('/import', auth, adminOnly, ctrl.importHistorical);
router.get('/', auth, can('viewHistory'), ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.delete('/:id', auth, can('deleteSales'), ctrl.remove);

module.exports = router;
