const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Test = require('../models/Test');
const Result = require('../models/Result');
const StarTransaction = require('../models/StarTransaction');

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

    // Stars testlari bo'yicha kechiktirilgan yulduzlarni hisoblash (faqat login bo'lgan user uchun)
    try {
      const nowForStars = new Date();
      const finishedStarTests = await Test.find({
        isStarEligible: true,
        starEndDate: { $ne: null, $lte: nowForStars }
      })
        .select('title starEndDate')
        .lean();

      const starWinNotifications = [];

      for (const t of finishedStarTests) {
        const already = await StarTransaction.findOne({
          userId: user._id,
          reason: 'star_test_rank',
          'meta.testId': t._id
        }).lean();

        if (already) {
          continue;
        }

        const rows = await Result.aggregate([
          {
            $match: {
              testId: t._id,
              mode: 'timed'
            }
          },
          {
            $group: {
              _id: '$userId',
              bestScore: { $max: '$score' },
              bestDuration: { $min: '$durationSeconds' }
            }
          },
          {
            $addFields: {
              sortDuration: { $ifNull: ['$bestDuration', 9999999] }
            }
          },
          { $sort: { bestScore: -1, sortDuration: 1 } },
          { $limit: 3 }
        ]);

        let userRank = null;
        rows.forEach((r, idx) => {
          if (String(r._id) === String(user._id)) {
            userRank = idx + 1;
          }
        });

        if (!userRank || userRank > 3) {
          continue;
        }

        let starsToAdd = 0;
        if (userRank === 1) starsToAdd = 3;
        else if (userRank === 2) starsToAdd = 2;
        else if (userRank === 3) starsToAdd = 1;

        if (starsToAdd > 0) {
          await StarTransaction.create({
            userId: user._id,
            amount: starsToAdd,
            reason: 'star_test_rank',
            meta: {
              testId: t._id,
              rank: userRank
            }
          });

          const currentBalance = typeof user.starsBalance === 'number' ? user.starsBalance : 0;
          user.starsBalance = currentBalance + starsToAdd;

          starWinNotifications.push({
            testTitle: t.title,
            rank: userRank,
            stars: starsToAdd
          });
        }
      }

      if (starWinNotifications.length) {
        res.locals.starWinNotifications = starWinNotifications;
        await user.save();
      }
    } catch (starErr) {
      console.error('Stars test mukofotlarini hisoblash xatosi:', starErr.message);
    }

    // Stars testlari bo'yicha kechiktirilgan mukofotlarni hisoblash
    try {
      const nowReward = new Date();

      // Bu foydalanuvchiga allaqachon berilgan stars-test mukofotlari
      const prevRewards = await StarTransaction.find({
        userId: user._id,
        reason: 'star_test_rank'
      })
        .select('meta.testId')
        .lean();

      const rewardedTestIds = prevRewards
        .map((tr) => tr.meta && tr.meta.testId)
        .filter((id) => !!id);

      const starTestsToCheck = await Test.find({
        isStarEligible: true,
        starEndDate: { $lte: nowReward },
        _id: { $nin: rewardedTestIds }
      })
        .select('title starEndDate')
        .lean();

      const wins = [];

      for (const t of starTestsToCheck) {
        const rows = await Result.aggregate([
          {
            $match: {
              testId: t._id,
              mode: 'timed',
              createdAt: { $lte: t.starEndDate }
            }
          },
          {
            $group: {
              _id: '$userId',
              bestScore: { $max: '$score' },
              bestDuration: { $min: '$durationSeconds' }
            }
          },
          {
            $addFields: {
              sortDuration: { $ifNull: ['$bestDuration', 9999999] }
            }
          },
          { $sort: { bestScore: -1, sortDuration: 1 } },
          { $limit: 3 }
        ]);

        const idx = rows.findIndex((r) => String(r._id) === String(user._id));
        if (idx === -1) continue;

        const rank = idx + 1;
        let starsToAdd = 0;
        if (rank === 1) starsToAdd = 3;
        else if (rank === 2) starsToAdd = 2;
        else if (rank === 3) starsToAdd = 1;
        if (!starsToAdd) continue;

        await StarTransaction.create({
          userId: user._id,
          amount: starsToAdd,
          reason: 'star_test_rank',
          meta: {
            testId: t._id,
            rank
          }
        });

        const currentBalance = typeof user.starsBalance === 'number' ? user.starsBalance : 0;
        user.starsBalance = currentBalance + starsToAdd;

        wins.push({
          testTitle: t.title,
          rank,
          stars: starsToAdd
        });
      }

      if (wins.length) {
        await user.save();
        res.locals.user = user;
        res.locals.starWinNotifications = wins;
      }
    } catch (e) {
      console.error('Stars test mukofotlari hisoblash xatosi:', e.message);
    }

    // Aktiv starlik testni topish (banner uchun)
    const now = new Date();
    const activeStarTest = await Test.findOne({
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
    })
      .select('title starStartDate starEndDate timerMinutes totalQuestions')
      .sort({ createdAt: 1 })
      .lean();

    res.locals.activeStarTest = activeStarTest || null;
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

      // Stars testlari bo'yicha kechiktirilgan mukofotlarni hisoblash
      try {
        const nowReward = new Date();

        const prevRewards = await StarTransaction.find({
          userId: user._id,
          reason: 'star_test_rank'
        })
          .select('meta.testId')
          .lean();

        const rewardedTestIds = prevRewards
          .map((tr) => tr.meta && tr.meta.testId)
          .filter((id) => !!id);

        const starTestsToCheck = await Test.find({
          isStarEligible: true,
          starEndDate: { $lte: nowReward },
          _id: { $nin: rewardedTestIds }
        })
          .select('title starEndDate')
          .lean();

        const wins = [];

        for (const t of starTestsToCheck) {
          const rows = await Result.aggregate([
            {
              $match: {
                testId: t._id,
                mode: 'timed',
                createdAt: { $lte: t.starEndDate }
              }
            },
            {
              $group: {
                _id: '$userId',
                bestScore: { $max: '$score' },
                bestDuration: { $min: '$durationSeconds' }
              }
            },
            {
              $addFields: {
                sortDuration: { $ifNull: ['$bestDuration', 9999999] }
              }
            },
            { $sort: { bestScore: -1, sortDuration: 1 } },
            { $limit: 3 }
          ]);

          const idx = rows.findIndex((r) => String(r._id) === String(user._id));
          if (idx === -1) continue;

          const rank = idx + 1;
          let starsToAdd = 0;
          if (rank === 1) starsToAdd = 3;
          else if (rank === 2) starsToAdd = 2;
          else if (rank === 3) starsToAdd = 1;
          if (!starsToAdd) continue;

          await StarTransaction.create({
            userId: user._id,
            amount: starsToAdd,
            reason: 'star_test_rank',
            meta: {
              testId: t._id,
              rank
            }
          });

          const currentBalance = typeof user.starsBalance === 'number' ? user.starsBalance : 0;
          user.starsBalance = currentBalance + starsToAdd;

          wins.push({
            testTitle: t.title,
            rank,
            stars: starsToAdd
          });
        }

        if (wins.length) {
          await user.save();
          res.locals.user = user;
          res.locals.starWinNotifications = wins;
        }
      } catch (e) {
        console.error('Stars test mukofotlari hisoblash xatosi (optional):', e.message);
      }
    }

    // Foydalanuvchi bo'lsin-bo'lmasin, aktiv starlik testni banner uchun topamiz
    const now = new Date();
    const activeStarTest = await Test.findOne({
      isStarEligible: true,
      $or: [
        { starStartDate: { $exists: false } },
        { starStartDate: null },
        { starStartDate: { $lte: now } }
      ],
      $or: [
        { starEndDate: { $exists: false } },
        { starEndDate: null },
        { starEndDate: { $gte: now } }
      ]
    })
      .select('title starStartDate starEndDate timerMinutes totalQuestions')
      .sort({ createdAt: 1 })
      .lean();

    res.locals.activeStarTest = activeStarTest || null;

    return next();
  } catch (err) {
    return next();
  }
};

module.exports = { ensureAuth, ensureAuthOptional };
