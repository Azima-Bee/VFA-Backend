const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

let io = null;

/**
 * Check if two users have an accepted connection
 */
const checkAcceptedConnection = async (userA, userB) => {
  try {
    const [rows] = await pool.query(
      `SELECT status FROM connections
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
       AND status = 'accepted'`,
      [userA, userB, userB, userA]
    );
    return rows.length > 0;
  } catch (err) {
    console.error('[Socket] Connection check error:', err.message);
    return false;
  }
};

/**
 * Format conversation room name
 */
const getConversationRoomId = (userA, userB) => {
  const sorted = [Number(userA), Number(userB)].sort((a, b) => a - b);
  return `conversation_${sorted[0]}_${sorted[1]}`;
};

/**
 * Initialize Socket.IO server
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // JWT Authentication Middleware for incoming socket connections
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
        socket.handshake.query?.token;

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('JWT_SECRET not configured on server'));
      }

      jwt.verify(token, secret, (err, decoded) => {
        if (err || !decoded) {
          return next(new Error('Invalid or expired token'));
        }
        socket.user = decoded;
        socket.userId = Number(decoded.id || decoded.userId);
        return next();
      });
    } catch (err) {
      return next(new Error('Authentication failed: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`[Socket.IO] Client connected: socket ${socket.id}, user ${userId}`);

    // Join personal user room for direct user notifications & conversation updates
    socket.join(`user_${userId}`);

    // Join a specific conversation room after verifying accepted connection
    socket.on('join_conversation', async (data, callback) => {
      try {
        const partnerId = Number(data?.partnerId);
        if (!partnerId || isNaN(partnerId) || partnerId === userId) {
          if (typeof callback === 'function') {
            return callback({ success: false, error: 'Invalid partner ID' });
          }
          return;
        }

        const isAccepted = await checkAcceptedConnection(userId, partnerId);
        if (!isAccepted) {
          if (typeof callback === 'function') {
            return callback({
              success: false,
              forbidden: true,
              error: 'Messaging restricted to accepted connections',
            });
          }
          return;
        }

        const roomId = getConversationRoomId(userId, partnerId);
        socket.join(roomId);
        console.log(`[Socket.IO] User ${userId} joined room ${roomId}`);

        if (typeof callback === 'function') {
          callback({ success: true, room: roomId });
        }
      } catch (err) {
        console.error('[Socket.IO] join_conversation error:', err.message);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Server error joining conversation' });
        }
      }
    });

    // Leave conversation room
    socket.on('leave_conversation', (data) => {
      const partnerId = Number(data?.partnerId);
      if (partnerId) {
        const roomId = getConversationRoomId(userId, partnerId);
        socket.leave(roomId);
        console.log(`[Socket.IO] User ${userId} left room ${roomId}`);
      }
    });

    // Typing indicator
    socket.on('typing', async (data) => {
      const partnerId = Number(data?.partnerId);
      const isTyping = Boolean(data?.isTyping);
      if (partnerId) {
        const roomId = getConversationRoomId(userId, partnerId);
        socket.to(roomId).emit('user_typing', {
          userId,
          partnerId,
          isTyping,
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: socket ${socket.id}, user ${userId} (${reason})`);
    });
  });

  return io;
};

/**
 * Broadcast newly created message to conversation room and recipient's user room
 */
const notifyNewMessage = (msg) => {
  if (!io) return;

  try {
    const senderId = Number(msg.sender_id || msg.senderId);
    const receiverId = Number(msg.receiver_id || msg.receiverId);

    if (!senderId || !receiverId) return;

    const roomId = getConversationRoomId(senderId, receiverId);

    // Broadcast to conversation room (for users currently inside the chat)
    io.to(roomId).emit('new_message', msg);

    // Also broadcast conversation update to user rooms (for conversation list badge / update)
    io.to(`user_${receiverId}`).emit('conversation_update', {
      partnerId: senderId,
      lastMessage: msg,
    });
    io.to(`user_${senderId}`).emit('conversation_update', {
      partnerId: receiverId,
      lastMessage: msg,
    });
  } catch (err) {
    console.error('[Socket.IO] notifyNewMessage error:', err.message);
  }
};

const getIo = () => io;

module.exports = {
  initSocket,
  notifyNewMessage,
  getIo,
  getConversationRoomId,
};
