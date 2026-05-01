const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/comboController');
const { auth, adminOnly } = require('../middleware/auth');

router.get('/', auth, ctrl.getAll);
router.get('/:id', auth, ctrl.getOne);
router.post('/', auth, adminOnly, ctrl.create);
router.put('/:id', auth, adminOnly, ctrl.update);
router.delete('/:id', auth, adminOnly, ctrl.remove);

module.exports = router;
