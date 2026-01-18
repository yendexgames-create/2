const mongoose = require('mongoose');

const videoTopicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoTopic', videoTopicSchema);
