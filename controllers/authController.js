const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const createToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'mathclub_jwt_secret', {
    expiresIn: '7d'
  });
};

exports.showLogin = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { title: 'Kirish — Math Club', error: null });
};

exports.showRegister = (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { title: 'Ro‘yxatdan o‘tish — Math Club', error: null });
};

exports.registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.render('auth/register', { title: 'Ro‘yxatdan o‘tish — Math Club', error: 'Bu email allaqachon ro‘yxatdan o‘tgan' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = createToken(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.redirect('/');
  } catch (err) {
    console.error('Register xatosi:', err.message);
    res.render('auth/register', { title: 'Ro‘yxatdan o‘tish — Math Club', error: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !user.password) {
      return res.render('auth/login', { title: 'Kirish — Math Club', error: 'Email yoki parol noto‘g‘ri' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('auth/login', { title: 'Kirish — Math Club', error: 'Email yoki parol noto‘g‘ri' });
    }
    const token = createToken(user);
    res.cookie('token', token, { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 });
    res.redirect('/');
  } catch (err) {
    console.error('Login xatosi:', err.message);
    res.render('auth/login', { title: 'Kirish — Math Club', error: 'Xatolik yuz berdi, qayta urinib ko‘ring' });
  }
};

exports.logoutUser = (req, res) => {
  res.clearCookie('token');
  req.logout && req.logout(() => {});
  res.redirect('/');
};
