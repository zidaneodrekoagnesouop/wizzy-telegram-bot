const mongoose = require('mongoose');

const priceTierSchema = new mongoose.Schema({
  minQuantity: { type: Number, required: true },
  price: { type: Number, required: true }
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  basePrice: { type: Number, required: true },
  priceTiers: [priceTierSchema],
  category: { type: String, required: true },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

productSchema.methods.getPriceForQuantity = function(quantity) {
  // Sort tiers by minQuantity descending
  const sortedTiers = [...this.priceTiers].sort((a, b) => b.minQuantity - a.minQuantity);
  
  // Find the first tier where quantity >= minQuantity
  const applicableTier = sortedTiers.find(tier => quantity >= tier.minQuantity);
  
  return applicableTier ? applicableTier.price : this.basePrice;
};

module.exports = mongoose.model('Product', productSchema);