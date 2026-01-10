const multer = require('multer');
const cloudinary = require('../config/cloudinary');

const storage = multer.memoryStorage();
exports.uploadMiddleware = multer({ storage }).single('image');

exports.uploadChatImage = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Rasm fayli topilmadi' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ folder: 'mathclub_chat' }, (err, uploaded) => {
        if (err) return reject(err);
        resolve(uploaded);
      });
      stream.end(req.file.buffer);
    });

    if (!result || !result.secure_url) {
      console.error('uploadChatImage: Cloudinary javobi noto\'g\'ri:', result);
      return res.status(500).json({ error: 'Rasm yuklash amalga oshmadi' });
    }

    return res.json({ url: result.secure_url });
  } catch (err) {
    console.error('uploadChatImage xatosi:', err);
    return res.status(500).json({ error: 'Rasm yuklashda server xatosi', message: err.message || null });
  }
};
