const TelegramBot = require('node-telegram-bot-api');
const { TELEGRAM_BOT_TOKEN } = require('../config/env');

const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

module.exports = bot;