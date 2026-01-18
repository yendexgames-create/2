const Test = require('../models/Test');
const Result = require('../models/Result');
const StarSeason = require('../models/StarSeason');
const StarTransaction = require('../models/StarTransaction');

exports.getTestPage = async (req, res) => {
  try {
    const tests = await Test.find({}).select('title pdfLink totalQuestions closedCount openCount timerMinutes isStarEligible');

    let userScoresByTest = {};
    if (req.user) {
      const results = await Result.find({ userId: req.user._id })
        .select('testId score')
        .lean();

      results.forEach((r) => {
        const key = String(r.testId);
        const s = typeof r.score === 'number' ? r.score : 0;
        if (!userScoresByTest[key] || s > userScoresByTest[key]) {
          userScoresByTest[key] = s;
        }
      });
    }

    res.render('tests/test-page', {
      title: 'Testlar — Math Club',
      tests,
      userScoresByTest
    });
  } catch (err) {
    console.error('Test sahifa xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

// Stars uchun testlar bo'yicha yetakchilar sahifasi
exports.getStarTestsLeaderboardPage = async (req, res) => {
  try {
    const now = new Date();
    const tests = await Test.find({ isStarEligible: true })
      .select('title totalQuestions starStartDate starEndDate')
      .sort({ createdAt: 1 })
      .lean();

    const selectedTestId = req.query && req.query.test ? req.query.test : null;
    let selectedTest = null;
    let leaderboard = [];

    if (selectedTestId) {
      selectedTest = tests.find((t) => String(t._id) === String(selectedTestId)) || null;

      if (selectedTest) {
        const rows = await Result.aggregate([
          {
            $match: {
              testId: selectedTest._id,
              mode: 'timed'
            }
          },
          {
            $group: {
              _id: '$userId',
              bestScore: { $max: '$score' },
              bestDuration: { $min: '$durationSeconds' },
              attempts: { $sum: 1 }
            }
          },
          {
            $addFields: {
              sortDuration: { $ifNull: ['$bestDuration', 9999999] }
            }
          },
          { $sort: { bestScore: -1, sortDuration: 1 } },
          { $limit: 50 }
        ]);

        // foydalanuvchi ma'lumotlarini qo'shamiz
        const userIds = rows.map((r) => r._id);
        const users = await require('../models/User')
          .find({ _id: { $in: userIds } })
          .select('name avatar')
          .lean();
        const userMap = new Map(users.map((u) => [String(u._id), u]));

        leaderboard = rows.map((r, idx) => {
          const u = userMap.get(String(r._id)) || {};
          return {
            userId: r._id,
            name: u.name || 'Foydalanuvchi',
            avatar: u.avatar || null,
            bestScore: r.bestScore,
            bestDuration: r.bestDuration || null,
            attempts: r.attempts,
            rank: idx + 1
          };
        });
      }
    }

    res.render('tests/star-tests-leaderboard', {
      title: 'Stars test yetakchilari — Math Club',
      tests,
      selectedTest,
      selectedTestId,
      leaderboard,
      now
    });
  } catch (err) {
    console.error('Stars test yetakchilari sahifasi xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

// Stars uchun testlar ro'yxati sahifasi
exports.getStarTestsPage = async (req, res) => {
  try {
    const now = new Date();
    const rawTests = await Test.find({ isStarEligible: true })
      .select('title totalQuestions closedCount openCount timerMinutes starStartDate starEndDate')
      .sort({ createdAt: 1 })
      .lean();

    const tests = (rawTests || []).map((t) => {
      const start = t.starStartDate ? new Date(t.starStartDate) : null;
      const isLocked = start && start.getTime() > now.getTime();
      return { ...t, isLocked };
    });

    res.render('tests/star-tests', {
      title: 'Stars uchun testlar — Math Club',
      tests
    });
  } catch (err) {
    console.error('Stars uchun testlar sahifasi xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

// Bitta testni yechish sahifasi
exports.getTestSolvePage = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).select(
      'title pdfLink totalQuestions closedCount openCount videoLink timerMinutes isStarEligible starStartDate'
    );
    if (!test) {
      return res.status(404).render('tests/solve', {
        title: 'Test topilmadi',
        test: null,
        error: 'Bu test topilmadi yoki o‘chirilgan.'
      });
    }

    const plain = test.toObject();
    let closedForClient = Number(plain.closedCount || 0);
    const totalQ = Number(plain.totalQuestions || 0);
    const openQ = Number(plain.openCount || 0);

    if (!closedForClient && totalQ && openQ >= 0) {
      // Agar closedCount kiritilmagan bo'lsa, totalQuestions - openCount orqali hisoblaymiz
      closedForClient = Math.max(totalQ - openQ, 0);
    }

    plain.displayClosedCount = closedForClient;

    const mode = (req.query && req.query.mode) ? String(req.query.mode) : 'timed';

    if (test.isStarEligible && test.starStartDate) {
      const now = new Date();
      if (now < test.starStartDate) {
        return res.render('tests/solve', {
          title: test.title + ' — Testni yechish',
          test: null,
          error: 'Bu stars uchun test hali boshlanmagan. Belgilangan sana va vaqt kelgach testni yechishingiz mumkin.',
          mode: 'timed'
        });
      }
    }

    // Stars uchun testlarda faqat timed va faqat bitta urinish
    if (test.isStarEligible) {
      // Har qanday once rejimini bloklaymiz
      if (mode === 'once') {
        return res.render('tests/solve', {
          title: test.title + ' — Testni yechish',
          test: null,
          error: 'Bu stars uchun testni faqat vaqtli (timerli) rejimda va faqat bir marta yechish mumkin.',
          mode: 'timed'
        });
      }

      if (req.user) {
        const existingTimed = await Result.findOne({
          userId: req.user._id,
          testId: test._id,
          mode: 'timed'
        }).lean();

        if (existingTimed) {
          return res.render('tests/solve', {
            title: test.title + ' — Testni yechish',
            test: null,
            error: 'Siz bu stars uchun testni allaqachon vaqtli rejimda yechgansiz. Qayta urinish berilmaydi.',
            mode: 'timed'
          });
        }
      }
    } else if (mode === 'once' && req.user) {
      // Oddiy testlar uchun eski once-rejim cheklovi saqlanadi
      const existing = await Result.findOne({
        userId: req.user._id,
        testId: test._id,
        mode: 'once'
      }).lean();

      if (existing) {
        return res.render('tests/solve', {
          title: test.title + ' — Testni yechish',
          test: null,
          error: 'Siz bu testni vaqtsiz rejimda allaqachon yechgansiz. Bu rejimda testni qayta ochish mumkin emas.',
          mode
        });
      }
    }

    return res.render('tests/solve', {
      title: test.title + ' — Testni yechish',
      test: plain,
      error: null,
      mode
    });
  } catch (err) {
    console.error('Test yechish sahifa xatosi:', err.message);
    return res.status(500).render('tests/solve', {
      title: 'Server xatosi',
      test: null,
      error: 'Server xatosi yuz berdi.'
    });
  }
};

// Test natijasi sahifasi (so‘nggi natija bo‘yicha)
exports.getTestResultPage = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).select(
      'title pdfLink totalQuestions closedCount openCount videoLink'
    );
    if (!test) {
      return res.status(404).render('tests/result', {
        title: 'Test topilmadi',
        test: null,
        result: null,
        passed: false
      });
    }

    const lastResult = await Result.findOne({
      userId: req.user._id,
      testId: test._id
    })
      .sort({ createdAt: -1 })
      .lean();

    const score = lastResult ? lastResult.score : null;
    const passed = typeof score === 'number' ? score >= 50 : false;

    res.render('tests/result', {
      title: test.title + ' — Natija',
      test,
      result: lastResult,
      passed
    });
  } catch (err) {
    console.error('Test natijasi sahifa xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

exports.getTestData = async (req, res) => {
  try {
    const test = await Test.findById(req.params.id).select(
      'title pdfLink totalQuestions closedCount openCount videoLink'
    );
    if (!test) return res.status(404).json({ message: 'Test topilmadi' });
    res.json(test);
  } catch (err) {
    console.error('Test yuklash xatosi:', err.message);
    res.status(500).json({ message: 'Server xatosi' });
  }
};

exports.submitTest = async (req, res) => {
  try {
    const { answers, openAnswers, mode, durationSeconds } = req.body; // answers: yopiq savollar uchun, openAnswers: ochiq savollar uchun
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test topilmadi' });

    const modeSafe = typeof mode === 'string' ? mode : 'timed';

    if (test.isStarEligible && test.starStartDate) {
      const nowGuard = new Date();
      if (nowGuard < test.starStartDate) {
        return res.status(400).json({
          message: 'Bu stars uchun test hali boshlanmagan. Belgilangan sana va vaqt kelgach testni yechishingiz mumkin.'
        });
      }
    }

    if (test.isStarEligible) {
      // Stars uchun testlarda faqat timed va faqat bitta urinish
      if (modeSafe === 'once') {
        return res.status(400).json({
          message: 'Bu stars uchun testni faqat vaqtli (timerli) rejimda yechish mumkin.'
        });
      }

      if (modeSafe === 'timed' && req.user) {
        const existingTimed = await Result.findOne({
          userId: req.user._id,
          testId: test._id,
          mode: 'timed'
        }).lean();

        if (existingTimed) {
          return res.status(400).json({
            message: 'Siz bu stars uchun testni allaqachon vaqtli rejimda yechgansiz. Qayta urinish berilmaydi.'
          });
        }
      }
    } else if (modeSafe === 'once' && req.user) {
      // Oddiy testlar uchun eski once-rejim cheklovi
      const existing = await Result.findOne({
        userId: req.user._id,
        testId: test._id,
        mode: 'once'
      }).lean();

      if (existing) {
        return res.status(400).json({
          message: 'Siz bu testni vaqtsiz rejimda allaqachon yechgansiz. Bu rejimda testni qayta yechish mumkin emas.'
        });
      }
    }

    const total = Number(test.totalQuestions || 0);
    let closed = Number(test.closedCount || 0);

    if (!closed && total && typeof test.openCount !== 'undefined' && test.openCount !== null) {
      const openQ = Number(test.openCount || 0);
      closed = Math.max(total - openQ, 0);
    }

    if (!total || !closed || !test.answersText) {
      return res.status(400).json({ message: 'Bu test hozircha onlayn yechish uchun tayyor emas.' });
    }

    const lines = (test.answersText || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Admin panelda tekshirganmiz, lekin xavfsizlik uchun yana tekshiramiz
    if (lines.length !== total) {
      return res.status(400).json({ message: 'Test javoblari noto\'g\'ri saqlangan.' });
    }

    const parsed = lines.map((line) => {
      const m = line.match(/^(\d+)\.\s*(.+)$/);
      if (!m) return null;
      return { index: Number(m[1]), answer: m[2].trim() };
    });

    if (parsed.includes(null)) {
      return res.status(400).json({ message: 'Javoblar formati noto\'g\'ri.' });
    }

    let correct = 0;

    const safeAnswers = Array.isArray(answers) ? answers : [];
    const safeOpenAnswers = Array.isArray(openAnswers) ? openAnswers : [];

    const hasClosedAnswer = safeAnswers.some((a) => {
      if (a === null || typeof a === 'undefined') return false;
      const v = a.toString().trim();
      return v.length > 0;
    });

    const hasOpenAnswer = safeOpenAnswers.some((a) => {
      if (a === null || typeof a === 'undefined') return false;
      const v = a.toString().trim();
      return v.length > 0;
    });

    const hasAnyAnswer = hasClosedAnswer || hasOpenAnswer;

    if (modeSafe === 'once' && !hasAnyAnswer) {
      return res.status(400).json({
        message: 'Vaqtsiz rejimda hech bo‘lmaganda bitta javobni belgilashingiz yoki kiritishingiz kerak.'
      });
    }

    for (let i = 0; i < total; i++) {
      const rightRaw = (parsed[i].answer || '').toString().trim();

      if (i < closed) {
        // Yopiq savollar: A/B/C/D
        const userAns = (safeAnswers[i] || '').toString().trim().toUpperCase();
        const rightAns = rightRaw.toUpperCase();
        if (userAns && userAns === rightAns) {
          correct++;
        }
      } else {
        // Ochiq savollar: sonli javoblar
        const openIndex = i - closed;
        const userOpenRaw = (safeOpenAnswers[openIndex] || '').toString().trim();
        if (!userOpenRaw) continue;

        // Raqamli taqqoslash: bo'shliqlar/vergullarni inobatga olmasdan, son sifatida solishtirishga harakat qilamiz
        const norm = (v) => v.replace(/\s+/g, '').replace(',', '.');
        const userNorm = norm(userOpenRaw);
        const rightNorm = norm(rightRaw);

        const userNum = parseFloat(userNorm);
        const rightNum = parseFloat(rightNorm);

        const userIsNum = !Number.isNaN(userNum) && Number.isFinite(userNum);
        const rightIsNum = !Number.isNaN(rightNum) && Number.isFinite(rightNum);

        if (userIsNum && rightIsNum) {
          if (userNum === rightNum) {
            correct++;
          }
        } else if (userNorm === rightNorm) {
          // Agar son emas bo'lsa, eski matn bo'yicha tekshiruv
          correct++;
        }
      }
    }

    const score = Math.round((correct / (total || 1)) * 100);
    const passed = score >= 50;

    const createdResult = await Result.create({
      userId: req.user._id,
      testId: test._id,
      score,
      mode: modeSafe,
      durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : undefined
    });

    const now = new Date();

    if (modeSafe === 'timed' && req.user && test.isStarEligible) {
      // Agar test uchun maxsus yulduzli sanalar belgilangan bo'lsa, shu oraliqda bo'lishi shart
      if (test.starStartDate && now < test.starStartDate) {
        // Hali yulduzli muddat boshlanmagan
        req.user.tests_taken.push({ testId: test._id, score });
        await req.user.save();
        return res.json({
          score,
          correct,
          totalClosed: closed,
          totalQuestions: total,
          passed,
          hasVideo: !!test.videoLink,
          videoLink: test.videoLink || null
        });
      }
      if (test.starEndDate && now > test.starEndDate) {
        // Yulduzli muddat tugagan
        req.user.tests_taken.push({ testId: test._id, score });
        await req.user.save();
        return res.json({
          score,
          correct,
          totalClosed: closed,
          totalQuestions: total,
          passed,
          hasVideo: !!test.videoLink,
          videoLink: test.videoLink || null
        });
      }
      // Stars uchun testlar bo'yicha yulduzlar test muddati tugaganidan keyin alohida hisoblanadi
    }

    req.user.tests_taken.push({ testId: test._id, score });
    await req.user.save();

    res.json({
      score,
      correct,
      totalClosed: closed,
      totalQuestions: total,
      passed,
      hasVideo: !!test.videoLink,
      videoLink: test.videoLink || null
    });
  } catch (err) {
    console.error('Test yuborish xatosi:', err.message);
    res.status(500).json({ message: 'Server xatosi' });
  }
};
