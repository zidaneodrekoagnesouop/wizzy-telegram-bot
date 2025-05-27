const Product = require("../models/Product");

const formatProduct = (product) => {
  let message = `
<b>${product.name}</b>
${product.description}

💵 Base Price: £${product.basePrice.toFixed(2)}
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

// Get all categories with counts and sub-category info
const getCategoriesWithCount = async () => {
  const categories = await Product.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Get sub-category counts for each category
  const categoriesWithSubs = await Promise.all(
    categories.map(async (cat) => {
      const subCategories = await Product.aggregate([
        { $match: { category: cat._id } },
        { $group: { _id: "$subCategory", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      return {
        name: cat._id,
        count: cat.count,
        subCategories: subCategories
          .filter((sc) => sc._id)
          .map((sc) => ({
            name: sc._id,
            count: sc.count,
            parentCategory: cat._id,
          })),
        subCategoriesCount: subCategories.filter((sc) => sc._id).length,
      };
    })
  );

  return categoriesWithSubs;
};

// Get sub-categories for a specific category
const getSubCategoriesWithCount = async (category) => {
  const subCategories = await Product.aggregate([
    { $match: { category } },
    { $group: { _id: "$subCategory", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return subCategories
    .filter((sc) => sc._id)
    .map((sc) => ({
      name: sc._id,
      count: sc.count,
      parentCategory: category,
    }));
};

module.exports = {
  formatProduct,
  getCategoriesWithCount,
  getCategoriesWithCount,
  getSubCategoriesWithCount,
};
