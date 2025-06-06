const bot = require("../services/botService");
const Product = require("../models/Product");
const Order = require("../models/Order"); // Add this import
const {
  getAdminKeyboard,
  getProductDetailsKeyboard,
} = require("../utils/keyboards");
const { ADMIN_IDS } = require("../config/env");
const { formatProduct } = require("../utils/helpers");

let productCache = {};

module.exports = () => {
  // Admin panel entry
  bot.onText(/👨‍💻 Admin Panel/, async (msg) => {
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
        cache.step = "price";
        bot.sendMessage(
          chatId,
          "Please enter the product price (numbers only):"
        );
        break;
      // In the product creation steps (around line 40)
      case "price":
        if (isNaN(text)) {
          return bot.sendMessage(
            chatId,
            "Please enter a valid number for the base price:"
          );
        }
        cache.basePrice = parseFloat(text);
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
          minQuantity: parseInt(qty),
          price: parseFloat(price),
        });

        bot.sendMessage(
          chatId,
          `Added tier: ${qty}+ units at $${price} each\nEnter another tier or "done" to finish:`,
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

        // Create the product with basePrice and priceTiers
        const product = new Product({
          name: cache.name,
          description: cache.description,
          basePrice: cache.basePrice,
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
          getAdminKeyboard()
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
          ...getProductDetailsKeyboard(product._id, 1, true),
        });
      } else {
        await bot.sendMessage(chatId, message, {
          parse_mode: "HTML",
          ...getProductDetailsKeyboard(product._id, 1, true),
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
  bot.onText(/\/ship_order (.+?) (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const orderId = match[1];
    const trackingNumber = match[2];

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
          trackingNumber,
          updatedAt: new Date(),
        },
        { new: true }
      );

      if (!order) {
        return bot.sendMessage(chatId, "❌ Order not found.");
      }

      // Notify customer
      let trackingMessage = `🚚 Order #${order._id} has been shipped!\n\n`;
      trackingMessage += `🔍 Tracking Number: ${trackingNumber}\n`;

      if (order.shippingDetails.country === "US") {
        trackingMessage += `📦 Track via USPS: https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`;
      } // Add other carriers as needed

      await bot.sendMessage(order.userId, trackingMessage);

      await bot.sendMessage(
        chatId,
        `✅ Order #${order._id} marked as shipped\n` +
          `📦 Tracking: ${trackingNumber}\n` +
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

      let message = `📦 Order #${order._id}\n`;
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
      message += `🏠 Shipping to: ${order.shippingDetails.street}, ${order.shippingDetails.city}\n`;

      if (order.trackingNumber) {
        message += `📦 Tracking: ${order.trackingNumber}\n`;
      }

      await bot.sendMessage(chatId, message, getAdminKeyboard());
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
