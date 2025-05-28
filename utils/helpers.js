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

const getCategoriesWithCount = async () => {
  const categories = await Product.aggregate([
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const categoriesWithSubs = await Promise.all(
    categories.map(async (cat) => {
      const subCategories = await Product.aggregate([
        {
          $match: {
            category: cat._id,
            subCategory: { $exists: true, $ne: null },
          },
        },
        { $group: { _id: "$subCategory", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]);

      return {
        name: cat._id,
        count: cat.count,
        subCategories: subCategories.map((sc) => ({
          name: sc._id,
          count: sc.count,
          parentCategory: cat._id,
        })),
        subCategoriesCount: subCategories.length,
      };
    })
  );

  return categoriesWithSubs;
};

const getCategoryContents = async (category) => {
  // Get sub-categories
  const subCategories = await Product.aggregate([
    { $match: { category, subCategory: { $exists: true, $ne: null } } },
    { $group: { _id: "$subCategory", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  // Get products without sub-categories
  const productsWithoutSub = await Product.find({
    category,
    subCategory: { $exists: false },
  });

  return {
    subCategories: subCategories.map((sc) => ({
      name: sc._id,
      count: sc.count,
      parentCategory: category,
    })),
    productsWithoutSub,
  };
};

const getSubCategoryProducts = async (category, subCategory) => {
  return await Product.find({ category, subCategory });
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
  getCategoryContents,
  getSubCategoryProducts,
};
