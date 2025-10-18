const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification
} = require('../controllers/notification.controller');
const { protect } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(protect);

// Get unread count (must be before /:id routes)
router.get('/unread-count', getUnreadCount);

// Mark all as read (must be before /:id routes)
router.patch('/read-all', markAllAsRead);

// Get all notifications & Delete all notifications
router.route('/')
  .get(getNotifications)
  .post(createNotification)
  .delete(deleteAllNotifications);

// Mark specific notification as read
router.patch('/:id/read', markAsRead);

// Delete specific notification
router.delete('/:id', deleteNotification);

module.exports = router;