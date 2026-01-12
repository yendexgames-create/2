const mongoose = require('mongoose');

const starSeasonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    maxStarsPerUser: { type: Number } // ixtiyoriy umumiy limit
  },
  { timestamps: true }
);

module.exports = mongoose.model('StarSeason', starSeasonSchema);
