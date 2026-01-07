const bcrypt = require('bcryptjs');
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
    // Maxsus admin login: ikki bosqichli oqim
    // 1-bosqich: email bo'sh, parol ADMIN_LOGIN_PASSWORD ga teng bo'lsa -> login so'zini so'raymiz
    // 2-bosqich: email bo'sh, sessiyada adminStage='step1' va parol ADMIN_LOGIN ga teng bo'lsa -> admin panelga kiritamiz
    const adminPassword = process.env.ADMIN_LOGIN_PASSWORD;
    const adminLogin = process.env.ADMIN_LOGIN;

    if (!email || email.trim() === '') {
      // 2-bosqich: login so'zini tekshirish
      if (req.session && req.session.adminStage === 'step1') {
        if (adminLogin && password === adminLogin) {
          req.session.isAdmin = true;
          req.session.adminStage = null;
          return res.redirect('/admin');
        }

        req.session.adminStage = null;
        return res.render('auth/login', {
          title: 'Kirish — Math Club',
          error: 'Admin login so‘zi noto‘g‘ri.'
        });
      }

      // 1-bosqich: maxsus admin parolni tekshirish
      if (adminPassword && password === adminPassword) {
        if (req.session) {
          req.session.adminStage = 'step1';
        }
        return res.render('auth/login', {
          title: 'Kirish — Math Club',
          error: 'Endi admin login so‘zingizni kiriting.'
        });
      }

      return res.render('auth/login', {
        title: 'Kirish — Math Club',
        error: 'Email yoki parol noto‘g‘ri.'
      });
    }

    if (req.session) {
      req.session.adminStage = null;
    }

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
