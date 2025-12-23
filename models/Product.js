const mongoose = require("mongoose");

const priceTierSchema = new mongoose.Schema({
  minQuantity: { type: Number, required: true },
  price: { type: Number, required: true },
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  unit: { type: String, required: true },
  priceTiers: [priceTierSchema],
  category: { type: String, required: true }, // Main category
  subCategory: { type: String }, // Sub-category
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

productSchema.methods.getPriceForQuantity = function (quantity) {
  // Sort tiers by minQuantity ascending
  const sortedTiers = [...this.priceTiers].sort(
    (a, b) => a.minQuantity - b.minQuantity
  );

  // Find the first tier where quantity >= minQuantity
  const applicableTier = sortedTiers.reverse().find(
    (tier) => quantity >= tier.minQuantity
  );

  return applicableTier ? applicableTier.price : sortedTiers.reverse()[0].price;
};

module.exports = mongoose.model("Product", productSchema);
