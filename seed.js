require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product'); // মডেল ফোল্ডার থেকে কানেকশন নিচ্ছে

// ডুপ্লিকেট বাদ দিয়ে এবং তোমার দেওয়া রুলস অনুযায়ী লিস্ট
const myProducts = [
    { name: "Shahi Oud", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 700, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Amir al Oud", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1350, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Bleu de Chanel", category: "Attar", grade: "B", stock: 30, unit: "ml", purchaseRate: 900, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Silver", category: "Attar", grade: "", stock: 30, unit: "ml", purchaseRate: 500, sellingPrice: 230, lowStockAlert: 5 },
    { name: "SRK", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1000, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Bakhoor", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1700, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Flora", category: "Attar", grade: "B", stock: 30, unit: "ml", purchaseRate: 1000, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Hawas Ice", category: "Attar", grade: "B", stock: 30, unit: "ml", purchaseRate: 1200, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Fawakhee", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1200, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Vampire Blood", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1850, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Hawas Fire", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 2250, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Bakarat Rose", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 2150, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Khamra", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 2300, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Dior Sauvage", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1800, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Cool Water", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1650, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Dunhill Desire", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1700, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Dunhill Icon", category: "Attar", grade: "B", stock: 30, unit: "ml", purchaseRate: 800, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Versase", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1800, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Ehsas Al Arbaic", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1450, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Dove", category: "Attar", grade: "B", stock: 30, unit: "ml", purchaseRate: 800, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Musk Rizali", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 2400, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Jopy", category: "Attar", grade: "B", stock: 30, unit: "ml", purchaseRate: 300, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Red African", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1800, sellingPrice: 230, lowStockAlert: 5 },
    { name: "Disclosure", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 1700, sellingPrice: 230, lowStockAlert: 5 },
    { name: "6:00 PM", category: "Attar", grade: "A", stock: 30, unit: "ml", purchaseRate: 220, sellingPrice: 230, lowStockAlert: 5 }
];

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('⏳ Database connected. Uploading products...');

        // ডাটাবেসে এক ধাক্কায় সব ইনসার্ট করে দেবে
        await Product.insertMany(myProducts);

        console.log('✅ All 25 products successfully uploaded!');
        process.exit(); // কাজ শেষ, স্ক্রিপ্ট বন্ধ হয়ে যাবে
    })
    .catch(err => {
        console.error('❌ Error:', err);
        process.exit(1);
    });