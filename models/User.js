const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String },
    avatar: { type: String },
    tests_taken: [
      {
        testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test' },
        score: Number,
        date: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
