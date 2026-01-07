require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const { getCurrentAdminCode } = require('./utils/adminCode');

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN .env faylida topilmadi');
  process.exit(1);
}

const bot = new Telegraf(token);

const SITE_BASE_URL = process.env.SITE_BASE_URL || 'http://localhost:5000';

bot.start((ctx) => {
  return ctx.reply(
    'Math Club botiga xush kelibsiz!\n\nAdmin bo\'lsangiz, admin panel kodini olish uchun quyidagi tugmadan foydalaning.',
    Markup.inlineKeyboard([
      [Markup.button.callback('Admin panelga kirish', 'ADMIN_PANEL')]
    ])
  );
});

bot.action('ADMIN_PANEL', async (ctx) => {
  const code = getCurrentAdminCode();
  const url = SITE_BASE_URL + '/admin/login';
  try {
    await ctx.answerCbQuery();
  } catch (e) {}
  return ctx.reply(`Admin panel kodi: ${code}\n\nAdmin panelga kirish: ${url}`);
});

bot.command('admin', (ctx) => {
  const code = getCurrentAdminCode();
  const url = SITE_BASE_URL + '/admin/login';
  return ctx.reply(`Admin panel kodi: ${code}\n\nAdmin panelga kirish: ${url}`);
});

bot.launch().then(() => {
  console.log('Telegram bot ishga tushdi');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
