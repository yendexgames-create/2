const Test = require('../models/Test');
const Result = require('../models/Result');
const StarSeason = require('../models/StarSeason');
const StarTransaction = require('../models/StarTransaction');

exports.getTestPage = async (req, res) => {
  try {
    const tests = await Test.find({}).select('title pdfLink totalQuestions closedCount openCount timerMinutes');

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

// Stars uchun testlar ro'yxati sahifasi
exports.getStarTestsPage = async (req, res) => {
  try {
    const now = new Date();
    const query = {
      isStarEligible: true,
      $and: [
        {
          $or: [
            { starStartDate: { $exists: false } },
            { starStartDate: null },
            { starStartDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { starEndDate: { $exists: false } },
            { starEndDate: null },
            { starEndDate: { $gte: now } }
          ]
        }
      ]
    };

    const tests = await Test.find(query)
      .select('title totalQuestions closedCount openCount timerMinutes starStartDate starEndDate')
      .sort({ createdAt: 1 })
      .lean();

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
      'title pdfLink totalQuestions closedCount openCount videoLink timerMinutes'
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

    if (mode === 'once' && req.user) {
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
    const { answers, openAnswers, mode } = req.body; // answers: yopiq savollar uchun, openAnswers: ochiq savollar uchun
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test topilmadi' });

    const modeSafe = typeof mode === 'string' ? mode : 'timed';

    if (modeSafe === 'once' && req.user) {
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
      mode: modeSafe
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
      const season = await StarSeason.findOne({
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now }
      })
        .sort({ createdAt: -1 })
        .lean();

      if (season) {
        const stats = await Result.aggregate([
          {
            $match: {
              testId: test._id,
              mode: 'timed',
              createdAt: { $gte: season.startDate, $lte: season.endDate }
            }
          },
          {
            $group: {
              _id: '$userId',
              bestScore: { $max: '$score' }
            }
          },
          { $sort: { bestScore: -1 } }
        ]);

        const rankEntryIndex = stats.findIndex((s) => String(s._id) === String(req.user._id));

        if (rankEntryIndex !== -1) {
          const rank = rankEntryIndex + 1;
          let starsToAdd = 0;
          if (rank === 1) starsToAdd = 3;
          else if (rank === 2) starsToAdd = 2;
          else if (rank === 3) starsToAdd = 1;

          if (starsToAdd > 0) {
            const already = await StarTransaction.findOne({
              userId: req.user._id,
              reason: 'leaderboard_rank',
              'meta.testId': test._id,
              'meta.seasonId': season._id,
              'meta.rank': rank
            }).lean();

            if (!already) {
              await StarTransaction.create({
                userId: req.user._id,
                amount: starsToAdd,
                reason: 'leaderboard_rank',
                meta: {
                  testId: test._id,
                  seasonId: season._id,
                  rank,
                  resultId: createdResult._id
                }
              });

              const currentBalance = typeof req.user.starsBalance === 'number' ? req.user.starsBalance : 0;
              req.user.starsBalance = currentBalance + starsToAdd;
            }
          }
        }
      }
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
