const express = require('express');
const router = express.Router();
const Branch = require('../models/Branch');
const Product = require('../models/Product');
const { auth, adminOnly } = require('../middleware/auth');

// GET all branches
router.get('/', auth, async (req, res) => {
    try {
        const branches = await Branch.find({ isActive: true }).sort({ name: 1 });
        res.json(branches);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST create branch (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
    try {
        const branch = new Branch(req.body);
        await branch.save();
        res.status(201).json(branch);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// PUT update branch
router.put('/:id', auth, adminOnly, async (req, res) => {
    try {
        const branch = await Branch.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
        if (!branch) return res.status(404).json({ message: 'Branch not found' });
        res.json(branch);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE branch (soft delete)
router.delete('/:id', auth, adminOnly, async (req, res) => {
    try {
        // Return all branch stock to main before deleting
        const products = await Product.find({ 'branchStock.branchId': req.params.id });
        for (const product of products) {
            const entry = product.branchStock.find(b => b.branchId.toString() === req.params.id);
            if (entry && entry.qty > 0) {
                product.stock += entry.qty;
                product.branchStock = product.branchStock.filter(b => b.branchId.toString() !== req.params.id);
                await product.save();
            }
        }
        await Branch.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ message: 'Branch deleted, stock returned to main' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST transfer stock: main → branch or branch → main
router.post('/transfer', auth, adminOnly, async (req, res) => {
    try {
        const { branchId, productId, qty, direction } = req.body;
        // direction: 'give' (main→branch) or 'return' (branch→main)

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const branch = await Branch.findById(branchId);
        if (!branch) return res.status(404).json({ message: 'Branch not found' });

        const amount = parseFloat(qty);
        if (isNaN(amount) || amount <= 0) return res.status(400).json({ message: 'Invalid quantity' });

        // Find or create branch stock entry
        let branchEntry = product.branchStock.find(b => b.branchId.toString() === branchId);
        if (!branchEntry) {
            product.branchStock.push({ branchId, qty: 0 });
            branchEntry = product.branchStock[product.branchStock.length - 1];
        }

        if (direction === 'give') {
            // Main → Branch
            if (product.stock < amount) {
                return res.status(400).json({ message: `Insufficient main stock. Available: ${product.stock}${product.unit}` });
            }
            product.stock = parseFloat((product.stock - amount).toFixed(1));
            branchEntry.qty = parseFloat((branchEntry.qty + amount).toFixed(1));
        } else if (direction === 'return') {
            // Branch → Main
            if (branchEntry.qty < amount) {
                return res.status(400).json({ message: `Branch only has ${branchEntry.qty}${product.unit}` });
            }
            branchEntry.qty = parseFloat((branchEntry.qty - amount).toFixed(1));
            product.stock = parseFloat((product.stock + amount).toFixed(1));
        } else {
            return res.status(400).json({ message: 'Invalid direction' });
        }

        product.markModified('branchStock');
        await product.save();
        res.json({ message: `Stock ${direction === 'give' ? 'transferred to' : 'returned from'} ${branch.name}`, product });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET stock summary for a specific branch
router.get('/:id/stock', auth, async (req, res) => {
    try {
        const products = await Product.find({ isActive: true });
        const branchProducts = products
            .map(p => {
                const entry = p.branchStock?.find(b => b.branchId.toString() === req.params.id);
                return {
                    _id: p._id,
                    name: p.name,
                    category: p.category,
                    grade: p.grade,
                    unit: p.unit,
                    sellingPrice: p.sellingPrice,
                    purchaseRate: p.purchaseRate,
                    lowStockAlert: p.lowStockAlert,
                    qty: entry ? entry.qty : 0
                };
            })
            .filter(p => p.qty > 0);
        res.json(branchProducts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST migrate tanjimStock → branch stock (run once)
router.post('/migrate-tanjim', auth, adminOnly, async (req, res) => {
    try {
        const { branchId } = req.body;
        const products = await Product.find({ tanjimStock: { $gt: 0 } });
        let migrated = 0;

        for (const product of products) {
            const tanjimQty = product.tanjimStock || 0;
            if (tanjimQty <= 0) continue;

            let branchEntry = product.branchStock?.find(b => b.branchId.toString() === branchId);
            if (!branchEntry) {
                if (!product.branchStock) product.branchStock = [];
                product.branchStock.push({ branchId, qty: tanjimQty });
            } else {
                branchEntry.qty += tanjimQty;
            }
            product.tanjimStock = 0;
            product.markModified('branchStock');
            await product.save();
            migrated++;
        }

        res.json({ message: `Migrated ${migrated} products from tanjimStock to branch` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;