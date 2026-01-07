const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../utils/authMiddleware');
const {
  getTestPage,
  getTestSolvePage,
  getTestResultPage,
  getTestData,
  submitTest
} = require('../controllers/testController');

// 1) Testlar ro'yxati
router.get('/', ensureAuth, getTestPage);

// 2) Bitta testni yechish sahifasi
router.get('/:id', ensureAuth, getTestSolvePage);

// 3) Natija / video sahifasi
router.get('/:id/result', ensureAuth, getTestResultPage);

// API endpointlar (JS orqali ishlatiladi)
router.get('/api/:id', ensureAuth, getTestData);
router.post('/api/:id/submit', ensureAuth, submitTest);

module.exports = router;
