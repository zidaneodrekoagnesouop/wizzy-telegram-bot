const bot = require("../services/botService");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const paymentMethods = require("../config/paymentMethods");
const { ADMIN_IDS } = require("../config/env");
const { getCategoriesWithCount } = require("../utils/helpers");
const {
  getCartKeyboard,
  getMainKeyboard,
  getPaymentMethodsKeyboard,
} = require("../utils/keyboards");

// Store checkout states in memory
const checkoutStates = new Map();

module.exports = () => {
  // View cart
  bot.onText(/\/view_cart/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const specialCategories = (await getCategoriesWithCount()).filter(
      (cat) =>
        cat.name === "💰 TIP THE UKP TEAM 🏆" || cat.name === "🚛 BULK 🚛"
    );

    const user = await User.findOne({ userId }).populate("cart.productId");

    if (!user || user.cart.length === 0) {
      return bot.sendMessage(
        chatId,
        "Your cart is empty.",
        getMainKeyboard(userId, specialCategories)
      );
    }

    await updateCartMessage(chatId, null, user);
  });

  // Handle cart actions
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const specialCategories = (await getCategoriesWithCount()).filter(
      (cat) =>
        cat.name === "💰 TIP THE UKP TEAM 🏆" || cat.name === "🚛 BULK 🚛"
    );

    const user = await User.findOne({ userId }).populate("cart.productId");
    if (!user) return;

    if (data === "go_to_cart") {
      const user = await User.findOne({ userId }).populate("cart.productId");

      if (!user || user.cart.length === 0) {
        return bot.editMessageText("Your cart is empty.", {
          chat_id: chatId,
          message_id: messageId,
          ...getMainKeyboard(userId, specialCategories),
        });
      }

      await updateCartMessage(chatId, messageId, user);
    }

    // Add to cart handler - THIS IS THE FIXED VERSION
    else if (data.startsWith("add_to_cart_")) {
      const parts = data.split("_");
      const productId = parts[3];
      const quantity = parseFloat(parts[4]) || 1;

      const product = await Product.findById(productId);
      if (!product) {
        return bot.answerCallbackQuery(query.id, {
          text: "❌ Product not found!",
          show_alert: true,
        });
      }

      // 🔄 Always fetch the latest user data
      const freshUser = await User.findOne({ userId: userId });

      // ✅ Determine minimum allowed quantity
      const minAllowedQuantity = Math.min(
        ...product.priceTiers.map((tier) => tier.minQuantity)
      );

      // ✅ Check if product already exists in the user's updated cart
      const existingItemIndex = freshUser.cart.findIndex(
        (item) => item.productId.toString() === productId
      );

      let currentCartQuantity = 0;
      if (existingItemIndex >= 0) {
        currentCartQuantity = freshUser.cart[existingItemIndex].quantity;
      }

      const finalTotalQuantity = currentCartQuantity + quantity;

      // ✅ Only block if the final total is still below the minimum
      if (finalTotalQuantity < minAllowedQuantity) {
        const remainingNeeded = minAllowedQuantity - currentCartQuantity;

        return bot.answerCallbackQuery(query.id, {
          text: `⚠️ Minimum order quantity for "${product.name}" is ${minAllowedQuantity}. \n\nYou currently have ${currentCartQuantity} in your cart. Add ${remainingNeeded} or more.`,
          show_alert: true,
        });
      }

      // ✅ Determine unit price based on final total quantity
      const unitPrice = product.getPriceForQuantity(finalTotalQuantity);

      if (existingItemIndex >= 0) {
        // Update existing cart item
        freshUser.cart[existingItemIndex].quantity = finalTotalQuantity;
        freshUser.cart[existingItemIndex].unitPrice = unitPrice;
      } else {
        // Add new item
        freshUser.cart.push({
          productId,
          quantity,
          unitPrice,
        });
      }

      await freshUser.save();

      await bot.answerCallbackQuery(query.id, {
        text: `✅ ${product.name} added to cart! Total: ${finalTotalQuantity} ${product.unit}(s)`,
        show_alert: true,
      });
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
          getMainKeyboard(userId, specialCategories)
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

    // ✅ Handle delivery method selection
    else if (data.startsWith("delivery_")) {
      const checkoutState = checkoutStates.get(userId);
      if (!checkoutState) return;

      let deliveryFee = 0;
      let deliveryLabel = "";

      if (data === "delivery_within_uk") {
        deliveryFee = 5;
        deliveryLabel = "TRACKED24 - £5";
      } else if (data === "delivery_outside_uk") {
        deliveryFee = 50;
        deliveryLabel = "Outside UK - Tracked - £50";
      }

      checkoutState.deliveryMethod = {
        type: deliveryLabel,
        fee: deliveryFee,
      };

      // ✅ Add delivery fee to total
      checkoutState.totalAmount += deliveryFee;
      checkoutState.step = "payment_method";
      checkoutStates.set(userId, checkoutState);

      await bot.answerCallbackQuery(query.id, {
        text: `✅ Delivery method selected: ${deliveryLabel}`,
        show_alert: true,
      });

      // Proceed to payment methods
      await bot.editMessageText(
        `✅ Delivery method: <b>${deliveryLabel}</b>\n\n💰 Total amount (including delivery): <b>£${checkoutState.totalAmount.toFixed(
          2
        )}</b>\n\nPlease select your payment method:`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "HTML",
          ...getPaymentMethodsKeyboard(paymentMethods),
        }
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
        deliveryMethod: checkoutState.deliveryMethod,
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

      // 🧾 Calculate time left in hours and minutes
      const now = new Date();
      const timeLeftMs = paymentExpiresAt - now;
      const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
      const minutesLeft = Math.floor(
        (timeLeftMs % (1000 * 60 * 60)) / (1000 * 60)
      );
      const timeLeft = `${hoursLeft}h ${minutesLeft}m`;

      // 🛒 Build order item list with numbering
      let itemsList = "";
      for (let i = 0; i < order.items.length; i++) {
        const item = order.items[i];
        const product = await Product.findById(item.productId);
        if (product) {
          itemsList += `${i + 1}. <b>${
            product.name
          }</b> <code>${item.quantity.toFixed(2)}</code> ${
            product.unit
          } — <b>£${(item.priceAtPurchase * item.quantity).toFixed(2)}</b>\n`;
        }
      }

      // 📩 Send detailed payment instruction message
      await bot.sendMessage(
        chatId,
        `💳 <b>Order ID:</b> <code>${order._id}</code>\n\n` +
          `🔄 Status: ${order.status}\n` +
          `⏰ <b>Time left to pay:</b> ${timeLeft}\n\n` +
          `Payment Address: <code>${selectedMethod.walletAddress}</code>\n\n` +
          `Amount: <code>${amountInCrypto.toFixed(8)}</code> ${
            selectedMethod.ticker
          }\n\n` +
          `Network: <b>${selectedMethod.name}</b>\n\n` +
          `Please ensure that you send the exact ${selectedMethod.ticker} amount specified. It's important to note that certain exchanges or wallets may deduct fees from your payment, so kindly double-check the amount before sending your payment to make sure you sent the correct amount.\n\n` +
          `${itemsList}\n` +
          `🚚 <b>Delivery:</b> ${
            checkoutState.deliveryMethod?.type || "Not specified"
          }\n` +
          `💷 <b>Total:</b> £${checkoutState.totalAmount.toFixed(2)}`,
        { parse_mode: "HTML" }
      );

      // NEW CODE: Notify all admins about the new order
      const adminMessage =
        `🆕 New Order Received!\n\n` +
        `📦 Order ID: <code>${order._id}</code>\n` +
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
        `🚚 Delivery: ${order.deliveryMethod?.type || "N/A"}\n` +
        `Amount: ${amountInCrypto.toFixed(8)} ${selectedMethod.ticker}\n\n` +
        `Use <code>/order_details ${order._id}</code> for more info\n` +
        `Use <code>/confirm_payment ${order._id}</code> once payment is received`;

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
        getMainKeyboard(userId, specialCategories)
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

    // ✅ Handle country
    if (replyToMessage.text === "Please enter your country:") {
      checkoutState.shippingDetails.country = text;
      checkoutState.step = "delivery_method";
      checkoutStates.set(userId, checkoutState);

      // 🆕 Ask user to select delivery option
      await bot.sendMessage(chatId, "🚚 Please select your delivery method:", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "TRACKED24 - £5",
                callback_data: "delivery_within_uk",
              },
            ],
            [{ text: "❌ Cancel Checkout", callback_data: "cancel_checkout" }],
          ],
        },
      });
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

    let message =
      "This is a list of all the items in your basket. If you want to remove any of them, select the name of the item from the list.\n\n";
    cartItems.forEach((item, index) => {
      message += `${index + 1}. <b>${
        item.product.name
      } — ${item.quantity.toFixed(2)} ${
        item.product.unit
      } × £${item.unitPrice.toFixed(2)} = £${(
        item.unitPrice * item.quantity
      ).toFixed(2)}</b>\n`;
    });
    message += `\nTotal : <b>£${total.toFixed(2)}</b>`;

    try {
      if (messageId) {
        await bot.editMessageText(message, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          ...getCartKeyboard(cartItems),
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          ...getCartKeyboard(cartItems),
        });
      }
    } catch (error) {
      console.log("Error updating cart message:", error.message);
    }
  }
};
