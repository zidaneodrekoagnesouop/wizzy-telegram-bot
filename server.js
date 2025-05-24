require("dotenv").config();
const express = require("express");
const bot = require("./services/botService");
const app = express();

// Middleware
app.use(express.json());

// Webhook endpoint
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check route
app.get("/", (req, res) => {
  res.send("Shop bot is running");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  // Set webhook on startup
  try {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.setWebHook(webhookUrl);
    console.log(`Webhook set to: ${webhookUrl}`);
  } catch (err) {
    console.error("Failed to set webhook:", err);
  }
});
