const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const { MONGODB_URI } = require('../config/env');

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  
  const users = await User.find({ 'cart.0': { $exists: true } });
  
  for (const user of users) {
    let needsUpdate = false;
    
    for (const item of user.cart) {
      if (!item.unitPrice) {
        const product = await Product.findById(item.productId);
        if (product) {
          item.unitPrice = product.getPriceForQuantity(item.quantity);
          needsUpdate = true;
        }
      }
    }
    
    if (needsUpdate) {
      await user.save();
      console.log(`Updated cart for user ${user.userId}`);
    }
  }
  
  console.log('Migration complete');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});