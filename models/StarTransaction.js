const mongoose = require('mongoose');

const starTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, // + berildi, - ishlatildi
    reason: { type: String, required: true },
    meta: { type: Object } // masalan { testId, seasonId, rank }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StarTransaction', starTransactionSchema);
