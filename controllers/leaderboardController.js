const Result = require('../models/Result');
const User = require('../models/User');
const Test = require('../models/Test');

exports.getLeaderboard = async (req, res) => {
  try {
    // Faqat vaqtli (timed) urinishlar bo'yicha: har foydalanuvchi uchun o'rtacha ball va noyob testlar soni
    const stats = await Result.aggregate([
      { $match: { mode: 'timed' } },
      {
        $group: {
          _id: '$userId',
          avgScore: { $avg: '$score' },
          testsSet: { $addToSet: '$testId' }
        }
      },
      {
        $project: {
          avgScore: 1,
          testsCount: { $size: '$testsSet' }
        }
      },
      {
        $sort: { avgScore: -1, testsCount: -1 }
      }
    ]);

    if (!stats.length) {
      return res.render('leaderboard', {
        title: 'Yetakchilar',
        leaderboard: [],
        currentUserEntry: null
      });
    }

    const userIds = stats.map((s) => s._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select('name avatar')
      .lean();

    const userMap = new Map();
    users.forEach((u) => {
      userMap.set(String(u._id), u);
    });

    let leaderboard = stats.map((s) => {
      const u = userMap.get(String(s._id));
      if (!u) return null;
      return {
        userId: s._id,
        name: u.name || 'Foydalanuvchi',
        avatar: u.avatar || null,
        testsCount: s.testsCount,
        avgScore: Math.round(s.avgScore)
      };
    }).filter(Boolean);

    leaderboard = leaderboard.map((entry, idx) => ({
      ...entry,
      rank: idx + 1
    }));

    let currentUserEntry = null;
    if (req.user) {
      currentUserEntry = leaderboard.find((e) => String(e.userId) === String(req.user._id)) || null;
    }

    res.render('leaderboard', {
      title: 'Yetakchilar',
      leaderboard,
      currentUserEntry
    });
  } catch (err) {
    console.error('Leaderboard xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

// Bitta foydalanuvchi profili (yetakchilar sahifasidan ochiladi)
exports.getLeaderboardUserProfile = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select('name avatar createdAt').lean();
    if (!user) {
      return res.status(404).render('leaderboard-user', {
        title: 'Foydalanuvchi topilmadi',
        user: null,
        stats: null,
        dailyLabels: [],
        dailyCounts: [],
        dailyAvgScores: []
      });
    }

    const results = await Result.find({ userId }).select('testId score createdAt').sort({ createdAt: 1 }).lean();

    const totalAttempts = results.length;
    const uniqueTests = new Set(results.map((r) => String(r.testId))).size;
    const avgScore = totalAttempts
      ? Math.round(results.reduce((sum, r) => sum + (r.score || 0), 0) / totalAttempts)
      : 0;
    const bestScore = totalAttempts ? Math.max(...results.map((r) => r.score || 0)) : 0;
    const lastScore = totalAttempts ? results[results.length - 1].score : null;

    const passedAttempts = results.filter((r) => (r.score || 0) >= 50).length;
    const passRate = totalAttempts ? Math.round((passedAttempts / totalAttempts) * 100) : 0;

    const dailyMap = new Map();
    results.forEach((r) => {
      if (!r.createdAt) return;
      const d = r.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { date: d, testsSet: new Set(), scoreSum: 0, n: 0 });
      }
      const entry = dailyMap.get(d);
      // Har bir kunda bir xil test bir necha marta yechilsa ham, testsSet orqali 1 ta deb saqlaymiz
      entry.testsSet.add(String(r.testId));
      entry.scoreSum += r.score || 0;
      entry.n += 1;
    });

    const dailyStats = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const dailyLabels = dailyStats.map((d) => d.date);
    // Har kuni noyob testlar soni: testsSet.size
    const dailyCounts = dailyStats.map((d) => (d.testsSet ? d.testsSet.size : 0));
    const dailyAvgScores = dailyStats.map((d) => (d.n ? Math.round(d.scoreSum / d.n) : 0));

    const activeDays = dailyStats.length;
    const avgPerActiveDay = activeDays ? (totalAttempts / activeDays) : 0;

    const stats = {
      totalAttempts,
      uniqueTests,
      avgScore,
      bestScore,
      lastScore,
      passedAttempts,
      passRate,
      activeDays,
      avgPerActiveDay: Number(avgPerActiveDay.toFixed(1))
    };

    res.render('leaderboard-user', {
      title: (user.name || 'Foydalanuvchi') + ' — Profil',
      user,
      stats,
      dailyLabels,
      dailyCounts,
      dailyAvgScores
    });
  } catch (err) {
    console.error('Leaderboard user profili xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};

// Har bir test uchun alohida yetakchilar (faqat vaqtli rejimdagi urinishlar hisoblanadi)
exports.getPerTestLeaderboard = async (req, res) => {
  try {
    const tests = await Test.find({}).select('title totalQuestions').lean();

    if (!tests.length) {
      return res.render('leaderboard-tests', {
        title: 'Testlar bo‘yicha yetakchilar',
        solvedTests: [],
        otherTests: [],
        selectedTest: null,
        leaderboard: [],
        selectedTestId: null
      });
    }

    let solvedSet = new Set();
    if (req.user) {
      const timedResults = await Result.find({ userId: req.user._id, mode: 'timed' })
        .select('testId')
        .lean();
      solvedSet = new Set(timedResults.map((r) => String(r.testId)));
    }

    const solvedTests = [];
    const otherTests = [];
    tests.forEach((t) => {
      if (solvedSet.has(String(t._id))) {
        solvedTests.push(t);
      } else {
        otherTests.push(t);
      }
    });

    const paramId = req.query && req.query.test ? String(req.query.test) : null;
    let selectedTestId = null;

    if (paramId) {
      selectedTestId = paramId;
    } else if (solvedTests.length) {
      selectedTestId = String(solvedTests[0]._id);
    } else if (tests.length) {
      selectedTestId = String(tests[0]._id);
    }

    let selectedTest = null;
    let leaderboard = [];

    if (selectedTestId) {
      selectedTest = tests.find((t) => String(t._id) === String(selectedTestId)) || null;

      if (selectedTest) {
        const stats = await Result.aggregate([
          { $match: { testId: selectedTest._id, mode: 'timed' } },
          {
            $group: {
              _id: '$userId',
              bestScore: { $max: '$score' },
              attempts: { $sum: 1 }
            }
          },
          { $sort: { bestScore: -1, attempts: -1 } }
        ]);

        const userIds = stats.map((s) => s._id);
        const users = await User.find({ _id: { $in: userIds } })
          .select('name avatar')
          .lean();

        const userMap = new Map();
        users.forEach((u) => {
          userMap.set(String(u._id), u);
        });

        leaderboard = stats
          .map((s, idx) => {
            const u = userMap.get(String(s._id));
            if (!u) return null;
            return {
              userId: s._id,
              name: u.name || 'Foydalanuvchi',
              avatar: u.avatar || null,
              bestScore: s.bestScore,
              attempts: s.attempts,
              rank: idx + 1
            };
          })
          .filter(Boolean);
      }
    }

    res.render('leaderboard-tests', {
      title: 'Testlar bo‘yicha yetakchilar',
      solvedTests,
      otherTests,
      selectedTest,
      leaderboard,
      selectedTestId
    });
  } catch (err) {
    console.error('Per-test leaderboard xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};
