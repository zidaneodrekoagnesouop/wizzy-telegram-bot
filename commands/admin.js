const bot = require("../services/botService");
const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order"); // Add this import
const {
  getAdminKeyboard,
  getProductDetailsKeyboard,
} = require("../utils/keyboards");
const { ADMIN_IDS } = require("../config/env");
const { formatProduct } = require("../utils/helpers");
const getCryptoRates = require("../utils/getCryptoRates");

let productCache = {};

module.exports = () => {
  // Admin panel entry
  bot.onText(/\/admin_panel/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to access this panel."
      );
    }

    bot.sendMessage(chatId, "👨‍💻 Welcome to Admin Panel", getAdminKeyboard());
  });

  // View GBP Crypto Rates
  bot.onText(/\/view_rates/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const rates = await getCryptoRates();

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to perform this action."
      );
    }

    bot.sendMessage(
      chatId,
      `BTC : <code>${rates.BTC}</code>\n` +
        `ETH : <code>${rates.ETH}</code>\n` +
        `LTC : <code>${rates.LTC}</code>\n` +
        `USDT : <code>${rates.USDT}</code>\n` +
        `XMR : <code>${rates.XMR}</code>`,
      { parse_mode: "HTML" }
    );
  });

  // NOTIFY COMMAND (ADMIN ONLY)
  bot.onText(/\/notify/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to use this command."
      );
    }

    // Step 1 — Ask admin for photo or skip
    bot.sendMessage(
      chatId,
      "📸 <b>Send the photo you want to include at the top of the broadcast.\n\nOr type <code>skip</code> to continue without a photo.</b>",
      {
        parse_mode: "HTML",
      }
    );

    // Wait for admin's next message (photo or "skip")
    bot.once("message", async (photoReply) => {
      let photoId = null;

      // If admin sends a photo
      if (photoReply.photo) {
        const photos = photoReply.photo;
        photoId = photos[photos.length - 1].file_id; // highest resolution
      } else if (photoReply.text?.toLowerCase() !== "skip") {
        // If plain text but not "skip", cancel
        return bot.sendMessage(
          chatId,
          "❌ Invalid input. Please send a photo or type <code>skip</code> next time.",
          { parse_mode: "HTML" }
        );
      }

      // Step 2 — Ask for the broadcast message
      bot.sendMessage(
        chatId,
        "✏️ <b>Now send the message you want to broadcast to all users:</b>",
        {
          parse_mode: "HTML",
        }
      );

      bot.once("message", async (textReply) => {
        if (!textReply.text || textReply.text.startsWith("/")) {
          return bot.sendMessage(
            chatId,
            "❌ Broadcast cancelled. Please send plain text next time."
          );
        }

        const broadcastText = textReply.text;

        const options = {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🗑️ Dismiss", callback_data: "delete_broadcast" }],
            ],
          },
        };

        // Step 3 — Fetch users
        const users = await User.find({}, "userId");

        // Step 4 — Broadcast to each user
        for (const user of users) {
          try {
            if (photoId) {
              // Send photo + caption (message)
              await bot.sendPhoto(user.userId, photoId, {
                caption: broadcastText,
                ...options,
              });
            } else {
              // Send text only
              await bot.sendMessage(user.userId, broadcastText, options);
            }
          } catch (err) {
            console.error("Failed to send to user:", user.userId, err);
          }
        }

        bot.sendMessage(chatId, "✅ <b>Broadcast sent to all users!</b>", {
          parse_mode: "HTML",
        });
      });
    });
  });

  // Add product flow
  bot.onText(/➕ Add Product/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to perform this action."
      );
    }

    productCache[chatId] = { step: "name" };
    bot.sendMessage(chatId, "Please enter the product name:");
  });

  // Handle product creation steps
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!productCache[chatId] || !ADMIN_IDS.includes(userId)) return;

    const cache = productCache[chatId];

    switch (cache.step) {
      case "name":
        cache.name = text;
        cache.step = "description";
        bot.sendMessage(chatId, "Please enter the product description:");
        break;
      case "description":
        cache.description = text;
        cache.step = "unit";
        bot.sendMessage(
          chatId,
          "Please enter measurement unit for your product:"
        );
        break;
      // In the product creation steps (around line 40)
      case "unit":
        cache.unit = text;
        cache.step = "priceTiers";
        bot.sendMessage(
          chatId,
          'Now enter price tiers in format "quantity:price" (one per line).\nExample:\n5:15\n10:12\nEnter "done" when finished:',
          { reply_markup: { force_reply: true } }
        );
        break;
      case "priceTiers":
        if (text.toLowerCase() === "done") {
          cache.step = "category";
          return bot.sendMessage(chatId, "Please enter the product category:");
        }

        const [qty, price] = text.split(":").map((part) => part.trim());
        if (!qty || !price || isNaN(qty) || isNaN(price)) {
          return bot.sendMessage(
            chatId,
            'Invalid format. Please use "quantity:price" (e.g., "5:15") or "done" to finish:'
          );
        }

        if (!cache.priceTiers) cache.priceTiers = [];
        cache.priceTiers.push({
          minQuantity: parseFloat(qty),
          price: parseFloat(price),
        });

        bot.sendMessage(
          chatId,
          `Added tier: ${qty}+ ${cache.unit} at £${price} each\nEnter another tier or "done" to finish:`,
          { reply_markup: { force_reply: true } }
        );
        break;
      case "category":
        cache.category = text;
        cache.step = "subcategory";
        bot.sendMessage(
          chatId,
          'Please enter the product sub-category (or type "none" to skip):',
          { reply_markup: { force_reply: true } }
        );
        break;
      case "subcategory":
        if (text.toLowerCase() !== "none") {
          cache.subCategory = text;
        }
        cache.step = "image";
        bot.sendMessage(
          chatId,
          'Please send the product image (or type "skip" to continue without image):'
        );
        break;
      case "image":
        if (msg.photo) {
          cache.imageUrl = msg.photo[msg.photo.length - 1].file_id;
        }

        // Create the product with unit and priceTiers
        const product = new Product({
          name: cache.name,
          description: cache.description,
          unit: cache.unit,
          priceTiers: cache.priceTiers || [],
          category: cache.category,
          subCategory: cache.subCategory || undefined,
          imageUrl: cache.imageUrl || undefined,
        });

        await product.save();
        delete productCache[chatId];

        bot.sendMessage(
          chatId,
          `✅ Product added successfully!\n\n${formatProduct(product)}`,
          { parse_mode: "HTML", ...getAdminKeyboard() }
        );
        break;
    }
  });

  // List products for admin
  bot.onText(/📋 Product List/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to perform this action."
      );
    }

    const products = await Product.find().sort({ createdAt: -1 });

    if (products.length === 0) {
      return bot.sendMessage(chatId, "No products found.", getAdminKeyboard());
    }

    for (const product of products) {
      const message = formatProduct(product);

      if (product.imageUrl) {
        await bot.sendPhoto(chatId, product.imageUrl, {
          caption: message,
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product, 1, true),
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product, 1, true),
        });
      }
    }
  });

  // Handle product deletion
  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (!ADMIN_IDS.includes(userId)) return;

    if (data.startsWith("delete_product_")) {
      const productId = data.replace("delete_product_", "");

      try {
        await Product.findByIdAndDelete(productId);
        await bot.answerCallbackQuery(query.id, {
          text: "Product deleted successfully!",
        });
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch (error) {
        await bot.answerCallbackQuery(query.id, {
          text: "Failed to delete product.",
        });
      }
    }

    // Handle product editing (simplified version)
    if (data.startsWith("edit_product_")) {
      const productId = data.replace("edit_product_", "");
      productCache[chatId] = { step: "edit", productId };

      await bot.sendMessage(
        chatId,
        'What would you like to edit?\nSend in format: "field: new value"\nAvailable fields: name, description, price, category, subCategory',
        getAdminKeyboard()
      );
    }
  });

  // Process order (mark as processing)
  bot.onText(/\/process_order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to process orders."
      );
    }

    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { status: "processing", updatedAt: new Date() },
        { new: true }
      );

      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found.");
      }

      // Notify customer
      await bot.sendMessage(
        order.userId,
        `🛠️ Order #${order._id} is now being processed\n\n` +
          `We're preparing your items for shipping.`
      );

      await bot.sendMessage(
        chatId,
        `✅ Order #${order._id} marked as processing\n` +
          `Customer has been notified.`,
        getAdminKeyboard()
      );
    } catch (error) {
      console.error("Order processing error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to process order. Please check the order ID and try again.",
        getAdminKeyboard()
      );
    }
  });

  // Ship order (add tracking number)
  bot.onText(/\/ship_order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to ship orders."
      );
    }

    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        {
          status: "shipped",
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found.");
      }

      // Notify customer
      let shippedAt = new Date();
      const date = shippedAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const time = shippedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      let customerMessage = `💳 <b>Invoice</b> <code>${order._id}</code>\n\n`;

      customerMessage += `🔄 <b>Status:</b> 🚚 Your order has been marked as Dispatched from ${date} at ${time}\n\n`;
      customerMessage += `Your order is on its way. The seller has marked the order as shipped, please await delivery of your order. Once you have received your order, please do not forget to leave a review about the seller.\n\n`;

      // List items
      let count = 1;

      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          customerMessage += `<b>${count}. ${product.name} • ${item.quantity} ${
            product.unit
          } — £${(item.priceAtPurchase * item.quantity).toFixed(2)}</b>\n`;
          count++;
        }
      }

      customerMessage += `\n<b>Delivery:</b> ${
        order.deliveryMethod?.type || "N/A"
      }\n`;
      customerMessage += `<b>Total:</b> £${order.totalAmount.toFixed(2)}\n`;

      // Send notification to customer
      await bot.sendMessage(order.userId, customerMessage, {
        parse_mode: "HTML",
      });

      await bot.sendMessage(
        chatId,
        `✅ Order #${order._id} marked as shipped\n` +
          `Customer has been notified.`,
        getAdminKeyboard()
      );
    } catch (error) {
      console.error("Shipping error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to ship order. Please check the order ID and try again.",
        getAdminKeyboard()
      );
    }
  });

  // Complete order (mark as delivered)
  bot.onText(/\/complete_order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to complete orders."
      );
    }

    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { status: "delivered", updatedAt: new Date() },
        { new: true }
      );

      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found.");
      }

      // Notify customer
      await bot.sendMessage(
        order.userId,
        `🎉 Order #${order._id} has been delivered!\n\n` +
          `Thank you for shopping with us!\n` +
          `Please consider leaving a review.`
      );

      await bot.sendMessage(
        chatId,
        `✅ Order #${order._id} marked as delivered\n` +
          `Customer has been notified.`,
        getAdminKeyboard()
      );
    } catch (error) {
      console.error("Order completion error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to complete order. Please check the order ID and try again.",
        getAdminKeyboard()
      );
    }
  });

  // Add this to your admin commands
  bot.onText(/\/confirm_payment (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(
        chatId,
        "⚠️ You are not authorized to confirm payments."
      );
    }

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found.");
      }

      if (order.status !== "pending_payment") {
        return bot.sendMessage(
          chatId,
          `ℹ️ Order status is already: ${order.status}\n` +
            `No changes were made.`
        );
      }

      order.status = "processing";
      await order.save();

      // Notify customer
      await bot.sendMessage(
        order.userId,
        `✅ Payment confirmed for order #${order._id}\n\n` +
          `Your order is now being processed.\n` +
          `We'll notify you when it ships.`
      );

      await bot.sendMessage(
        chatId,
        `✅ Payment confirmed for order #${order._id}\n` +
          `Customer has been notified.`
      );
    } catch (error) {
      console.error("Payment confirmation error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to confirm payment. Please check the order ID and try again."
      );
    }
  });

  // VIEW ORDER DETAILS
  bot.onText(/\/order_details (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, "⚠️ Unauthorized access");
    }

    try {
      const order = await Order.findById(orderId).populate("items.productId");

      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found");
      }

      let message = `📦 Order #<code>${order._id}</code>\n`;
      message += `👤 Customer ID: ${order.userId}\n`;
      message += `🔄 Status: ${order.status}\n`;
      message += `📅 Date: ${order.createdAt.toLocaleString()}\n\n`;
      message += `📝 Items:\n`;

      order.items.forEach((item) => {
        message += `- ${item.productId.name} (Qty: ${
          item.quantity
        }) - $${item.priceAtPurchase.toFixed(2)}\n`;
      });

      message += `\n💷 Total: £${order.totalAmount.toFixed(2)}\n`;
      message +=
        `\n🏠 Shipping to:\n${order.shippingDetails.name}\n` +
        `${order.shippingDetails.street}\n` +
        `${order.shippingDetails.city}, ${order.shippingDetails.postalCode}\n` +
        `${order.shippingDetails.country}\n`;

      if (order.trackingNumber) {
        message += `📦 Tracking: ${order.trackingNumber}\n`;
      }

      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        ...getAdminKeyboard(),
      });
    } catch (error) {
      console.error("Order details error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to fetch order details",
        getAdminKeyboard()
      );
    }
  });

  // LIST PENDING ORDERS
  bot.onText(/\/pending_orders/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, "⚠️ Unauthorized access");
    }

    try {
      const pendingOrders = await Order.find({
        status: { $in: ["payment_received", "processing"] },
      })
        .sort({ createdAt: -1 })
        .limit(10);

      if (pendingOrders.length === 0) {
        return bot.sendMessage(
          chatId,
          "✅ No pending orders found",
          getAdminKeyboard()
        );
      }

      let message = "📋 Pending Orders:\n\n";
      pendingOrders.forEach((order) => {
        message += `#${order._id}\n`;
        message += `👤 ${order.userId} | 💷 £${order.totalAmount.toFixed(2)}\n`;
        message += `🔄 ${
          order.status
        } | 📅 ${order.createdAt.toLocaleDateString()}\n`;
        message += `----------------\n`;
      });

      await bot.sendMessage(chatId, message, getAdminKeyboard());
    } catch (error) {
      console.error("Pending orders error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to fetch pending orders",
        getAdminKeyboard()
      );
    }
  });

  // CANCEL ORDER
  bot.onText(/\/cancel_order (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, "⚠️ Unauthorized access");
    }

    try {
      const order = await Order.findByIdAndUpdate(
        orderId,
        { status: "cancelled", updatedAt: new Date() },
        { new: true }
      );

      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found");
      }

      // Notify customer
      await bot.sendMessage(
        order.userId,
        `❌ Order #${order._id} has been cancelled\n\n` +
          `If this was a mistake, please contact support.`
      );

      await bot.sendMessage(
        chatId,
        `✅ Order #${order._id} cancelled\n` + `Customer has been notified.`,
        getAdminKeyboard()
      );
    } catch (error) {
      console.error("Cancel order error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to cancel order",
        getAdminKeyboard()
      );
    }
  });

  // LIST ALL ORDERS (with filters)
  bot.onText(/\/list_orders(?: (.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const filter = match[1] || "all";

    if (!ADMIN_IDS.includes(userId)) {
      return bot.sendMessage(chatId, "⚠️ Unauthorized access");
    }

    try {
      let query = {};
      if (filter !== "all") {
        query.status = filter;
      }

      const orders = await Order.find(query).sort({ createdAt: -1 }).limit(15);

      if (orders.length === 0) {
        return bot.sendMessage(
          chatId,
          `No ${filter !== "all" ? filter + " " : ""}orders found`,
          getAdminKeyboard()
        );
      }

      let message = `📦 Orders (${filter}):\n\n`;
      orders.forEach((order) => {
        message += `#${order._id}\n`;
        message += `👤 ${order.userId} | 💷 £${order.totalAmount.toFixed(2)}\n`;
        message += `🔄 ${
          order.status
        } | 📅 ${order.createdAt.toLocaleDateString()}\n`;
        message += `----------------\n`;
      });

      message += `\nUse /order_details [id] for more info`;
      await bot.sendMessage(chatId, message, getAdminKeyboard());
    } catch (error) {
      console.error("List orders error:", error);
      await bot.sendMessage(
        chatId,
        "❌ Failed to fetch orders",
        getAdminKeyboard()
      );
    }
  });

  // Handle edit product messages
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (
      !productCache[chatId] ||
      productCache[chatId].step !== "edit" ||
      !ADMIN_IDS.includes(userId)
    )
      return;

    const cache = productCache[chatId];
    const [field, ...valueParts] = text.split(":").map((part) => part.trim());
    const value = valueParts.join(":").trim();

    if (
      !["name", "description", "price", "category", "subCategory"].includes(
        field
      )
    ) {
      return bot.sendMessage(chatId, "Invalid field. Please try again.");
    }

    try {
      const update = {};
      if (field === "price") {
        if (isNaN(value)) {
          return bot.sendMessage(
            chatId,
            "Price must be a number. Please try again."
          );
        }
        update[field] = parseFloat(value);
      } else {
        update[field] = value;
      }

      await Product.findByIdAndUpdate(cache.productId, update);
      delete productCache[chatId];

      const updatedProduct = await Product.findById(cache.productId);
      bot.sendMessage(
        chatId,
        `✅ Product updated successfully!\n\n${formatProduct(updatedProduct)}`,
        getAdminKeyboard()
      );
    } catch (error) {
      bot.sendMessage(chatId, "Failed to update product. Please try again.");
    }
  });
};
