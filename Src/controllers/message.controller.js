const Message = require('../models/Messages');
const Chat = require('../models/Chat');
const { StatusCodes } = require('http-status-codes');

/**
 * @desc    Send a message
 * @route   POST /api/messages
 * @access  Private
 */
const sendMessage = async (req, res) => {
  try {
    const { chat, content } = req.body;

    if (!chat || !content || content.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Chat ID and content are required'
      });
    }

    // Check if chat exists
    const chatDoc = await Chat.findById(chat);

    if (!chatDoc) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant in the chat
    const isParticipant = chatDoc.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Create message
    const message = await Message.create({
      chat,
      sender: req.user.id,
      content
    });

    // Update chat's last message and timestamp
    await Chat.findByIdAndUpdate(chat, {
      last_message: message._id,
      updated_at: new Date()
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username display_name avatar_url is_verified')
      .populate('chat');

    // Here you can emit socket event for real-time messaging
    // io.to(chat).emit('new_message', populatedMessage);

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error sending message',
      error: error.message
    });
  }
};

/**
 * @desc    Get messages for a chat
 * @route   GET /api/messages/chat/:chatId
 * @access  Private
 */
const getMessagesByChat = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Check if chat exists
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    const messages = await Message.find({
      chat: req.params.chatId,
      is_deleted: false
    })
      .populate('sender', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Message.countDocuments({
      chat: req.params.chatId,
      is_deleted: false
    });

    // Mark messages as read
    await Message.updateMany(
      {
        chat: req.params.chatId,
        sender: { $ne: req.user.id },
        is_read: false
      },
      { is_read: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      data: messages.reverse(), // Return in chronological order
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_messages: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching messages',
      error: error.message
    });
  }
};

/**
 * @desc    Get single message by ID
 * @route   GET /api/messages/:id
 * @access  Private
 */
const getMessageById = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      is_deleted: false
    })
      .populate('sender', 'username display_name avatar_url is_verified')
      .populate('chat');

    if (!message) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is a participant in the chat
    const chat = await Chat.findById(message.chat);
    const isParticipant = chat.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not authorized to view this message'
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching message',
      error: error.message
    });
  }
};

/**
 * @desc    Update a message
 * @route   PUT /api/messages/:id
 * @access  Private
 */
const updateMessage = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Content is required'
      });
    }

    const message = await Message.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!message) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to update this message'
      });
    }

    message.content = content;
    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate('sender', 'username display_name avatar_url is_verified')
      .populate('chat');

    // Emit socket event for real-time update
    // io.to(message.chat.toString()).emit('message_updated', updatedMessage);

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedMessage
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error updating message',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a message (soft delete)
 * @route   DELETE /api/messages/:id
 * @access  Private
 */
const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!message) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user.id) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'Not authorized to delete this message'
      });
    }

    message.is_deleted = true;
    await message.save();

    // Emit socket event for real-time update
    // io.to(message.chat.toString()).emit('message_deleted', { messageId: message._id });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting message',
      error: error.message
    });
  }
};

/**
 * @desc    Mark message as read
 * @route   PATCH /api/messages/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      is_deleted: false
    });

    if (!message) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is a participant (not the sender)
    const chat = await Chat.findById(message.chat);
    const isParticipant = chat.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not authorized to mark this message as read'
      });
    }

    message.is_read = true;
    await message.save();

    // Emit socket event for real-time update
    // io.to(message.chat.toString()).emit('message_read', { messageId: message._id });

    res.status(StatusCodes.OK).json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error marking message as read',
      error: error.message
    });
  }
};

/**
 * @desc    Mark all messages in chat as read
 * @route   PATCH /api/messages/chat/:chatId/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    // Check if chat exists
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    const result = await Message.updateMany(
      {
        chat: req.params.chatId,
        sender: { $ne: req.user.id },
        is_read: false,
        is_deleted: false
      },
      { is_read: true }
    );

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'All messages marked as read',
      modified_count: result.modifiedCount
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error marking messages as read',
      error: error.message
    });
  }
};

/**
 * @desc    Get unread message count for a chat
 * @route   GET /api/messages/chat/:chatId/unread-count
 * @access  Private
 */
const getUnreadCount = async (req, res) => {
  try {
    // Check if chat exists
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    const count = await Message.countDocuments({
      chat: req.params.chatId,
      sender: { $ne: req.user.id },
      is_read: false,
      is_deleted: false
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
 * @desc    Search messages in a chat
 * @route   GET /api/messages/chat/:chatId/search
 * @access  Private
 */
const searchMessages = async (req, res) => {
  try {
    const { query, page = 1, limit = 20 } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Check if chat exists
    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      participant => participant.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    const skip = (page - 1) * limit;

    const messages = await Message.find({
      chat: req.params.chatId,
      content: { $regex: query, $options: 'i' },
      is_deleted: false
    })
      .populate('sender', 'username display_name avatar_url is_verified')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Message.countDocuments({
      chat: req.params.chatId,
      content: { $regex: query, $options: 'i' },
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: messages,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_results: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error searching messages',
      error: error.message
    });
  }
};

module.exports = {
  sendMessage,
  getMessagesByChat,
  getMessageById,
  updateMessage,
  deleteMessage,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  searchMessages
};