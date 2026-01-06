const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../utils/authMiddleware');
const { getTestPage, getTestData, submitTest } = require('../controllers/testController');

router.get('/', ensureAuth, getTestPage);
router.get('/api/:id', ensureAuth, getTestData);
router.post('/api/:id/submit', ensureAuth, submitTest);

module.exports = router;
