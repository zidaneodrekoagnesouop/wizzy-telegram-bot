const bot = require("../services/botService");
const Order = require("../models/Order");
const { getMainKeyboard, getAdminKeyboard } = require("../utils/keyboards");
const { getCategoriesWithCount } = require("../utils/helpers");
const Product = require("../models/Product");
const { ADMIN_IDS } = require("../config/env");

module.exports = () => {
  async function showMyOrders(bot, chat_id, user_id) {
    const chatId = chat_id;
    const userId = user_id;

    const specialCategories = (await getCategoriesWithCount()).filter(
      (cat) => cat.name === "💰 TIP THE UKP TEAM 🏆" || cat.name === "🚛 BULK 🚛"
    );

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // If no orders, show a friendly message
    if (orders.length === 0) {
      return bot.sendMessage(
        chatId,
        "You don't have any orders.",
        getMainKeyboard(userId, specialCategories)
      );
    }

    // Start building a single message for all orders
    let message = `<b>🧾 You have ${orders.length} order${
      orders.length > 1 ? "s" : ""
    }:</b>\n\n`;

    for (let index = 0; index < orders.length; index++) {
      const order = orders[index];
      message += `📦 <b>Order #${index + 1}</b>\n`;
      message += `🆔 ID: <code>${order._id}</code>\n`;
      message += `🔄 Status: <b>${order.status}</b>\n`;
      message += `📅 Date: ${order.createdAt.toLocaleDateString()}\n\n`;

      // List purchased items
      if (order.items && order.items.length > 0) {
        for (let i = 0; i < order.items.length; i++) {
          const item = order.items[i];
          const product = await Product.findById(item.productId);
          if (product) {
            message += `${i + 1}. <b>${
              product.name
            }</b> <code>${item.quantity.toFixed(2)}</code> ${
              product.unit
            } — <b>£${(item.priceAtPurchase * item.quantity).toFixed(2)}</b>\n`;
          }
        }
      }

      if (order.deliveryMethod?.type) {
        message += `\n🚚 Delivery method: <b>${order.deliveryMethod.type}</b>\n`;
      }

      message += `\n💳 <b>Total: £${order.totalAmount.toFixed(2)}</b>\n`;

      // If payment is pending, calculate time left and show crypto details
      if (order.status === "pending_payment" && order.paymentMethod) {
        const paymentDeadline = new Date(
          order.createdAt.getTime() + 3 * 60 * 60 * 1000
        ); // 3 hours from creation
        const now = new Date();
        let timeLeftMs = paymentDeadline - now;

        if (timeLeftMs > 0) {
          const hours = Math.floor(timeLeftMs / (1000 * 60 * 60));
          const minutes = Math.floor(
            (timeLeftMs % (1000 * 60 * 60)) / (1000 * 60)
          );
          const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);
          message += `\n⏱ Payment time left: ${hours}h ${minutes}m ${seconds}s\n`;
        } else {
          message += `\n⏱ Payment time left: 0h 0m 0s\n`;
        }

        message += `💰 Send exactly: <code>${order.paymentMethod.amountInCrypto.toFixed(
          8
        )}</code> <b>${order.paymentMethod.cryptocurrency}</b>\n`;
        message += `🏦 Wallet address: <code>${order.paymentMethod.walletAddress}</code>\n`;
      }

      if (order.trackingNumber) {
        message += `\n📦 Tracking: <code>${order.trackingNumber}</code>\n`;
      }

      // Add separator except after the last order
      if (index < orders.length - 1) {
        message += `\n─────────────────────\n\n`;
      }
    }

    // Send all orders as one formatted message with the main keyboard
    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      ...getMainKeyboard(userId, specialCategories),
    });
  }

  // Customer order tracking
  bot.onText(/\/my_orders/, async (msg) =>
    showMyOrders(bot, msg.chat.id, msg.from.id)
  );

  // inline button
  bot.on("callback_query", async (query) => {
    if (query.data === "my_orders") {
      await bot.answerCallbackQuery(query.id);
      await showMyOrders(bot, query.message.chat.id, query.from.id);
    }
  });

  // Admin order management
  bot.onText(/\/orders/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to view orders."
      );
    }

    const pendingOrders = await Order.countDocuments({
      status: "payment_received",
    });
    const processingOrders = await Order.countDocuments({
      status: "processing",
    });

    await bot.sendMessage(
      chatId,
      `📊 Order Dashboard:\n\n` +
        `⏳ Pending Processing: ${pendingOrders}\n` +
        `🛠️ In Progress: ${processingOrders}\n\n` +
        `Use these commands:\n` +
        `/list_orders - View recent orders\n` +
        `/process_order <id> - Mark as processing\n` +
        `/ship_order <id> <tracking> - Mark as shipped\n` +
        `/complete_order <id> - Mark as delivered`,
      getAdminKeyboard()
    );
  });

  // ... [additional order management commands]
};
