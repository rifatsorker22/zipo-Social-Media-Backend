const Notification = require('../models/Notification');
const { StatusCodes } = require('http-status-codes');

/**
 * @desc    Get all notifications for authenticated user
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unread_only } = req.query;
    const skip = (page - 1) * limit;

    const filter = { recipient: req.user.id };
    if (unread_only === 'true') {
      filter.is_read = false;
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'username avatar full_name')
      .populate('post', 'content images')
      .populate('comment', 'content')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      recipient: req.user.id,
      is_read: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: notifications,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_notifications: total,
        unread_count: unreadCount
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user.id,
      is_read: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      unread_count: count
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching unread count',
      error: error.message
    });
  }
};

/**
 * @desc    Mark notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id },
      { is_read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all notifications as read
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { recipient: req.user.id, is_read: false },
      { is_read: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'All notifications marked as read',
      modified_count: result.modifiedCount
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:id
 * @access  Private
 */
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.id
    });

    if (!notification) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting notification',
      error: error.message
    });
  }
};

/**
 * @desc    Delete all notifications
 * @route   DELETE /api/notifications
 * @access  Private
 */
const deleteAllNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      recipient: req.user.id
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'All notifications deleted successfully',
      deleted_count: result.deletedCount
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting notifications',
      error: error.message
    });
  }
};

/**
 * @desc    Create a notification (typically called internally)
 * @route   POST /api/notifications
 * @access  Private
 */
const createNotification = async (req, res) => {
  try {
    const { recipient, sender, type, post, comment } = req.body;

    // Validation
    if (!recipient || !type) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Recipient and type are required'
      });
    }

    // Don't create notification if user is notifying themselves
    if (recipient === sender) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Cannot create notification for yourself'
      });
    }

    const notification = await Notification.create({
      recipient,
      sender,
      type,
      post,
      comment
    });

    const populatedNotification = await Notification.findById(notification._id)
      .populate('sender', 'username avatar full_name')
      .populate('post', 'content images')
      .populate('comment', 'content');

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: populatedNotification
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error creating notification',
      error: error.message
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  createNotification
};