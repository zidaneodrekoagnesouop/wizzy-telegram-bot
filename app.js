require('dotenv').config();
const connectDB = require('./config/db');
const startBot = require('./commands/start');
const adminCommands = require('./commands/admin');
const productCommands = require('./commands/product');
const cartCommands = require('./commands/cart');
const orderCommands = require('./commands/order');

// Connect to MongoDB
connectDB();

// Initialize bot commands
startBot();
adminCommands();
productCommands();
cartCommands();
orderCommands();

console.log('🤖 Telegram Shop Bot is running...');