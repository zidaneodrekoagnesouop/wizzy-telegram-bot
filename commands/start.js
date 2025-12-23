const bot = require("../services/botService");
const { getMainKeyboard } = require("../utils/keyboards");
const { getUser } = require("../services/dbService");
const { ADMIN_IDS } = require("../config/env");
const { getCategoriesWithCount } = require("../utils/helpers");

module.exports = () => {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username ? `@${msg.from.username}` : "N/A";
    const firstName = msg.from.first_name || "";
    const lastName = msg.from.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();

    const specialCategories = (await getCategoriesWithCount()).filter(
      (cat) =>
        cat.name === "💰 TIP THE UKP TEAM 🏆" || cat.name === "🚛 BULK 🚛"
    );

    await getUser(userId);

    bot.sendMessage(
      chatId,
      `Last seen: recently\nShips from: UK → UK\nSales: 4,435\nCurrency: GBP\nRating: ★4.94 (1,790)\n\n12:30pm cut off Monday - Friday`,
      getMainKeyboard(userId, specialCategories)
    );

    // Build the user info message
    const userInfo = `
  👤 <b>New / Returning User</b>
  🆔 <b>User ID:</b> <code>${userId}</code>
  💬 <b>Username:</b> ${username}
  📛 <b>Name:</b> ${fullName || "N/A"}
  📅 <b>Chat Type:</b> ${msg.chat.type}
    `;

    // Notify all admins
    await Promise.all(
      ADMIN_IDS.map(async (adminId) => {
        try {
          await bot.sendMessage(adminId, userInfo, { parse_mode: "HTML" });
        } catch (err) {
          console.error(`Failed to notify admin ${adminId}:`, err.message);
        }
      })
    );
  });

  bot.on("callback_query", async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const messageId = query.message.message_id;
    const data = query.data;

    const specialCategories = (await getCategoriesWithCount()).filter(
      (cat) =>
        cat.name === "💰 TIP THE UKP TEAM 🏆" || cat.name === "🚛 BULK 🚛"
    );

    if (data === "delete_broadcast") {
      bot
        .deleteMessage(query.message.chat.id, query.message.message_id)
        .catch(() => {});
    } else if (data === "back_to_main") {
      await getUser(userId);

      bot.editMessageText(
        `Last seen: recently\nShips from: UK → UK\nSales: 4,435\nCurrency: GBP\nRating: ★4.94 (1,790)\n\n12:30pm cut off Monday - Friday`,
        {
          chat_id: chatId,
          message_id: messageId,
          ...getMainKeyboard(userId, specialCategories),
        }
      );
    } else if (data === "telegram_groups") {
      bot.editMessageText(
        `💬 UKP TELEGRAM GROUP 💬\n\nWe’ve just launched the UKP Payday Flipping Chat Group 💥\n\nClick the link, jump in, and join the fun\n\n👉 https://t.me/+JnYcj5E0o_cxMWY0\n\n\n\nUKP — Stack it. Flip it. Live free. 🖤\n\n📌 Remember… if it’s your first time in a UKP group, you have to talk. 🗣️ (Fight Club rules)`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Back to Main menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    } else if (data === "read_before_order") {
      bot.editMessageText(
        `🚨 READ BEFORE ORDER 🚨\n\n📦 Important Delivery Info – Read Before You Order 📦\n\nWe operate from different offices for different product categories:\n\n🔴 Class A’s\n🟢 THC & Psychedelics\n🔵 Meds\n\nThese offices are in separate UK locations, so if you order from multiple categories, they will be shipped separately — but still on the same day.\n\n➡️ Example: If you order Meds + THC, theyll arrive in 2 parcels, possibly on different days.\n\n❗️ Do NOT leave a bad review if one part of your order lands first.\nNothing is missing — its just sent from different places.\n\nIf something genuinely is missing (rare), message the bot, not the review section.\n\n📮 All parcels are sent via Track 24.\nDespite the name, it’s not guaranteed next day.\nRoyal Mail aims for 1–3 business days (weekends not included).\n\nOrders placed after 1PM will be posted the next working day.\n\n🛫 We only post within the UK.\nIf youre in Northern Ireland and want Coke, select the NI to NI shipping option — this is the only product we ship from our Belfast office.\n\n📩 For all questions, use the bot only.\nOnly message the Telegram admin if you’ve got a genuine complaint.\n\nThank you for understanding and keeping things smooth 🤠🍸`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Back to Main menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    } else if (data === "matrix_links") {
      bot.editMessageText(
        `🔐 matrix LINKS 🔐\n\nUKP Chat Group ⬇️⬇️⬇️\nhttps://matrix.to/#/#ukpablo.group:matrix.org`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Back to Main menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    } else if (data === "about_ukp") {
      bot.editMessageText(
        `🤠 ABOUT UKP 🍸\n\n🚨 A Brief Word from UK PABLO 🚨\n\nWell guys… where do we even begin? Let’s keep this short and sweet — OPSEC first.\n\nI’ve felt like a dealer my whole life. Started young, moving small bits.\nThen I was the one supplying the local dealers, always out, always active, Nokia brick in hand, hustling till late.\n📲💼📦\n\nThen came Telegram. Listings? Payments? All by bank transfer back then.\n\nMy mind was blown. I already knew about crypto, so I started to transition customers — and the vision just got bigger.\n💸➡️🪙\n\nThen, by pure chance — I landed on the dark web. Started selling on the markets.\n\nNovember 2019, we made our first ever sale on Telegram.\n\nWe’ve never looked back.\n🚀📈\n\nI started out from the gutter. No money — in fact, no nothing.\n\nIt’s been a long, hard road to get here.\nI’ve been at the top, back to the bottom, then back to the top again.\nIt’s happened more times than I care to remember.\n\nBut when you get knocked off the horse, you jump straight back on.\nAlways moving forward.\nNo matter how big the setback, no matter how bad the disaster — I push through.\nI don’t just bounce back. I build back stronger.\n🧱🔥\n\nNow I live a very comfortable life, but comfort and money alone isn’t enough.\nI don’t count how much I’ve made. I count sales.\nBecause I’ve got a real love for this game.\nAnd it is a game.\nIt doesn’t feel like work — it feels like pleasure.\n\nMy favourite pastime:\n💻 Sales online\n🌿 New products\n🏢 New offices\n\nAnd one of the biggest highlights in the whole journey — was finally getting a Tesseract bot.\n\nIt’s been a total game-changer, and I’m grateful every day for the tools that help us run like a machine.\n♟️⚙️📲\n\nThis isn’t just a job. It’s my life.\nUKP is the mission.\n🤠🍸`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Back to Main menu", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    } else if (data === "live_chat") {
      bot.editMessageText(
        `📩 Send messages to the chat\n\nThis is not a live chat, the seller will reply as soon as he reads your messages.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Close chat", callback_data: "back_to_main" }],
            ],
          },
        }
      );
    }
  });
};
