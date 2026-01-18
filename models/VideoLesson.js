const mongoose = require('mongoose');

const videoLessonSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String },
    topic: { type: mongoose.Schema.Types.ObjectId, ref: 'VideoTopic', required: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('VideoLesson', videoLessonSchema);
