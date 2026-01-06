const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true } // index of options
});

const testSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    pdfLink: { type: String },
    totalQuestions: { type: Number },
    closedCount: { type: Number },
    openCount: { type: Number },
    answersText: { type: String },
    videoLink: { type: String },
    questions: [questionSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);
