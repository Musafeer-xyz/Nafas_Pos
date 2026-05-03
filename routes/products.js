const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { auth, adminOnly, can } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, can('addProducts'), ctrl.create);
router.put('/:id', auth, can('addProducts'), ctrl.update);
router.patch('/:id/stock', auth, can('addProducts'), ctrl.adjustStock);
router.delete('/:id', auth, adminOnly, ctrl.remove);

module.exports = router;