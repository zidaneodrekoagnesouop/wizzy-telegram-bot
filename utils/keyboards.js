const { ADMIN_IDS } = require("../config/env");

const getMainKeyboard = (userId) => {
  const isAdmin = ADMIN_IDS.includes(userId);

  const keyboard = [
    [{ text: "🛍️ Browse Products" }, { text: "🛒 My Cart" }],
    [{ text: "📦 My Orders" }],
  ];

  if (isAdmin) {
    keyboard.push([{ text: "👨‍💻 Admin Panel" }]);
  }

  return {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  };
};

const getAdminKeyboard = () => ({
  reply_markup: {
    keyboard: [
      [{ text: "➕ Add Product" }, { text: "✏️ Edit Product" }],
      [{ text: "🗑️ Delete Product" }, { text: "📋 Product List" }],
      [{ text: "🔙 Back to Main Menu" }],
    ],
    resize_keyboard: true,
  },
});

const getCategoriesKeyboard = (categories) => ({
  reply_markup: {
    inline_keyboard: [
      ...categories.map((category) => [
        {
          text: `${category.name} (${category.count})`,
          callback_data: `category_${category.name}`,
        },
      ]),
    ],
  },
});

const getProductsListKeyboard = (products) => ({
  reply_markup: {
    inline_keyboard: [
      ...products.map((product) => [
        { text: product.name, callback_data: `product_${product._id}` },
      ]),
      [{ text: "🔙 Back to Categories", callback_data: "back_to_categories" }],
    ],
  },
});

const getProductDetailsKeyboard = (
  productId,
  quantity = 1,
  isAdmin = false
) => {
  const keyboard = [
    [
      { text: "➖ Decrease", callback_data: `decrease_qty_${productId}` },
      { text: `Qty: ${quantity}`, callback_data: `show_qty_${productId}` },
      { text: "➕ Increase", callback_data: `increase_qty_${productId}` },
    ],
    [
      {
        text: "✏️ Enter Quantity Manually",
        callback_data: `manual_qty_${productId}`,
      },
    ],
    [
      {
        text: "🛒 Add to Cart",
        callback_data: `add_to_cart_${productId}_${quantity}`,
      },
    ],
  ];

  if (isAdmin) {
    keyboard.push([
      { text: "✏️ Edit", callback_data: `edit_product_${productId}` },
      { text: "🗑️ Delete", callback_data: `delete_product_${productId}` },
    ]);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
};

const getCartKeyboard = (cartItems) => ({
  reply_markup: {
    inline_keyboard: [
      ...cartItems.map((item) => [
        {
          text: `➖ ${item.product.name}`,
          callback_data: `decrease_${item._id}`,
        },
        {
          text: `➕ ${item.product.name}`,
          callback_data: `increase_${item._id}`,
        },
        { text: `❌ Remove`, callback_data: `remove_${item._id}` },
      ]),
      [{ text: "💳 Checkout", callback_data: "checkout" }],
      [{ text: "🔙 Back to Products", callback_data: "back_to_products" }],
    ],
  },
});

const getPaymentMethodsKeyboard = (paymentMethods) => {
  return {
    reply_markup: {
      inline_keyboard: [
        ...paymentMethods.map((method, index) => [
          {
            text: method.name,
            callback_data: `pay_with_${index}`,
          },
        ]),
        [{ text: "❌ Cancel Checkout", callback_data: "cancel_checkout" }],
      ],
    },
  };
};

// Add this new function for sub-categories keyboard
const getSubCategoriesKeyboard = (subCategories) => ({
  reply_markup: {
    inline_keyboard: [
      ...subCategories.map((subCat) => [
        {
          text: `${subCat.name} (${subCat.count})`,
          callback_data: `subcategory_${subCat.name}_${subCat.parentCategory}`,
        },
      ]),
      [{ text: "🔙 Back to Categories", callback_data: "back_to_categories" }],
    ],
  },
});

const getCategoryContentsKeyboard = (category, contents) => {
  const keyboard = [];

  // Add sub-category buttons
  if (contents.subCategories.length > 0) {
    keyboard.push(
      ...contents.subCategories.map((subCat) => [
        {
          text: `${subCat.name} (${subCat.count})`,
          callback_data: `subcategory_${subCat.name}_${subCat.parentCategory}`,
        },
      ])
    );
  }

  // Add products without sub-categories
  if (contents.productsWithoutSub.length > 0) {
    keyboard.push(
      ...contents.productsWithoutSub.map((product) => [
        {
          text: `${product.name}`,
          callback_data: `product_${product._id}`,
        },
      ])
    );
  }

  // Add back button
  keyboard.push([
    { text: "🔙 Back to Categories", callback_data: "back_to_categories" },
  ]);

  return {
    reply_markup: {
      inline_keyboard: keyboard,
    },
  };
};

module.exports = {
  getMainKeyboard,
  getAdminKeyboard,
  getCategoriesKeyboard,
  getProductsListKeyboard,
  getProductDetailsKeyboard,
  getCartKeyboard,
  getPaymentMethodsKeyboard,
  getSubCategoriesKeyboard,
  getCategoryContentsKeyboard,
};
