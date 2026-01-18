const express = require('express');
const router = express.Router();
const {
  showLogin,
  handleLogin,
  logout,
  ensureAdmin,
  showDashboard,
  clearUserHistory,
  deleteUser,
  createTest,
  deleteTest,
  editTestForm,
  updateTest,
  getUserMessages,
  sendMessageToUser,
  saveStarSeason,
  createStarReward,
  createVideoTopic,
  deleteVideoTopic,
  createVideoLesson,
  deleteVideoLesson
} = require('../controllers/admin');

// Login sahifasi
router.get('/login', showLogin);
router.post('/login', handleLogin);

// Admin paneldan chiqish
router.get('/logout', logout);

// Admin panel
router.get('/', ensureAdmin, showDashboard);

// Foydalanuvchilarni boshqarish
router.post('/users/:id/clear-history', ensureAdmin, clearUserHistory);
router.post('/users/:id/delete', ensureAdmin, deleteUser);

// Stars (admin)
router.post('/stars/season', ensureAdmin, saveStarSeason);
router.post('/stars/rewards', ensureAdmin, createStarReward);

// Video darsliklar (admin)
router.post('/videos/topics', ensureAdmin, createVideoTopic);
router.post('/videos/topics/:id/delete', ensureAdmin, deleteVideoTopic);
router.post('/videos/lessons', ensureAdmin, createVideoLesson);
router.post('/videos/lessons/:id/delete', ensureAdmin, deleteVideoLesson);

// Testlarni boshqarish
router.post('/tests', ensureAdmin, createTest);
router.post('/tests/:id/delete', ensureAdmin, deleteTest);
router.get('/tests/:id/edit', ensureAdmin, editTestForm);
router.post('/tests/:id/edit', ensureAdmin, updateTest);

// Admin chat API
router.get('/api/messages', ensureAdmin, getUserMessages);
router.post('/api/messages/:userId', ensureAdmin, sendMessageToUser);

module.exports = router;
