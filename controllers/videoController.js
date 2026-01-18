const VideoTopic = require('../models/VideoTopic');
const VideoLesson = require('../models/VideoLesson');

exports.getVideoLessonsPage = async (req, res) => {
  try {
    const topics = await VideoTopic.find({}).sort({ order: 1, createdAt: 1 }).lean();
    const firstTopicId = topics.length ? topics[0]._id : null;
    const selectedTopicId = (req.query && req.query.topic) ? req.query.topic : firstTopicId;

    let lessons = [];
    if (selectedTopicId) {
      lessons = await VideoLesson.find({ topic: selectedTopicId })
        .sort({ order: 1, createdAt: 1 })
        .lean();
    }

    res.render('videos', {
      title: 'Video darsliklar — Math Club',
      topics,
      lessons,
      selectedTopicId
    });
  } catch (err) {
    console.error('Video darsliklar sahifasi xatosi:', err.message);
    res.status(500).send('Server xatosi');
  }
};
