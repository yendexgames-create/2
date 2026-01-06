const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mathclub');
    console.log(`MongoDB ulandi: ${conn.connection.host}`);
  } catch (err) {
    console.error('MongoDB ulanish xatosi:', err.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
