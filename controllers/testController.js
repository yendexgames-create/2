const Test = require('../models/Test');
const Result = require('../models/Result');

exports.getTestPage = async (req, res) => {
  try {
    const tests = await Test.find({}).select('title pdfLink totalQuestions closedCount openCount');
    res.render('tests/test-page', { title: 'Testlar  Math Club', tests });
  } catch (err) {
    console.error('Test sahifa xatosi:', err.message);
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
    const { answers } = req.body; // answers: ['A','C', ...] faqat yopiq savollar uchun
    const test = await Test.findById(req.params.id);
    if (!test) return res.status(404).json({ message: 'Test topilmadi' });

    const total = Number(test.totalQuestions || 0);
    const closed = Number(test.closedCount || 0);

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
    const maxClosed = Math.min(closed, parsed.length, answers.length);
    for (let i = 0; i < maxClosed; i++) {
      const userAns = (answers[i] || '').toString().trim().toUpperCase();
      const rightAns = (parsed[i].answer || '').toString().trim().toUpperCase();
      if (userAns && userAns === rightAns) correct++;
    }

    const score = Math.round((correct / (closed || 1)) * 100);
    const passed = score >= 50;

    await Result.create({
      userId: req.user._id,
      testId: test._id,
      score
    });

    req.user.tests_taken.push({ testId: test._id, score });
    await req.user.save();

    res.json({
      score,
      correct,
      totalClosed: closed,
      passed,
      hasVideo: !!test.videoLink,
      videoLink: test.videoLink || null
    });
  } catch (err) {
    console.error('Test yuborish xatosi:', err.message);
    res.status(500).json({ message: 'Server xatosi' });
  }
};
