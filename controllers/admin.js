const { isValidAdminCode, getCurrentAdminCode } = require('../utils/adminCode');
const User = require('../models/User');
const Test = require('../models/Test');
const Message = require('../models/Message');
const StarSeason = require('../models/StarSeason');
const StarReward = require('../models/StarReward');


// Admin sessiyasini tekshiruvchi middleware
exports.ensureAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.redirect('/admin/login');
};

exports.showLogin = (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.redirect('/admin');
  }
  res.render('admin/login', {
    title: 'Admin panelga kirish',
    error: null
  });
};

exports.handleLogin = (req, res) => {
  const { code } = req.body;
  const expected = getCurrentAdminCode();
  console.log('Admin login urinish:', { code, valid: isValidAdminCode(code), expected });
  if (!code || !isValidAdminCode(code)) {
    return res.status(401).render('admin/login', {
      title: 'Admin panelga kirish',
      error: 'Kod noto\'g\'ri yoki eskirgan. Botdan yangi kod oling.'
    });
  }

  // Kod to'g'ri bo'lsa, sessiyada admin flag saqlaymiz
  req.session.isAdmin = true;
  return res.redirect('/admin');
};

exports.logout = (req, res) => {
  if (req.session) {
    req.session.isAdmin = false;
  }
  res.redirect('/');
};

