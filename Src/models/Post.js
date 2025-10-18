const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  media_url: {
    type: String
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments_count: {
    type: Number,
    default: 0
  },
  is_deleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);