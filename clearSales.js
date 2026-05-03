require('dotenv').config();
const mongoose = require('mongoose');
const Sale = mongoose.models.Sale || require('./models/Sale');

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('⏳ Cleaning up sales history...');

    // ডাটাবেস থেকে সব সেলের হিস্ট্রি মুছে ফেলবে, কিন্তু স্টক ঠিক থাকবে
    await Sale.deleteMany({});

    console.log('✅ All sales history deleted perfectly without affecting stock!');
    process.exit();
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });