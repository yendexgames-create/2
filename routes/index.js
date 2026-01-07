const express = require('express');
const router = express.Router();
const { ensureAuthOptional, ensureAuth } = require('../utils/authMiddleware');
const leaderboardController = require('../controllers/leaderboardController');

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

module.exports = router;
