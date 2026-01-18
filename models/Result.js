const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    testId: { type: mongoose.Schema.Types.ObjectId, ref: 'Test', required: true },
    score: { type: Number, required: true },
    mode: { type: String, enum: ['timed', 'once'], default: 'timed' },
    date: { type: Date, default: Date.now },
    durationSeconds: { type: Number }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Result', resultSchema);