exports.showDashboard = async (req, res) => {
  try {
    const users = await User.find({}).lean();
    const tests = await Test.find({}).select('title createdAt').sort({ createdAt: -1 }).lean();
    const starSeason = await StarSeason.findOne({}).sort({ createdAt: -1 }).lean();
    const starRewards = await StarReward.find({}).sort({ createdAt: -1 }).lean();

    const usersWithStats = users.map((u) => {
      const tests = Array.isArray(u.tests_taken) ? u.tests_taken : [];
      const testsCount = tests.length;
      const avgScore = testsCount
        ? Math.round(
            tests.reduce((sum, t) => sum + (t.score || 0), 0) / testsCount
          )
        : 0;

      return {
        ...u,
        testsCount,
        avgScore
      };
    });

    // Xabar yuborgan foydalanuvchilar ro'yxati
    const messageUserIds = await Message.distinct('user');
    const messageUserIdStrings = messageUserIds.map((id) => String(id));
    const usersWithMessages = usersWithStats.filter((u) =>
      messageUserIdStrings.includes(String(u._id))
    );

    const unreadForAdmin = await Message.countDocuments({ from: 'user', seenByAdmin: false });

    res.render('admin/dashboard', {
      title: 'Admin panel',
      users: usersWithStats,
      usersWithMessages,
      tests,
      testError: req.query.testError || null,
      starSeason,
      starRewards,
      unreadForAdmin
    });
  } catch (err) {
    console.error('Admin dashboard xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

// Stars: mavsum sozlamalarini saqlash
exports.saveStarSeason = async (req, res) => {
  try {
    const { name, startDate, endDate, maxStarsPerUser } = req.body;
    const isActive = !!req.body.isActive;

    if (!name || !startDate || !endDate) {
      return res.redirect('/admin#admin-stars');
    }

    const payload = {
      name: name.toString().trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      isActive
    };

    if (maxStarsPerUser !== undefined && maxStarsPerUser !== null && maxStarsPerUser !== '') {
      const n = Number(maxStarsPerUser);
      if (!Number.isNaN(n) && n >= 0) {
        payload.maxStarsPerUser = n;
      }
    }

    // Hozircha bitta joriy season saqlaymiz: eski seasonlar bo'lsa ham, eng oxirgisi ishlatiladi
    await StarSeason.create(payload);

    return res.redirect('/admin#admin-stars');
  } catch (err) {
    console.error('StarSeason saqlash xatosi:', err.message);
    return res.redirect('/admin#admin-stars');
  }
};

// Stars: yangi reward qo'shish
exports.createStarReward = async (req, res) => {
  try {
    const { title, description, costStars } = req.body;
    const cost = Number(costStars || 0);

    if (!title || !cost || cost < 1) {
      return res.redirect('/admin#admin-stars');
    }

    await StarReward.create({
      title: title.toString().trim(),
      description: description ? description.toString().trim() : '',
      costStars: cost
    });

    return res.redirect('/admin#admin-stars');
  } catch (err) {
    console.error('StarReward yaratish xatosi:', err.message);
    return res.redirect('/admin#admin-stars');
  }
};

exports.createTest = async (req, res) => {
  try {
    const { title, pdfLink, totalQuestions, openCount, answersText, videoLink, timerMinutes, isStarEligible, starStartDate, starEndDate } = req.body;

    const total = Number(totalQuestions || 0);
    const open = Number(openCount || 0);
    const timer = timerMinutes !== undefined && timerMinutes !== null && timerMinutes !== ''
      ? Number(timerMinutes)
      : null;
    const closed = total - open;

    if (!title || !pdfLink || !total || total < 1 || open < 0 || (timer !== null && (Number.isNaN(timer) || timer < 0))) {
      const msg = encodeURIComponent('Test nomi, PDF linki va savollar soni to\'g\'ri kiritilganiga ishonch hosil qiling.');
      return res.redirect('/admin?testError=' + msg + '#admin-tests');
    }

    // 1) Ochiq savollar soni umumiy sonidan katta bo'lmasin
    if (open > total) {
      const msg = encodeURIComponent('Ochiq savollar soni umumiy savollar sonidan katta bo\'lishi mumkin emas.');
      return res.redirect('/admin?testError=' + msg + '#admin-tests');
    }

    // 2) Javoblar soni umumiy savollar soniga teng bo'lishi kerak
    const lines = (answersText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length !== total) {
      const msg = encodeURIComponent('Javoblar qatori soni umumiy savollar soniga (' + total + ') teng bo\'lishi kerak.');
      return res.redirect('/admin?testError=' + msg + '#admin-tests');
    }

    // 3) Har bir qatordagi tartib raqami 1..total bo'yicha ketma-ket bo'lsin
    const parsed = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\d+)\.\s*(.+)$/);
      if (!match) {
        const msg = encodeURIComponent('"' + lines[i] + '" qatori noto\'g\'ri formatda. "N.javob" ko\'rinishida yozing (masalan: 5.34 yoki 2.A).');
        return res.redirect('/admin?testError=' + msg + '#admin-tests');
      }
      const index = Number(match[1]);
      const answer = match[2].trim();
      const expected = i + 1;
      if (index !== expected) {
        const msg = encodeURIComponent('Javoblar tartib raqamlari ketma-ket bo\'lishi kerak: 1, 2, 3 ... ' + total + '. Xato qator: "' + lines[i] + '"');
        return res.redirect('/admin?testError=' + msg + '#admin-tests');
      }
      parsed.push({ index, answer });
    }

    // 4) Birinchi (total - open) ta savol yopiq: A/B/C/D bo'lishi kerak
    const closedUntil = total - open; // agar open = 0 bo'lsa, hammasi yopiq
    for (let i = 0; i < parsed.length; i++) {
      const { index, answer } = parsed[i];
      if (index <= closedUntil) {
        if (!/^[ABCD]$/i.test(answer)) {
          const msg = encodeURIComponent(index + '-savol yopiq bo\'lishi kerak. Javob faqat A/B/C/D bo\'lishi mumkin.');
          return res.redirect('/admin?testError=' + msg + '#admin-tests');
        }
      } else {
        // Ochiq savollar uchun javob sonli bo'lishi kerak (kamida bitta raqam bor)
        if (!/\d/.test(answer)) {
          const msg = encodeURIComponent(index + '-savol ochiq bo\'lib, javobi sonli (masalan, 34) bo\'lishi kerak.');
          return res.redirect('/admin?testError=' + msg + '#admin-tests');
        }
      }
    }

    const starDates = {};
    if (starStartDate) {
      const d = new Date(starStartDate);
      if (!Number.isNaN(d.getTime())) starDates.starStartDate = d;
    }
    if (starEndDate) {
      const d2 = new Date(starEndDate);
      if (!Number.isNaN(d2.getTime())) starDates.starEndDate = d2;
    }

    await Test.create({
      title,
      pdfLink,
      totalQuestions: total,
      closedCount: closed,
      openCount: open,
      answersText,
      videoLink,
      timerMinutes: timer,
      isStarEligible: !!isStarEligible,
      ...starDates
    });

    res.redirect('/admin#admin-tests');
  } catch (err) {
    console.error('Test yaratish xatosi:', err.message);
    const msg = encodeURIComponent('Testni yaratishda server xatosi yuz berdi.');
    res.redirect('/admin?testError=' + msg + '#admin-tests');
  }
};

