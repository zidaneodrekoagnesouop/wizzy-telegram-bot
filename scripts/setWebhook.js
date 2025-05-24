require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

(async () => {
  try {
    const webhookUrl = `${process.env.RENDER_EXTERNAL_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    await bot.setWebHook(webhookUrl);
    console.log(`Webhook successfully set to: ${webhookUrl}`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to set webhook:', err);
    process.exit(1);
  }
})();