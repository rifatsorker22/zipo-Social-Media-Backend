const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  last_message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

chatSchema.index({ participants: 1 });

module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema);