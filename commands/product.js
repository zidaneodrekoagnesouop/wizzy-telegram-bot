const bot = require("../services/botService");
const Product = require("../models/Product");
const {
  getCategoriesKeyboard,
  getProductsListKeyboard,
  getProductDetailsKeyboard,
} = require("../utils/keyboards");
const { formatProduct, getCategoriesWithCount } = require("../utils/helpers");
const { getUser } = require("../services/dbService");

const productQuantityCache = {};

module.exports = () => {
  // Browse products
  bot.onText(/🛍️ Browse Products/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const categories = await getCategoriesWithCount();

    if (categories.length === 0) {
      return bot.sendMessage(chatId, "No products available at the moment.");
    }

    bot.sendMessage(
      chatId,
      "Please select a category:",
      getCategoriesKeyboard(categories)
    );
  });

  // Handle category selection
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (data.startsWith("category_")) {
      const category = data.replace("category_", "");
      const products = await Product.find({ category });

      if (products.length === 0) {
        await bot.answerCallbackQuery(query.id, {
          text: "No products in this category.",
        });
        return;
      }

      await bot.answerCallbackQuery(query.id);
      await bot.editMessageText(`Products in ${category}:`, {
        chat_id: chatId,
        message_id: query.message.message_id,
        ...getProductsListKeyboard(products),
      });
    } else if (data.startsWith("product_")) {
      const productId = data.replace("product_", "");
      const product = await Product.findById(productId);
      const user = await getUser(userId);

      if (!product) {
        await bot.answerCallbackQuery(query.id, { text: "Product not found." });
        return;
      }

      // Initialize quantity for this product
      productQuantityCache[`${chatId}_${productId}`] = 1;

      await bot.answerCallbackQuery(query.id);

      const message = formatProduct(product);
      if (product.imageUrl) {
        await bot.sendPhoto(chatId, product.imageUrl, {
          caption: message,
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product._id, 1, user.isAdmin),
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product._id, 1, user.isAdmin),
        });
      }
    } else if (data === "back_to_categories") {
      const categories = await getCategoriesWithCount();

      await bot.editMessageText("Please select a category:", {
        chat_id: chatId,
        message_id: query.message.message_id,
        ...getCategoriesKeyboard(categories),
      });
    }
  });

  // Handle quantity adjustments
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const messageId = query.message.message_id;

    // Handle quantity increase
    if (data.startsWith("increase_qty_")) {
      const productId = data.replace("increase_qty_", "");
      const cacheKey = `${chatId}_${productId}`;
      const currentQty = productQuantityCache[cacheKey] || 1;
      productQuantityCache[cacheKey] = currentQty + 1;

      await updateProductQuantity(
        chatId,
        messageId,
        productId,
        productQuantityCache[cacheKey]
      );
      await bot.answerCallbackQuery(query.id, { text: "Quantity increased" });
    }
    // Handle quantity decrease
    else if (data.startsWith("decrease_qty_")) {
      const productId = data.replace("decrease_qty_", "");
      const cacheKey = `${chatId}_${productId}`;
      const currentQty = productQuantityCache[cacheKey] || 1;

      if (currentQty > 1) {
        productQuantityCache[cacheKey] = currentQty - 1;
        await updateProductQuantity(
          chatId,
          messageId,
          productId,
          productQuantityCache[cacheKey]
        );
        await bot.answerCallbackQuery(query.id, { text: "Quantity decreased" });
      } else {
        await bot.answerCallbackQuery(query.id, {
          text: "Minimum quantity is 1",
        });
      }
    }
    // Handle manual quantity input
    else if (data.startsWith("manual_qty_")) {
      const productId = data.replace("manual_qty_", "");
      productQuantityCache[`${chatId}_manual`] = productId;

      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        chatId,
        "Please enter the quantity you want (1-100):",
        {
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        }
      );
    }
    // Just show current quantity (no action needed)
    else if (data.startsWith("show_qty_")) {
      await bot.answerCallbackQuery(query.id, { text: "Current quantity" });
    }
  });

  // Handle manual quantity input message
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    const replyToMessage = msg.reply_to_message;

    if (
      replyToMessage &&
      replyToMessage.text === "Please enter the quantity you want (1-100):"
    ) {
      const productId = productQuantityCache[`${chatId}_manual`];

      if (!productId) return;

      const quantity = parseInt(text);
      if (isNaN(quantity)) {
        return bot.sendMessage(chatId, "Please enter a valid number");
      }

      if (quantity < 1 || quantity > 100) {
        return bot.sendMessage(
          chatId,
          "Please enter a quantity between 1 and 100"
        );
      }

      productQuantityCache[`${chatId}_${productId}`] = quantity;

      // Find the original product message to update
      const user = await getUser(userId);
      const product = await Product.findById(productId);
      const message = formatProduct(product);

      if (product.imageUrl) {
        await bot.editMessageCaption(
          {
            caption: message,
            parse_mode: "HTML",
            ...getProductDetailsKeyboard(product._id, quantity, user.isAdmin),
          },
          {
            chat_id: chatId,
            message_id: replyToMessage.message_id - 1, // The product message is before the prompt
          }
        );
      } else {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: replyToMessage.message_id - 1,
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product._id, quantity, user.isAdmin),
        });
      }

      await bot.deleteMessage(chatId, msg.message_id);
      delete productQuantityCache[`${chatId}_manual`];
    }
  });

  async function updateProductQuantity(chatId, messageId, productId, quantity) {
    const product = await Product.findById(productId);
    const user = await getUser(chatId);
    const unitPrice = product.getPriceForQuantity(quantity);
    const totalPrice = unitPrice * quantity;

    const message = `${formatProduct(
      product
    )}\n\nQuantity: ${quantity}\nUnit Price: $${unitPrice.toFixed(
      2
    )}\nTotal: $${totalPrice.toFixed(2)}`;

    if (product.imageUrl) {
      await bot.editMessageCaption(
        {
          caption: message,
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product._id, quantity, user.isAdmin),
        },
        {
          chat_id: chatId,
          message_id: messageId,
        }
      );
    } else {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        ...getProductDetailsKeyboard(product._id, quantity, user.isAdmin),
      });
    }
  }
};
