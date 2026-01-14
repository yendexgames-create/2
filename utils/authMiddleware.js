const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');

const ensureAuth = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) {
      return res.status(401).redirect('/auth/login');
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mathclub_jwt_secret');
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).redirect('/auth/login');
    }
    req.user = user;
    res.locals.user = user;

    const unreadFromAdmin = await Message.countDocuments({
      user: user._id,
      from: 'admin',
      seenByUser: false
    });
    res.locals.unreadFromAdmin = unreadFromAdmin;
    next();
  } catch (err) {
    console.error('Auth middleware xatosi:', err.message);
    return res.status(401).redirect('/auth/login');
  }
};

const ensureAuthOptional = async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies.token;
    if (!token) {
      return next();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mathclub_jwt_secret');
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
      res.locals.user = user;

      const unreadFromAdmin = await Message.countDocuments({
        user: user._id,
        from: 'admin',
        seenByUser: false
      });
      res.locals.unreadFromAdmin = unreadFromAdmin;
    }
    return next();
  } catch (err) {
    return next();
  }
};

module.exports = { ensureAuth, ensureAuthOptional };
