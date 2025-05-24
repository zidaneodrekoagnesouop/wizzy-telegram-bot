const Product = require("../models/Product");

const formatProduct = (product) => {
  let message = `
<b>${product.name}</b>
${product.description}

💵 Base Price: $${product.basePrice.toFixed(2)}
`;

  if (product.priceTiers && product.priceTiers.length > 0) {
    message += `\n📊 Bulk Pricing:\n`;
    product.priceTiers
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .forEach((tier) => {
        message += `- ${tier.minQuantity}+: $${tier.price.toFixed(2)} each\n`;
      });
  }

  return message;
};

const getCategoriesWithCount = async () => {
  const categories = await Product.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return categories.map((cat) => ({ name: cat._id, count: cat.count }));
};

module.exports = {
  formatProduct,
  getCategoriesWithCount,
};
