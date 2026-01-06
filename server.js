require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const passport = require('passport');

const { connectDB } = require('./config/db');
require('./config/passport');

const app = express();

// MongoDB ulanishi
connectDB();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static fayllar
app.use(express.static(path.join(__dirname, 'public')));

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mathclub_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mathclub' }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Foydalanuvchini view’larda global qilish
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// Marshrutlar
app.use('/', require('./routes/index')); 
app.use('/auth', require('./routes/auth'));
app.use('/tests', require('./routes/tests'));
app.use('/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Math Club server ${PORT}-portda ishlamoqda`);
});
