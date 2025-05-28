const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_BOT_TOKEN } = require("../config/env");

// Remove polling and initialize without options
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN);

// Optional: Add error logging
bot.on("webhook_error", (error) => {
  console.error("Webhook error:", error);
});

module.exports = bot;