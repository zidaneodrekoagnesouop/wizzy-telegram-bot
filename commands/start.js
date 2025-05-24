const bot = require('../services/botService');
const { getMainKeyboard } = require('../utils/keyboards');
const { getUser } = require('../services/dbService');

module.exports = () => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    await getUser(userId);
    
    bot.sendMessage(
      chatId,
      '🛍️ Welcome to our Telegram Shop! How can I help you today?',
      getMainKeyboard(userId)
    );
  });

  // bot.on('message', (msg) => {
  //   const userId = msg.from.id;
  //   console.log('User Telegram ID:', userId);
  // });  

  // Handle back to main menu
  bot.onText(/🔙 Back to Main Menu/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    bot.sendMessage(
      chatId,
      '🛍️ Welcome back to the main menu!',
      getMainKeyboard(userId)
    );
  });
};