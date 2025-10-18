const express = require('express');
const router = express.Router();
const {
  createOrGetChat,
  getUserChats,
  getChatById,
  deleteChat,
  getTotalUnreadCount,
  searchChats
} = require('../controllers/chat.controller');
const { protect } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(protect);

// Search chats (must be before /:id)
router.get('/search', searchChats);

// Get total unread count (must be before /:id)
router.get('/unread-total', getTotalUnreadCount);

// Get all chats & Create or get chat
router.route('/')
  .get(getUserChats)
  .post(createOrGetChat);

// Single chat operations
router.route('/:id')
  .get(getChatById)
  .delete(deleteChat);

module.exports = router;