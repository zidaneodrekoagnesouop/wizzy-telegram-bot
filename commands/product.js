const bot = require("../services/botService");
const Product = require("../models/Product");
const {
  getCategoriesKeyboard,
  getSubCategoriesKeyboard,
  getProductsListKeyboard,
  getProductDetailsKeyboard,
  getCategoryContentsKeyboard,
} = require("../utils/keyboards");
const {
  formatProduct,
  getCategoriesWithCount,
  getSubCategoriesWithCount,
  getCategoryContents,
  getSubCategoryProducts,
} = require("../utils/helpers");
const { getUser } = require("../services/dbService");

const productQuantityCache = {};

module.exports = () => {
  // Browse products - shows categories
  bot.onText(/\/products/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const categories = await getCategoriesWithCount();

    if (categories.length === 0) {
      return bot.sendMessage(chatId, "No products available at the moment.");
    }

    bot.sendMessage(
      chatId,
      "Select a product category to fill your shopping basket",
      getCategoriesKeyboard(categories)
    );
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;
    const messageId = query.message.message_id;

    try {
      if (data === "💊 Browse Products") {
        const categories = await getCategoriesWithCount();

        if (categories.length === 0) {
          return bot.answerCallbackQuery(query.id, {
            text: "No products available at the moment.",
            show_alert: true,
          });
        }

        bot.answerCallbackQuery(query.id);

        bot
          .editMessageText(
            "Select a product category to fill your shopping basket",
            {
              chat_id: chatId,
              message_id: messageId,
              ...getCategoriesKeyboard(categories),
            }
          )
          .catch((error) => {
            // Important: Handle errors, e.g., if user clicks too fast or on an old message
            console.log(error.message); // Usually "Error: 400: Bad Request: message is not modified"
          });
      } else if (query.data === "search_product") {
        const chatId = query.message.chat.id;
        await bot.answerCallbackQuery(query.id);
        await bot.sendMessage(
          chatId,
          "🔍 Please enter a product name or keyword to search:"
        );

        // Listen for the next message from this user
        bot.once("message", async (msg) => {
          const searchTerm = msg.text.trim();
          if (!searchTerm) {
            return bot.sendMessage(
              chatId,
              "⚠️ Please enter a valid search term."
            );
          }

          // Perform a case-insensitive search
          const products = await Product.find({
            name: { $regex: searchTerm, $options: "i" },
          });

          if (products.length === 0) {
            return bot.sendMessage(
              chatId,
              `❌ No products found for “${searchTerm}”.`,
              {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: "🔙 Main Menu", callback_data: "back_to_main" }],
                  ],
                },
              }
            );
          }

          // Build inline keyboard with product buttons
          const inlineKeyboard = products.map((p) => [
            { text: p.name, callback_data: `product_${p._id}` },
          ]);

          inlineKeyboard.push([
            { text: "🔙 Main Menu", callback_data: "back_to_main" },
          ]);

          await bot.sendMessage(
            chatId,
            `🛒 Found ${products.length} result(s) for ${searchTerm}:`,
            {
              reply_markup: { inline_keyboard: inlineKeyboard },
            }
          );
        });
      } else if (data.startsWith("category_")) {
        const category = data.replace("category_", "");
        const contents = await getCategoryContents(category);

        await bot.answerCallbackQuery(query.id);
        await bot.editMessageText(`Category : <b>${category}</b>`, {
          chat_id: chatId,
          parse_mode: "HTML",
          message_id: query.message.message_id,
          ...getCategoryContentsKeyboard(category, contents),
        });
      } else if (data.startsWith("subcategory_")) {
        const [_, subCategory, category] = data.split("_");
        const products = await getSubCategoryProducts(category, subCategory);

        if (products.length === 0) {
          await bot.answerCallbackQuery(query.id, {
            text: "No products in this sub-category.",
          });
          return;
        }

        await bot.answerCallbackQuery(query.id);
        await bot.editMessageText(
          `Category : <b>${category} → ${subCategory}</b>`,
          {
            chat_id: chatId,
            parse_mode: "HTML",
            message_id: query.message.message_id,
            ...getProductsListKeyboard(products),
          }
        );
      } else if (data.startsWith("product_")) {
        const productId = data.replace("product_", "");
        const product = await Product.findById(productId);
        const user = await getUser(userId);

        if (!product) {
          await bot.answerCallbackQuery(query.id, {
            text: "Product not found.",
          });
          return;
        }

        productQuantityCache[`${chatId}_${productId}`] = 1;
        await bot.answerCallbackQuery(query.id);

        try {
          await bot.deleteMessage(chatId, query.message.message_id);
        } catch (e) {
          console.log("Couldn't delete message:", e.message);
        }

        const message = formatProduct(product);
        if (product.imageUrl) {
          await bot.sendPhoto(chatId, product.imageUrl, {
            caption: message,
            parse_mode: "HTML",
            ...getProductDetailsKeyboard(product, 1, user.isAdmin),
          });
        } else {
          await bot.sendMessage(chatId, message, {
            parse_mode: "HTML",
            ...getProductDetailsKeyboard(product, 1, user.isAdmin),
          });
        }
      } else if (data === "back_to_categories") {
        const categories = await getCategoriesWithCount();
        await bot.editMessageText(
          "Select a product category to fill your shopping basket",
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            ...getCategoriesKeyboard(categories),
          }
        );
      }
    } catch (error) {
      console.error("Error in callback query handler:", error);
      await bot.answerCallbackQuery(query.id, {
        text: "An error occurred. Please try again.",
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

      // ✅ Save product message ID so we can edit it later
      productQuantityCache[`${chatId}_productMessageId`] =
        query.message.message_id;

      // Send prompt for manual quantity
      const promptMessage = await bot.sendMessage(
        chatId,
        "Please enter the quantity you want (1-100):",
        {
          reply_markup: {
            force_reply: true,
            selective: true,
          },
        }
      );

      // Store prompt message ID for deletion later
      productQuantityCache[`${chatId}_promptMessageId`] =
        promptMessage.message_id;
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
      const productMessageId =
        productQuantityCache[`${chatId}_productMessageId`];

      if (!productId || !productMessageId) return;

      const quantity = parseFloat(text);
      if (isNaN(quantity)) {
        await bot.sendMessage(chatId, "❌ Please enter a valid number (1-100)");
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      if (quantity < 1 || quantity > 100) {
        await bot.sendMessage(
          chatId,
          "⚠️ Please enter a quantity between 1 and 100"
        );
        await bot.deleteMessage(chatId, msg.message_id);
        return;
      }

      productQuantityCache[`${chatId}_${productId}`] = quantity;

      const user = await getUser(userId);
      const product = await Product.findById(productId);
      const message = formatProduct(product);

      // ✅ Safely update the correct message
      if (product.imageUrl) {
        await bot.editMessageCaption(
          {
            caption: message,
            parse_mode: "HTML",
            ...getProductDetailsKeyboard(product, quantity, user.isAdmin),
          },
          {
            chat_id: chatId,
            message_id: productMessageId,
          }
        );
      } else {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: productMessageId,
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product, quantity, user.isAdmin),
        });
      }

      // ✅ Delete prompt and reply messages
      try {
        await bot.deleteMessage(chatId, msg.message_id);
        const promptId = productQuantityCache[`${chatId}_promptMessageId`];
        if (promptId) {
          await bot.deleteMessage(chatId, promptId);
          delete productQuantityCache[`${chatId}_promptMessageId`];
        }
      } catch (err) {
        console.warn("⚠️ Message deletion failed:", err.message);
      }

      // ✅ Clean up cache safely
      delete productQuantityCache[`${chatId}_manual`];
      delete productQuantityCache[`${chatId}_productMessageId`];
    }
  });

  async function updateProductQuantity(chatId, messageId, productId, quantity) {
    const product = await Product.findById(productId);
    const user = await getUser(chatId);
    const unitPrice = product.getPriceForQuantity(quantity);
    const totalPrice = unitPrice * quantity;

    const message = `${formatProduct(
      product
    )}\n\nQuantity: ${quantity}\nUnit Price: £${unitPrice.toFixed(
      2
    )}\nTotal: £${totalPrice.toFixed(2)}`;

    if (product.imageUrl) {
      await bot.editMessageCaption(
        {
          caption: message,
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product, quantity, user.isAdmin),
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
        ...getProductDetailsKeyboard(product, quantity, user.isAdmin),
      });
    }
  }
};
