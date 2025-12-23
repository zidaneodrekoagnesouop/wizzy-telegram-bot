const bot = require("../services/botService");
const Product = require("../models/Product");
const { getUser } = require("../services/dbService");

module.exports = () => {
  bot.onText(/\/search/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    await getUser(userId);

    await bot.sendMessage(
      chatId,
      "🔍 Please enter a product name or keyword to search:"
    );

    // Listen for the next message from this user
    bot.once("message", async (msg) => {
      const searchTerm = msg.text.trim();
      if (!searchTerm) {
        return bot.sendMessage(chatId, "⚠️ Please enter a valid search term.");
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
  });
};
