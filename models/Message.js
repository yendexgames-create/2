const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    from: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    text: {
      type: String,
      trim: true
    },
    imageUrl: {
      type: String,
      trim: true
    },
    seenByUser: { type: Boolean, default: false },
    seenByAdmin: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// Hech bo'lmaganda text yoki imageUrl bo'lishi kerak
messageSchema.pre('validate', function (next) {
  if (!this.text && !this.imageUrl) {
    this.invalidate('text', 'Xabar matni yoki rasm bo‘lishi kerak');
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);
