const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { showLogin, showRegister, registerUser, loginUser, logoutUser } = require('../controllers/authController');

router.get('/login', showLogin);
router.get('/register', showRegister);
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/logout', logoutUser);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/login' }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('/auth/login');
    }
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET || 'mathclub_jwt_secret',
      { expiresIn: '7d' }
    );
    res.cookie('token', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.redirect('/');
  }
);

module.exports = router;
