const mongoose = require('mongoose');

const starRewardSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    costStars: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('StarReward', starRewardSchema);