exports.deleteTest = async (req, res) => {
  try {
    const testId = req.params.id;
    await Test.findByIdAndDelete(testId);
    res.redirect('/admin');
  } catch (err) {
    console.error('Testni o\'chirish xatosi:', err.message);
    res.redirect('/admin');
  }
};

// Testni tahrirlash formasi
exports.editTestForm = async (req, res) => {
  try {
    const testId = req.params.id;
    const test = await Test.findById(testId).lean();
    if (!test) {
      const msg = encodeURIComponent('Test topilmadi yoki o‘chirilgan.');
      return res.redirect('/admin?testError=' + msg + '#admin-tests');
    }

    res.render('admin/edit-test', {
      title: 'Testni tahrirlash',
      test,
      testError: null
    });
  } catch (err) {
    console.error('Testni tahrirlash formasini yuklash xatosi:', err.message);
    const msg = encodeURIComponent('Testni tahrirlashda server xatosi yuz berdi.');
    res.redirect('/admin?testError=' + msg + '#admin-tests');
  }
};

// Mavjud testni yangilash
exports.updateTest = async (req, res) => {
  try {
    const testId = req.params.id;
    const { title, pdfLink, totalQuestions, openCount, answersText, videoLink, timerMinutes, isStarEligible, starStartDate, starEndDate } = req.body;

    const total = Number(totalQuestions || 0);
    const open = Number(openCount || 0);
    const closed = total - open;
    const timer = timerMinutes !== undefined && timerMinutes !== null && timerMinutes !== ''
      ? Number(timerMinutes)
      : null;

    if (!title || !pdfLink || !total || total < 1 || open < 0 || (timer !== null && (Number.isNaN(timer) || timer < 0))) {
      const msg = encodeURIComponent("Test nomi, PDF linki va savollar soni to'g'ri kiritilganiga ishonch hosil qiling.");
      return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
    }

    if (open > total) {
      const msg = encodeURIComponent("Ochiq savollar soni umumiy savollar sonidan katta bo'lishi mumkin emas.");
      return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
    }

    const lines = (answersText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length !== total) {
      const msg = encodeURIComponent('Javoblar qatori soni umumiy savollar soniga (' + total + ') teng bo\'lishi kerak.');
      return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
    }

    const parsed = [];
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(/^(\d+)\.\s*(.+)$/);
      if (!match) {
        const msg = encodeURIComponent('"' + lines[i] + '" qatori noto\'g\'ri formatda. "N.javob" ko\'rinishida yozing (masalan: 5.34 yoki 2.A).');
        return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
      }
      const index = Number(match[1]);
      const answer = match[2].trim();
      const expected = i + 1;
      if (index !== expected) {
        const msg = encodeURIComponent('Javoblar tartib raqamlari ketma-ket bo\'lishi kerak: 1, 2, 3 ... ' + total + '. Xato qator: "' + lines[i] + '"');
        return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
      }
      parsed.push({ index, answer });
    }

    const closedUntil = total - open;
    for (let i = 0; i < parsed.length; i++) {
      const { index, answer } = parsed[i];
      if (index <= closedUntil) {
        if (!/^[ABCD]$/i.test(answer)) {
          const msg = encodeURIComponent(index + "-savol yopiq bo'lib, javobi faqat A/B/C/D bo'lishi kerak.");
          return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
        }
      } else {
        if (!/\d/.test(answer)) {
          const msg = encodeURIComponent(index + "-savol ochiq bo'lib, javobi sonli (masalan, 34) bo'lishi kerak.");
          return res.redirect('/admin/tests/' + testId + '/edit?testError=' + msg);
        }
      }
    }

    const starDates = {};
    if (starStartDate) {
      const d = new Date(starStartDate);
      if (!Number.isNaN(d.getTime())) starDates.starStartDate = d;
    }
    if (starEndDate) {
      const d2 = new Date(starEndDate);
      if (!Number.isNaN(d2.getTime())) starDates.starEndDate = d2;
    }

    await Test.findByIdAndUpdate(testId, {
      title,
      pdfLink,
      totalQuestions: total,
      closedCount: closed,
      openCount: open,
      answersText,
      videoLink,
      timerMinutes: timer,
      isStarEligible: !!isStarEligible,
      ...starDates
    });

    res.redirect('/admin#admin-tests');
  } catch (err) {
    console.error('Testni yangilash xatosi:', err.message);
    const msg = encodeURIComponent('Testni yangilashda server xatosi yuz berdi.');
    res.redirect('/admin?testError=' + msg + '#admin-tests');
  }
};

