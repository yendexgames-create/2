const crypto = require('crypto');

// Har 10 soniyada o'zgaradigan 8 xonali admin kodi
// Hisoblash formulasi bot uchun ham, web uchun ham bir xil bo'lishi kerak
// Shuning uchun bu utilni bot kodida ham ishlatish mumkin.

function getCurrentWindow() {
  const now = Math.floor(Date.now() / 1000); // sekundlarda
  const windowSize = 300; // 5 daqiqalik oynalar (300 sekund)
  return Math.floor(now / windowSize);
}

function generateCodeForWindow(windowIndex) {
  const secret = process.env.ADMIN_MASTER_SECRET || 'mathclub_admin_secret';
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(String(windowIndex))
    .digest('hex');

  // Faqat raqamlar, 8 xonali kod
  const numeric = hmac.replace(/[^0-9]/g, '').padEnd(8, '0');
  return numeric.slice(0, 8);
}

// Hozirgi oynadagi kodni olish
function getCurrentAdminCode() {
  const w = getCurrentWindow();
  return generateCodeForWindow(w);
}

// Kichik fleksibilitet uchun: oldingi yoki keyingi oynani ham tekshirish mumkin
function isValidAdminCode(code) {
  if (!code) return false;
  const c = String(code).trim();
  const current = getCurrentWindow();
  const windowsToCheck = [current, current - 1, current + 1];

  return windowsToCheck.some((w) => generateCodeForWindow(w) === c);
}

module.exports = {
  getCurrentAdminCode,
  isValidAdminCode
};
