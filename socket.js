const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./Src/models/User');
const Chat = require('./Src/models/Chat');

// Store online users
const onlineUsers = new Map();

/**
 * Initialize Socket.io
 * @param {Object} server - HTTP server instance
 */
const initializeSocket = (server) => {
  const io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (!user || !user.is_active) {
        return next(new Error('Authentication error: Invalid user'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Add user to online users
    onlineUsers.set(socket.userId, socket.id);

    // Emit user online status
    socket.broadcast.emit('user_online', { userId: socket.userId });

    // Join user's personal room
    socket.join(socket.userId);

    // Get online status
    socket.on('get_online_users', () => {
      const onlineUserIds = Array.from(onlineUsers.keys());
      socket.emit('online_users', onlineUserIds);
    });

    // Join chat room
    socket.on('join_chat', async (chatId) => {
      try {
        // Verify user is participant
        const chat = await Chat.findById(chatId);
        if (!chat) {
          return socket.emit('error', { message: 'Chat not found' });
        }

        const isParticipant = chat.participants.some(
          p => p.toString() === socket.userId
        );

        if (!isParticipant) {
          return socket.emit('error', { message: 'Not authorized to join this chat' });
        }

        socket.join(chatId);
        console.log(`User ${socket.userId} joined chat ${chatId}`);
        
        // Notify other participants
        socket.to(chatId).emit('user_joined_chat', {
          userId: socket.userId,
          chatId: chatId
        });
      } catch (error) {
        socket.emit('error', { message: 'Error joining chat' });
      }
    });

    // Leave chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${socket.userId} left chat ${chatId}`);
      
      socket.to(chatId).emit('user_left_chat', {
        userId: socket.userId,
        chatId: chatId
      });
    });

    // Typing indicator
    socket.on('typing_start', (data) => {
      socket.to(data.chatId).emit('user_typing', {
        userId: socket.userId,
        chatId: data.chatId,
        username: socket.user.username,
        display_name: socket.user.display_name
      });
    });

    socket.on('typing_stop', (data) => {
      socket.to(data.chatId).emit('user_stopped_typing', {
        userId: socket.userId,
        chatId: data.chatId
      });
    });

    // Message sent (emitted from controller)
    socket.on('message_sent', (message) => {
      // Broadcast to chat room
      socket.to(message.chat).emit('new_message', message);
      
      // Send notification to offline users
      const chatParticipants = message.chat_participants || [];
      chatParticipants.forEach(participantId => {
        if (participantId !== socket.userId && !onlineUsers.has(participantId)) {
          // Here you can trigger push notification
          console.log(`Send push notification to ${participantId}`);
        }
      });
    });

    // Message updated
    socket.on('message_updated', (data) => {
      socket.to(data.chatId).emit('message_updated', data);
    });

    // Message deleted
    socket.on('message_deleted', (data) => {
      socket.to(data.chatId).emit('message_deleted', data);
    });

    // Message read
    socket.on('message_read', (data) => {
      socket.to(data.chatId).emit('message_read', {
        messageId: data.messageId,
        userId: socket.userId
      });
    });

    // Messages read (bulk)
    socket.on('messages_read', (data) => {
      socket.to(data.chatId).emit('messages_read', {
        chatId: data.chatId,
        userId: socket.userId
      });
    });

    // Video call signaling
    socket.on('call_user', (data) => {
      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('incoming_call', {
          callerId: socket.userId,
          callerName: socket.user.display_name,
          chatId: data.chatId,
          offer: data.offer
        });
      }
    });

    socket.on('answer_call', (data) => {
      const callerSocketId = onlineUsers.get(data.callerId);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call_answered', {
          answer: data.answer
        });
      }
    });

    socket.on('ice_candidate', (data) => {
      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('ice_candidate', {
          candidate: data.candidate,
          senderId: socket.userId
        });
      }
    });

    socket.on('end_call', (data) => {
      const recipientSocketId = onlineUsers.get(data.recipientId);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('call_ended', {
          userId: socket.userId
        });
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      
      // Remove from online users
      onlineUsers.delete(socket.userId);
      
      // Broadcast offline status
      socket.broadcast.emit('user_offline', { userId: socket.userId });
    });

    // Error handler
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

// Helper function to emit to specific user
const emitToUser = (io, userId, event, data) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

// Helper function to emit to chat room
const emitToChat = (io, chatId, event, data) => {
  io.to(chatId).emit(event, data);
};

// Get online users count
const getOnlineUsersCount = () => {
  return onlineUsers.size;
};

// Check if user is online
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

module.exports = {
  initializeSocket,
  emitToUser,
  emitToChat,
  getOnlineUsersCount,
  isUserOnline
};