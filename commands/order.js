const bot = require('../services/botService');
const Order = require('../models/Order');
const { getMainKeyboard, getAdminKeyboard } = require('../utils/keyboards');
const { ADMIN_IDS } = require('../config/env');

module.exports = () => {
  // Customer order tracking
  bot.onText(/📦 My Orders/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).limit(10);
    
    if (orders.length === 0) {
      return bot.sendMessage(
        chatId,
        'You have no orders yet.',
        getMainKeyboard(userId)
      );
    }

    for (const order of orders) {
      let message = `📦 Order #${order._id}\n`;
      message += `🔄 Status: ${order.status}\n`;
      message += `📅 Date: ${order.createdAt.toLocaleDateString()}\n`;
      message += `💳 Amount: £${order.totalAmount.toFixed(2)}\n`;
      
      if (order.trackingNumber) {
        message += `🚚 Tracking: ${order.trackingNumber}\n`;
      }
      
      await bot.sendMessage(chatId, message, getMainKeyboard(userId));
    }
  });

  // Admin order management
  bot.onText(/\/orders/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, '⚠️ You are not authorized to view orders.');
    }

    const pendingOrders = await Order.countDocuments({ status: 'payment_received' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    
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