exports.clearUserHistory = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndUpdate(userId, { $set: { tests_taken: [] } });
    res.redirect('/admin');
  } catch (err) {
    console.error('Foydalanuvchi tarixini tozalash xatosi:', err.message);
    res.redirect('/admin');
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    await User.findByIdAndDelete(userId);
    res.redirect('/admin');
  } catch (err) {
    console.error('Foydalanuvchini o\'chirish xatosi:', err.message);
    res.redirect('/admin');
  }
};

// Admin: ma'lum foydalanuvchi bilan chat tarixini JSON ko'rinishida olish
exports.getUserMessages = async (req, res) => {
  try {
    const userId = req.query.user;
    if (!userId) {
      return res.status(400).json({ error: 'user parametri kerak' });
    }

    const user = await User.findById(userId).select('name email').lean();
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const messages = await Message.find({ user: userId })
      .sort({ createdAt: 1 })
      .lean();

    // Admin ushbu foydalanuvchi chatini ochganda, foydalanuvchidan kelgan xabarlarni o'qilgan deb belgilaymiz
    await Message.updateMany(
      { user: userId, from: 'user', seenByAdmin: false },
      { $set: { seenByAdmin: true } }
    );

    return res.json({ user, messages });
  } catch (err) {
    console.error('Admin getUserMessages xatosi:', err.message);
    return res.status(500).json({ error: 'Server xatosi' });
  }
};

// Admin: ma'lum foydalanuvchiga xabar yuborish
exports.sendMessageToUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { text, imageUrl } = req.body || {};

    if (!userId) {
      return res.status(400).json({ error: 'userId kerak' });
    }

    const cleanText = text ? text.toString().trim() : '';
    const cleanImage = imageUrl ? imageUrl.toString().trim() : '';

    if (!cleanText && !cleanImage) {
      return res.status(400).json({ error: 'Xabar matni yoki rasm bo‘lishi kerak' });
    }

    const user = await User.findById(userId).select('_id').lean();
    if (!user) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const message = await Message.create({
      user: userId,
      from: 'admin',
      text: cleanText || undefined,
      imageUrl: cleanImage || undefined
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error('Admin sendMessageToUser xatosi:', err.message);
    return res.status(500).json({ error: 'Server xatosi' });
  }
};
