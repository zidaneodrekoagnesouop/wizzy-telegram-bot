const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    required: true 
  },
  quantity: { 
    type: Number, 
    default: 1,
    min: 1
  },
  unitPrice: { 
    type: Number, 
    required: true 
  }
});

const userSchema = new mongoose.Schema({
  userId: { type: Number, required: true, unique: true },
  username: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  isAdmin: { type: Boolean, default: false },
  cart: [cartItemSchema],
  createdAt: { type: Date, default: Date.now },
});

// Add a pre-save hook to ensure unitPrice is set
cartItemSchema.pre('save', async function(next) {
  if (!this.unitPrice) {
    const product = await mongoose.model('Product').findById(this.productId);
    if (product) {
      this.unitPrice = product.getPriceForQuantity(this.quantity);
    }
  }
  next();
});

module.exports = mongoose.model('User', userSchema);