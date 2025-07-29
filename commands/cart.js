const bot = require("../services/botService");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const paymentMethods = require("../config/paymentMethods");
const { ADMIN_IDS } = require("../config/env");
const {
  getCartKeyboard,
  getMainKeyboard,
  getPaymentMethodsKeyboard,
} = require("../utils/keyboards");

// Store checkout states in memory
const checkoutStates = new Map();

module.exports = () => {
  // View cart
  bot.onText(/🛒 My Cart/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const user = await User.findOne({ userId }).populate("cart.productId");

    if (!user || user.cart.length === 0) {
      return bot.sendMessage(
        chatId,
        "Your cart is empty.",
        getMainKeyboard(userId)
      );
    }

    await updateCartMessage(chatId, null, user);
  });

  // Handle cart actions
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    const user = await User.findOne({ userId }).populate("cart.productId");
    if (!user) return;

    // Add to cart handler - THIS IS THE FIXED VERSION
    if (data.startsWith("add_to_cart_")) {
      const parts = data.split("_");
      const productId = parts[3]; // Changed index to match the callback data
      const quantity = parseInt(parts[4]) || 1;

      const product = await Product.findById(productId);
      if (!product) {
        return bot.answerCallbackQuery(query.id, {
          text: "Product not found!",
        });
      }

      const unitPrice = product.getPriceForQuantity(quantity);

      // Check if product already in cart
      const existingItemIndex = user.cart.findIndex(
        (item) => item.productId.toString() === productId
      );

      if (existingItemIndex >= 0) {
        // Update existing item
        user.cart[existingItemIndex].quantity += quantity;
        user.cart[existingItemIndex].unitPrice = unitPrice;
      } else {
        // Add new item
        user.cart.push({
          productId,
          quantity,
          unitPrice,
        });
      }

      await user.save();
      await bot.answerCallbackQuery(query.id, {
        text: "Product added to cart!",
      });
      return;
    }

    // Increase quantity
    else if (data.startsWith("increase_")) {
      const itemId = data.replace("increase_", "");
      const itemIndex = user.cart.findIndex(
        (item) => item._id.toString() === itemId
      );

      if (itemIndex >= 0) {
        const product = user.cart[itemIndex].productId;
        user.cart[itemIndex].quantity += 1;
        user.cart[itemIndex].unitPrice = product.getPriceForQuantity(
          user.cart[itemIndex].quantity
        );
        await user.save();
        await bot.answerCallbackQuery(query.id, {
          text: "Quantity increased!",
        });
        await updateCartMessage(chatId, query.message.message_id, user);
      }
    }

    // Decrease quantity
    else if (data.startsWith("decrease_")) {
      const itemId = data.replace("decrease_", "");
      const itemIndex = user.cart.findIndex(
        (item) => item._id.toString() === itemId
      );

      if (itemIndex >= 0) {
        if (user.cart[itemIndex].quantity > 1) {
          const product = user.cart[itemIndex].productId;
          user.cart[itemIndex].quantity -= 1;
          user.cart[itemIndex].unitPrice = product.getPriceForQuantity(
            user.cart[itemIndex].quantity
          );
          await user.save();
          await bot.answerCallbackQuery(query.id, {
            text: "Quantity decreased!",
          });
          await updateCartMessage(chatId, query.message.message_id, user);
        } else {
          await bot.answerCallbackQuery(query.id, {
            text: "Minimum quantity is 1. Use remove to delete.",
          });
        }
      }
    }

    // Remove item
    else if (data.startsWith("remove_")) {
      const itemId = data.replace("remove_", "");
      user.cart = user.cart.filter((item) => item._id.toString() !== itemId);
      await user.save();
      await bot.answerCallbackQuery(query.id, {
        text: "Item removed from cart!",
      });

      if (user.cart.length === 0) {
        await bot.deleteMessage(chatId, query.message.message_id);
        await bot.sendMessage(
          chatId,
          "Your cart is now empty.",
          getMainKeyboard(userId)
        );
      } else {
        await updateCartMessage(chatId, query.message.message_id, user);
      }
    }

    // Checkout
    else if (data === "checkout") {
      if (user.cart.length === 0) {
        return bot.answerCallbackQuery(query.id, {
          text: "Your cart is empty!",
        });
      }

      // Initialize checkout state
      checkoutStates.set(userId, {
        step: "shipping_name",
        cartItems: user.cart.map((item) => ({
          productId: item.productId._id,
          quantity: item.quantity,
          unitPrice: item.unitPrice, // Ensure this is set
          priceAtPurchase: item.unitPrice, // Add this for clarity
        })),
        totalAmount: user.cart.reduce(
          (sum, item) => sum + item.unitPrice * item.quantity,
          0
        ),
      });

      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(
        chatId,
        "Please enter your full name for shipping:",
        { reply_markup: { force_reply: true } }
      );
      return;
    }

    // Payment method selection
    if (data.startsWith("pay_with_")) {
      const checkoutState = checkoutStates.get(userId);
      if (!checkoutState) return;

      const user = await User.findOne({ userId });
      if (!user) return;

      const methodIndex = parseInt(data.replace("pay_with_", ""));
      const selectedMethod = paymentMethods[methodIndex];

      const amountInCrypto =
        checkoutState.totalAmount * selectedMethod.conversionRate;
      const paymentExpiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);

      // Create order with all required fields
      const order = new Order({
        userId,
        items: checkoutState.cartItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          priceAtPurchase: item.unitPrice,
        })),
        totalAmount: checkoutState.totalAmount,
        shippingDetails: checkoutState.shippingDetails,
        paymentMethod: {
          cryptocurrency: selectedMethod.ticker,
          walletAddress: selectedMethod.walletAddress,
          amountInCrypto: amountInCrypto,
          paymentExpiresAt: paymentExpiresAt,
        },
        status: "pending_payment",
      });

      await order.save();

      // Clear cart and state
      user.cart = [];
      await user.save();
      checkoutStates.delete(userId);

      // Send payment instructions
      await bot.deleteMessage(chatId, query.message.message_id);
      await bot.sendMessage(
        chatId,
        `Please send exactly ${amountInCrypto.toFixed(8)} ${
          selectedMethod.ticker
        } to:\n` +
          `<code>${selectedMethod.walletAddress}</code>\n\n` +
          `Amount in GBP: £${checkoutState.totalAmount.toFixed(2)}\n` +
          `Payment expires at: ${paymentExpiresAt.toLocaleString()}\n\n` +
          `After payment, your order will be processed once we confirm the transaction.`,
        { parse_mode: "HTML" }
      );

      // NEW CODE: Notify all admins about the new order
      const adminMessage =
        `🆕 New Order Received!\n\n` +
        `📦 Order ID: ${order._id}\n` +
        `👤 Customer: ${query.from.first_name || "Unknown"} (ID: ${userId}${
          query.from.username ? `, @${query.from.username}` : ""
        })\n` +
        `💰 Amount: £${order.totalAmount.toFixed(2)}\n` +
        `📅 Date: ${order.createdAt.toLocaleString()}\n` +
        `🔄 Status: ${order.status}\n\n` +
        `📝 Items:\n${order.items
          .map(
            (item) =>
              `- ${item.productId} (Qty: ${
                item.quantity
              }) @ £${item.priceAtPurchase.toFixed(2)}`
          )
          .join("\n")}\n\n` +
        `🏠 Shipping to:\n${order.shippingDetails.name}\n` +
        `${order.shippingDetails.street}\n` +
        `${order.shippingDetails.city}, ${order.shippingDetails.postalCode}\n` +
        `${order.shippingDetails.country}\n\n` +
        `💳 Payment Method: ${selectedMethod.name}\n` +
        `Amount: ${amountInCrypto.toFixed(8)} ${selectedMethod.ticker}\n\n` +
        `Use /order_details ${order._id} for more info\n` +
        `Use /confirm_payment ${order._id} once payment is received`;

      // Send notification to all admins
      ADMIN_IDS.forEach(async (adminId) => {
        try {
          await bot.sendMessage(adminId, adminMessage, { parse_mode: "HTML" });
        } catch (error) {
          console.error(
            `Failed to send order notification to admin ${adminId}:`,
            error.message
          );
        }
      });

      // Schedule expiration check
      setTimeout(async () => {
        const updatedOrder = await Order.findById(order._id);
        if (updatedOrder.status === "pending_payment") {
          updatedOrder.status = "cancelled";
          await updatedOrder.save();
          await bot.sendMessage(
            chatId,
            "Your order has been cancelled because payment was not received within 3 hours."
          );
        }
      }, 3 * 60 * 60 * 1000);
    }

    // Cancel checkout
    else if (data === "cancel_checkout") {
      user.checkoutState = null;
      await user.save();
      await bot.deleteMessage(chatId, query.message.message_id);
      await bot.sendMessage(
        chatId,
        "Checkout cancelled. Your cart has been preserved.",
        getMainKeyboard(userId)
      );
    }
  });

  // Handle shipping details input
  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    const checkoutState = checkoutStates.get(userId);
    if (!checkoutState) return;

    const replyToMessage = msg.reply_to_message;
    if (!replyToMessage) return;

    // Handle shipping name
    if (replyToMessage.text === "Please enter your full name for shipping:") {
      checkoutState.shippingDetails = { name: text };
      checkoutState.step = "shipping_street";
      checkoutStates.set(userId, checkoutState);

      await bot.sendMessage(
        chatId,
        "Please enter your street name and number:",
        { reply_markup: { force_reply: true } }
      );
      return;
    }

    // Handle street address
    if (replyToMessage.text === "Please enter your street name and number:") {
      checkoutState.shippingDetails.street = text;
      checkoutState.step = "shipping_city";
      checkoutStates.set(userId, checkoutState);

      await bot.sendMessage(chatId, "Please enter your city:", {
        reply_markup: { force_reply: true },
      });
      return;
    }

    // Handle city
    if (replyToMessage.text === "Please enter your city:") {
      checkoutState.shippingDetails.city = text;
      checkoutState.step = "shipping_postal";
      checkoutStates.set(userId, checkoutState);

      await bot.sendMessage(chatId, "Please enter your postal code:", {
        reply_markup: { force_reply: true },
      });
      return;
    }

    // Handle postal code
    if (replyToMessage.text === "Please enter your postal code:") {
      checkoutState.shippingDetails.postalCode = text;
      checkoutState.step = "shipping_country";
      checkoutStates.set(userId, checkoutState);

      await bot.sendMessage(chatId, "Please enter your country:", {
        reply_markup: { force_reply: true },
      });
      return;
    }

    // Handle country
    if (replyToMessage.text === "Please enter your country:") {
      checkoutState.shippingDetails.country = text;
      checkoutState.step = "payment_method";
      checkoutStates.set(userId, checkoutState);

      // Show payment methods
      await bot.sendMessage(
        chatId,
        "Please select your payment method:",
        getPaymentMethodsKeyboard(paymentMethods)
      );
      return;
    }
  });

  async function updateCartMessage(chatId, messageId, user) {
    const populatedUser = await User.findOne({ _id: user._id })
      .populate("cart.productId")
      .exec();

    const cartItems = populatedUser.cart.map((item) => ({
      _id: item._id,
      product: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    const total = cartItems.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);

    let message = "🛒 Your Cart:\n\n";
    cartItems.forEach((item) => {
      message += `${item.product.name} - ${
        item.quantity
      } × £${item.unitPrice.toFixed(2)} = £${(
        item.unitPrice * item.quantity
      ).toFixed(2)}\n`;
    });
    message += `\nTotal: £${total.toFixed(2)}`;

    try {
      if (messageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          ...getCartKeyboard(cartItems),
        });
      } else {
        await bot.sendMessage(chatId, message, getCartKeyboard(cartItems));
      }
    } catch (error) {
      console.log("Error updating cart message:", error.message);
    }
  }
};
