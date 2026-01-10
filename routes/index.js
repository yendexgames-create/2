const express = require('express');
const router = express.Router();
const { ensureAuthOptional, ensureAuth } = require('../utils/authMiddleware');
const leaderboardController = require('../controllers/leaderboardController');
const messageController = require('../controllers/messageController');
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

router.get('/leaderboard', ensureAuthOptional, leaderboardController.getLeaderboard);
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
