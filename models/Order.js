const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  priceAtPurchase: { type: Number, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    default: 'pending_payment',
    enum: [
      'pending_payment',
      'payment_received',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ]
  },
  shippingDetails: {
    name: String,
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  paymentMethod: {
    cryptocurrency: String,
    walletAddress: String,
    amountInCrypto: Number,
    transactionHash: String,
    paymentExpiresAt: Date
  },
  trackingNumber: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

orderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Order', orderSchema);