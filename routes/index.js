const express = require('express');
const router = express.Router();
const { ensureAuthOptional, ensureAuth } = require('../utils/authMiddleware');
const StarReward = require('../models/StarReward');
const leaderboardController = require('../controllers/leaderboardController');
const messageController = require('../controllers/messageController');
const testController = require('../controllers/testController');
const { uploadMiddleware, uploadChatImage } = require('../controllers/uploadController');

router.get('/', ensureAuthOptional, (req, res) => {
  res.render('home', { title: 'Math Club — Bosh sahifa' });
});

router.get('/about', ensureAuthOptional, (req, res) => {
  res.render('about', { title: 'Math Club haqida' });
});

router.get('/teacher', ensureAuthOptional, (req, res) => {
  res.render('teacher', { title: 'O‘qituvchi haqida' });
});

router.get('/results', ensureAuthOptional, (req, res) => {
  res.render('results', { title: 'O‘quvchilar natijalari' });
});

router.get('/register-course', ensureAuthOptional, (req, res) => {
  res.render('register-course', { title: 'Kursga ro‘yxatdan o‘tish' });
});

// Stars yig'ish va sovg'alar sahifasi
router.get('/stars', ensureAuth, async (req, res) => {
  try {
    const rewards = await StarReward.find({ isActive: true }).sort({ costStars: 1 }).lean();
    res.render('stars', {
      title: 'Stars — Math Club',
      user: req.user,
      rewards
    });
  } catch (err) {
    console.error('Stars sahifasi xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
});

// Stars uchun testlar ro'yxati sahifasi
router.get('/star-tests', ensureAuth, testController.getStarTestsPage);

router.get('/leaderboard', ensureAuthOptional, leaderboardController.getLeaderboard);
router.get('/leaderboard/tests', ensureAuthOptional, leaderboardController.getPerTestLeaderboard);
router.get('/leaderboard/user/:id', ensureAuthOptional, leaderboardController.getLeaderboardUserProfile);

router.get('/profile', ensureAuth, (req, res) => {
  res.render('profile', { title: 'Shaxsiy kabinet', user: req.user });
});

// Adminga xabar yozish sahifasi (chat ko‘rinishida)
router.get('/messages', ensureAuth, (req, res) => {
  res.render('messages', { title: 'Adminga xabarlashish', user: req.user });
});

// User chat API: o'z threadini olish
router.get('/messages/api/thread', ensureAuth, messageController.getUserThread);

// User chat API: yangi xabar yuborish (matn yoki rasm URL)
router.post('/messages/api', ensureAuth, messageController.sendUserMessage);

// Chat uchun rasm yuklash (Cloudinary)
router.post('/upload/image', ensureAuth, uploadMiddleware, uploadChatImage);

module.exports = router;
