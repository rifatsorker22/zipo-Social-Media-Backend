const Chat = require('../models/Chat');
const Message = require('../models/Messages');
const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');

/**
 * @desc    Create or get existing chat
 * @route   POST /api/chats
 * @access  Private
 */
const createOrGetChat = async (req, res) => {
  try {
    const { participant } = req.body;

    if (!participant) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Participant user ID is required'
      });
    }

    // Check if trying to chat with self
    if (participant === req.user.id) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Cannot create chat with yourself'
      });
    }

    // Check if participant exists
    const participantUser = await User.findById(participant);
    if (!participantUser) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if chat already exists (bidirectional)
    let chat = await Chat.findOne({
      participants: { $all: [req.user.id, participant], $size: 2 }
    })
      .populate('participants', 'username display_name avatar_url is_verified')
      .populate({
        path: 'last_message',
        populate: { path: 'sender', select: 'username display_name avatar_url' }
      });

    if (chat) {
      return res.status(StatusCodes.OK).json({
        success: true,
        data: chat,
        is_new: false
      });
    }

    // Create new chat
    chat = await Chat.create({
      participants: [req.user.id, participant]
    });

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'username display_name avatar_url is_verified');

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: populatedChat,
      is_new: true
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error creating chat',
      error: error.message
    });
  }
};

/**
 * @desc    Get all chats for user
 * @route   GET /api/chats
 * @access  Private
 */
const getUserChats = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const chats = await Chat.find({
      participants: req.user.id
    })
      .populate('participants', 'username display_name avatar_url is_verified')
      .populate({
        path: 'last_message',
        populate: { path: 'sender', select: 'username display_name avatar_url' }
      })
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add unread count for each chat
    const chatsWithUnread = await Promise.all(
      chats.map(async (chat) => {
        const unreadCount = await Message.countDocuments({
          chat: chat._id,
          sender: { $ne: req.user.id },
          is_read: false,
          is_deleted: false
        });
        
        // Get other participant for display
        const otherParticipant = chat.participants.find(
          p => p._id.toString() !== req.user.id
        );
        
        return { 
          ...chat, 
          unread_count: unreadCount,
          other_participant: otherParticipant 
        };
      })
    );

    const total = await Chat.countDocuments({
      participants: req.user.id
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: chatsWithUnread,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(total / limit),
        total_chats: total
      }
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching chats',
      error: error.message
    });
  }
};

/**
 * @desc    Get single chat by ID
 * @route   GET /api/chats/:id
 * @access  Private
 */
const getChatById = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id)
      .populate('participants', 'username display_name avatar_url is_verified')
      .populate({
        path: 'last_message',
        populate: { path: 'sender', select: 'username display_name avatar_url' }
      });

    if (!chat) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is a participant
    const isParticipant = chat.participants.some(
      participant => participant._id.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not a participant in this chat'
      });
    }

    // Get unread count
    const unreadCount = await Message.countDocuments({
      chat: chat._id,
      sender: { $ne: req.user.id },
      is_read: false,
      is_deleted: false
    });

    // Get other participant
    const otherParticipant = chat.participants.find(
      p => p._id.toString() !== req.user.id
    );

    const chatData = chat.toObject();
    chatData.unread_count = unreadCount;
    chatData.other_participant = otherParticipant;

    res.status(StatusCodes.OK).json({
      success: true,
      data: chatData
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching chat',
      error: error.message
    });
  }
};

/**
 * @desc    Delete a chat
 * @route   DELETE /api/chats/:id
 * @access  Private
 */
const deleteChat = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);

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

    // Delete all messages in the chat
    await Message.deleteMany({ chat: chat._id });

    // Delete the chat
    await Chat.findByIdAndDelete(req.params.id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting chat',
      error: error.message
    });
  }
};

/**
 * @desc    Get total unread messages count
 * @route   GET /api/chats/unread-total
 * @access  Private
 */
const getTotalUnreadCount = async (req, res) => {
  try {
    // Get all user's chats
    const userChats = await Chat.find({
      participants: req.user.id
    }).select('_id');

    const chatIds = userChats.map(chat => chat._id);

    // Count unread messages across all chats
    const totalUnread = await Message.countDocuments({
      chat: { $in: chatIds },
      sender: { $ne: req.user.id },
      is_read: false,
      is_deleted: false
    });

    res.status(StatusCodes.OK).json({
      success: true,
      total_unread: totalUnread
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error fetching total unread count',
      error: error.message
    });
  }
};

/**
 * @desc    Search chats
 * @route   GET /api/chats/search
 * @access  Private
 */
const searchChats = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Get user's chats
    const chats = await Chat.find({
      participants: req.user.id
    })
      .populate('participants', 'username display_name avatar_url is_verified')
      .lean();

    // Filter chats where other participant matches search query
    const filteredChats = chats.filter(chat => {
      const otherParticipant = chat.participants.find(
        p => p._id.toString() !== req.user.id
      );
      
      if (otherParticipant) {
        const searchLower = query.toLowerCase();
        return (
          otherParticipant.username.toLowerCase().includes(searchLower) ||
          otherParticipant.display_name.toLowerCase().includes(searchLower)
        );
      }
      return false;
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: filteredChats,
      count: filteredChats.length
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error searching chats',
      error: error.message
    });
  }
};

module.exports = {
  createOrGetChat,
  getUserChats,
  getChatById,
  deleteChat,
  getTotalUnreadCount,
  searchChats
};