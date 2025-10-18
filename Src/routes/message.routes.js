const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessagesByChat,
  getMessageById,
  updateMessage,
  deleteMessage,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  searchMessages
} = require('../controllers/message.controller');
const { protect } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(protect);

// Get messages for a chat
router.get('/chat/:chatId', getMessagesByChat);

// Mark all messages in chat as read
router.patch('/chat/:chatId/read-all', markAllAsRead);

// Get unread count for a chat
router.get('/chat/:chatId/unread-count', getUnreadCount);

// Search messages in a chat
router.get('/chat/:chatId/search', searchMessages);

// Send a message
router.post('/', sendMessage);

// Mark message as read
router.patch('/:id/read', markAsRead);

// Single message operations
router.route('/:id')
  .get(getMessageById)
  .put(updateMessage)
  .delete(deleteMessage);

module.exports = router;