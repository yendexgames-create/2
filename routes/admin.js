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
  sendMessageToUser
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

// Testlarni boshqarish
router.post('/tests', ensureAdmin, createTest);
router.post('/tests/:id/delete', ensureAdmin, deleteTest);
router.get('/tests/:id/edit', ensureAdmin, editTestForm);
router.post('/tests/:id/edit', ensureAdmin, updateTest);

// Admin chat API
router.get('/api/messages', ensureAdmin, getUserMessages);
router.post('/api/messages/:userId', ensureAdmin, sendMessageToUser);

module.exports = router;
