const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/productController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, adminOnly, ctrl.create);
router.put('/:id', auth, adminOnly, ctrl.update);
router.patch('/:id/stock', auth, adminOnly, ctrl.adjustStock);
router.delete('/:id', auth, adminOnly, ctrl.remove);

module.exports = router;
