const Message = require('../models/Message');

// Foydalanuvchi uchun: o'z chat tarixini olish
exports.getUserThread = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    if (!userId) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }

    const messages = await Message.find({ user: userId })
      .sort({ createdAt: 1 })
      .lean();

    res.json({ messages });
  } catch (err) {
    console.error('getUserThread xatosi:', err.message);
    res.status(500).json({ error: 'Server xatosi' });
  }
};

// Foydalanuvchi uchun: adminga matnli xabar yuborish
exports.sendUserMessage = async (req, res) => {
  try {
    const userId = req.user && req.user._id;
    const { text, imageUrl } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: 'Avval tizimga kiring' });
    }

    const cleanText = text ? text.toString().trim() : '';
    const cleanImage = imageUrl ? imageUrl.toString().trim() : '';

    if (!cleanText && !cleanImage) {
      return res.status(400).json({ error: 'Xabar matni yoki rasm bo‘lishi kerak' });
    }

    const message = await Message.create({
      user: userId,
      from: 'user',
      text: cleanText || undefined,
      imageUrl: cleanImage || undefined
    });

    res.status(201).json({ message });
  } catch (err) {
    console.error('sendUserMessage xatosi:', err.message);
    res.status(500).json({ error: 'Server xatosi' });
  }
};
