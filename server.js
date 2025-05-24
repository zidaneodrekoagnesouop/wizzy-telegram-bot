require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const bot = require('./services/botService');
const app = express();

// Initialize all command handlers
const initializeBotCommands = () => {
  require('./commands/start')();
  require('./commands/admin')();
  require('./commands/product')();
  require('./commands/cart')();
  require('./commands/order')();
  console.log('🤖 All bot commands initialized');
};

// Middleware
app.use(express.json());

// Webhook endpoint
app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Health check route
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'active',
    service: 'Telegram Shop Bot',
    uptime: process.uptime() 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB connected successfully');

    // 2. Set webhook
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.setWebHook(webhookUrl, {
      max_connections: 50,
      allowed_updates: ['message', 'callback_query']
    });
    console.log(`🎯 Webhook set to: ${webhookUrl}`);

    // 3. Initialize commands
    initializeBotCommands();
    
    console.log(`🚀 Server running on port ${PORT}`);
  } catch (err) {
    console.error('❌ Startup failed:', err);
    process.exit(1);
  }
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});