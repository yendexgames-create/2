const { isValidAdminCode, getCurrentAdminCode } = require('../utils/adminCode');
const User = require('../models/User');
const Test = require('../models/Test');
const Message = require('../models/Message');


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

    res.render('admin/dashboard', {
      title: 'Admin panel',
      users: usersWithStats,
      usersWithMessages,
      tests,
      testError: req.query.testError || null
    });
  } catch (err) {
    console.error('Admin dashboard xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

exports.createTest = async (req, res) => {
  try {
    const { title, pdfLink, totalQuestions, openCount, answersText, videoLink } = req.body;

    const total = Number(totalQuestions || 0);
    const open = Number(openCount || 0);
    const closed = total - open;

    if (!title || !pdfLink || !total || total < 1 || open < 0) {
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

    await Test.create({
      title,
      pdfLink,
      totalQuestions: total,
      closedCount: closed,
      openCount: open,
      answersText,
      videoLink
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
    const { title, pdfLink, totalQuestions, openCount, answersText, videoLink } = req.body;

    const total = Number(totalQuestions || 0);
    const open = Number(openCount || 0);
    const closed = total - open;

    if (!title || !pdfLink || !total || total < 1 || open < 0) {
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

    await Test.findByIdAndUpdate(testId, {
      title,
      pdfLink,
      totalQuestions: total,
      closedCount: closed,
      openCount: open,
      answersText,
      videoLink
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
