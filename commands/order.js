const bot = require('../services/botService');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { getMainKeyboard } = require('../utils/keyboards');

module.exports = () => {
  // View orders
  bot.onText(/📦 My Orders/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).populate('items.productId');
    
    if (orders.length === 0) {
      return bot.sendMessage(
        chatId,
        'You have no orders yet.',
        getMainKeyboard(userId)
      );
    }

    for (const order of orders) {
      let message = `📦 Order #${order._id}\n`;
      message += `📅 Date: ${order.createdAt.toLocaleString()}\n`;
      message += `🔄 Status: ${order.status}\n\n`;
      
      order.items.forEach(item => {
        message += `- ${item.productId.name} x ${item.quantity} = $${(item.priceAtPurchase * item.quantity).toFixed(2)}\n`;
      });
      
      message += `\n💵 Total: $${order.totalAmount.toFixed(2)}`;
      
      bot.sendMessage(
        chatId,
        message,
        getMainKeyboard(userId)
      );
    }
  });
};