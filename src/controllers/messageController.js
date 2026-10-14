const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');
const { notifyNewMessage } = require('../services/socketService');

/**
 * Helper to verify accepted connection status between two users
 */
const checkAcceptedConnection = async (userA, userB) => {
  const [rows] = await pool.query(
    `SELECT status FROM connections
     WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
     AND status = 'accepted'`,
    [userA, userB, userB, userA]
  );
  return rows.length > 0;
};

/**
 * Send a message to another user
 * POST /api/messages
 */
const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiver_id, message } = req.body;

    // Validate receiver_id
    const receiverId = parseInt(receiver_id, 10);
    if (isNaN(receiverId) || receiverId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid receiver ID'
      });
    }

    // Prevent self messaging
    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot message yourself'
      });
    }

    // Check if receiver exists
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [receiverId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Validate message content
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text is required'
      });
    }

    const cleanMessage = message.trim();

    // Check if connection is accepted
    const isAccepted = await checkAcceptedConnection(senderId, receiverId);
    if (!isAccepted) {
      return res.status(403).json({
        success: false,
        message: 'Messaging is only allowed between accepted connections'
      });
    }

    // Insert message into database
    const [result] = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, message, is_read) VALUES (?, ?, ?, false)',
      [senderId, receiverId, cleanMessage]
    );

    // Generate message notification for receiver
    try {
      const [senderUser] = await pool.query('SELECT full_name FROM users WHERE id = ?', [senderId]);
      const senderName = senderUser.length > 0 ? senderUser[0].full_name : 'A student';
      await createNotification(
        receiverId,
        'New Message',
        `${senderName}: ${cleanMessage.substring(0, 50)}`,
        'message'
      );
    } catch (notifErr) {
      console.warn('Failed to create message notification:', notifErr.message);
    }

    const messageId = result.insertId;
    const [created] = await pool.query(
      'SELECT id, sender_id, receiver_id, message, is_read, created_at FROM messages WHERE id = ?',
      [messageId]
    );

    const messageRecord = created[0];

    // Real-time broadcast to conversation and recipient rooms
    try {
      notifyNewMessage(messageRecord);
    } catch (socketErr) {
      console.warn('[Socket.IO] Broadcast failed:', socketErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: messageRecord
    });
  } catch (error) {
    console.error('Send Message Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get conversation messages between authenticated user and target userId
 * GET /api/messages/:userId
 */
const getConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Check target user existence
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check connection permission
    const isAccepted = await checkAcceptedConnection(userId, targetUserId);
    if (!isAccepted) {
      return res.status(403).json({
        success: false,
        message: 'You can only view conversations with accepted connections'
      });
    }

    // Retrieve conversation messages
    const [messages] = await pool.query(
      `SELECT id, sender_id, receiver_id, message, is_read, created_at
       FROM messages
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
      [userId, targetUserId, targetUserId, userId]
    );

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Get Conversation Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Mark a message as read (Receiver only)
 * PATCH /api/messages/:id/read
 */
const markMessageAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = parseInt(req.params.id, 10);

    if (isNaN(messageId) || messageId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, sender_id, receiver_id, is_read FROM messages WHERE id = ?',
      [messageId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    const msg = rows[0];

    // Only receiver can mark message as read
    if (msg.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to mark this message as read'
      });
    }

    await pool.query('UPDATE messages SET is_read = true WHERE id = ?', [messageId]);

    return res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark Message Read Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get conversation summary list for authenticated user
 * GET /api/messages
 */
const getConversationSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT 
         IF(m.sender_id = ?, m.receiver_id, m.sender_id) AS partner_id,
         u.full_name AS partner_name,
         u.email AS partner_email,
         m.id AS last_message_id,
         m.sender_id AS last_sender_id,
         m.message AS last_message,
         m.is_read AS last_is_read,
         m.created_at AS last_message_time
       FROM messages m
       JOIN users u ON u.id = IF(m.sender_id = ?, m.receiver_id, m.sender_id)
       WHERE m.id IN (
         SELECT MAX(id)
         FROM messages
         WHERE sender_id = ? OR receiver_id = ?
         GROUP BY IF(sender_id = ?, receiver_id, sender_id)
       )
       ORDER BY m.created_at DESC`,
      [userId, userId, userId, userId, userId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      conversations: rows
    });
  } catch (error) {
    console.error('Get Conversation Summary Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  sendMessage,
  getConversation,
  markMessageAsRead,
  getConversationSummary
};
