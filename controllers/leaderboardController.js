const Result = require('../models/Result');
const User = require('../models/User');

exports.getLeaderboard = async (req, res) => {
  try {
    // Har foydalanuvchi bo'yicha o'rtacha ball va testlar soni
    const stats = await Result.aggregate([
      {
        $group: {
          _id: '$userId',
          avgScore: { $avg: '$score' },
          testsCount: { $sum: 1 }
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

    const leaderboard = stats.map((s, idx) => {
      const u = userMap.get(String(s._id));
      if (!u) return null;
      return {
        rank: idx + 1,
        userId: s._id,
        name: u.name || 'Foydalanuvchi',
        avatar: u.avatar || null,
        testsCount: s.testsCount,
        avgScore: Math.round(s.avgScore)
      };
    }).filter(Boolean);

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
