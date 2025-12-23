const { ADMIN_IDS } = require("../config/env");

const getMainKeyboard = (userId, specialCat) => {
  const isAdmin = ADMIN_IDS.includes(userId);

  const inline_keyboard = [
    [
      {
        text: "💊 Listings", // Text shown on the button
        callback_data: "💊 Browse Products", // Data sent to your bot on click
      },
    ],
    [
      {
        text: "🔍 Search product",
        callback_data: "search_product",
      },
    ],
    // [
    //   {
    //     text: "💬 UKP TELEGRAM GROUP 💬",
    //     callback_data: "telegram_groups",
    //   },
    // ],
    // ...specialCat.map((category) => [
    //   {
    //     text: `${category.name}`,
    //     callback_data: `category_${category.name}`,
    //   },
    // ]),
    // [
    //   {
    //     text: "🚨 READ BEFORE ORDER 🚨",
    //     callback_data: "read_before_order",
    //   },
    // ],
    // [
    //   {
    //     text: "🔐 matrix LINKS 🔐",
    //     callback_data: "matrix_links",
    //   },
    // ],
    // [
    //   {
    //     text: "🤠 ABOUT UKP 🍸",
    //     callback_data: "about_ukp",
    //   },
    // ],
    [
      {
        text: "📦 Orders",
        callback_data: "my_orders",
      },
      {
        text: "🛒 View Cart",
        callback_data: "go_to_cart",
      },
    ],
    [
      {
        text: "📭 Contact",
        url: "https://t.me/UKProviderEvo",
      },
    ],
  ];

  if (isAdmin) {
    inline_keyboard.push([
      { text: "👨‍💻 Admin Panel", callback_data: "admin_panel" },
    ]);
  }

  return {
    reply_markup: {
      inline_keyboard,
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
      [
        { text: "🔙 Main Menu", callback_data: "back_to_main" },
        { text: "🛒 View Cart", callback_data: "go_to_cart" },
      ],
    ],
  },
});

const getProductsListKeyboard = (products) => ({
  reply_markup: {
    inline_keyboard: [
      ...products.map((product) => [
        { text: product.name, callback_data: `product_${product._id}` },
      ]),
      [
        { text: "🔙 Back to Categories", callback_data: "back_to_categories" },
        { text: "🛒 View Cart", callback_data: "go_to_cart" },
      ],
    ],
  },
});

const getProductDetailsKeyboard = (product, quantity = 1, isAdmin = false) => {
  const unitPrice = product.getPriceForQuantity(quantity);
  const totalPrice = unitPrice * quantity;
  const keyboard = [
    [
      {
        text: "✏️ Enter Quantity Manually",
        callback_data: `manual_qty_${product._id}`,
      },
    ],
    [
      { text: "➖ Decrease", callback_data: `decrease_qty_${product._id}` },
      {
        text: "🛒 View Cart",
        callback_data: "go_to_cart",
      },
      { text: "➕ Increase", callback_data: `increase_qty_${product._id}` },
    ],
    [
      {
        text: `Add to Cart : ${quantity} unit [£${totalPrice.toFixed(2)}]`,
        callback_data: `add_to_cart_${product._id}_${quantity}`,
      },
    ],
    [
      { text: "🔙 Back to Categories", callback_data: "back_to_categories" },
      { text: "🔙 Main Menu", callback_data: "back_to_main" },
    ],
  ];

  if (isAdmin) {
    keyboard.push([
      { text: "✏️ Edit", callback_data: `edit_product_${product._id}` },
      { text: "🗑️ Delete", callback_data: `delete_product_${product._id}` },
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
          text: `❌ ${item.product.name} — ${item.quantity.toFixed(2)} ${
            item.product.unit
          } × £${item.unitPrice.toFixed(2)} = £${(
            item.unitPrice * item.quantity
          ).toFixed(2)}`,
          callback_data: `remove_${item._id}`,
        },
      ]),
      [
        { text: "🔙 Main Menu", callback_data: "back_to_main" },
        { text: "💳 Checkout", callback_data: "checkout" },
      ],
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
    { text: "🛒 View Cart", callback_data: "go_to_cart" },
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
