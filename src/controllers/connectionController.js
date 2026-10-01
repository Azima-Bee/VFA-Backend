const { pool } = require('../config/database');
const { createNotification } = require('../services/notificationService');

/**
 * Send a connection request to another user
 * POST /api/connections/:userId
 */
const sendConnectionRequest = async (req, res) => {
  try {
    const senderId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    // Prevent self connection
    if (senderId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot connect with yourself'
      });
    }

    // Check if target user exists
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE id = ?',
      [targetUserId]
    );

    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check existing connections in either direction
    const [existing] = await pool.query(
      `SELECT id, sender_id, receiver_id, status FROM connections
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [senderId, targetUserId, targetUserId, senderId]
    );

    if (existing.length > 0) {
      const conn = existing[0];
      if (conn.status === 'pending') {
        return res.status(409).json({
          success: false,
          message: 'Connection request already pending'
        });
      }
      if (conn.status === 'accepted') {
        return res.status(409).json({
          success: false,
          message: 'Already connected with this user'
        });
      }
      if (conn.status === 'blocked') {
        return res.status(409).json({
          success: false,
          message: 'Connection request cannot be processed'
        });
      }
      if (conn.status === 'rejected') {
        // Resubmit request by updating status to pending
        await pool.query(
          'UPDATE connections SET sender_id = ?, receiver_id = ?, status = ? WHERE id = ?',
          [senderId, targetUserId, 'pending', conn.id]
        );
        return res.status(201).json({
          success: true,
          message: 'Connection request sent',
          connection: {
            id: conn.id,
            sender_id: senderId,
            receiver_id: targetUserId,
            status: 'pending'
          }
        });
      }
    }

    // Insert new connection request
    const [result] = await pool.query(
      'INSERT INTO connections (sender_id, receiver_id, status) VALUES (?, ?, ?)',
      [senderId, targetUserId, 'pending']
    );

    // Generate notification for target user
    try {
      const [senderUser] = await pool.query('SELECT full_name FROM users WHERE id = ?', [senderId]);
      const senderName = senderUser.length > 0 ? senderUser[0].full_name : 'A student';
      await createNotification(
        targetUserId,
        'New Connection Request',
        `${senderName} sent you a flatmate connection request.`,
        'connection_request'
      );
    } catch (notifErr) {
      console.warn('Failed to create connection notification:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Connection request sent',
      connection: {
        id: result.insertId,
        sender_id: senderId,
        receiver_id: targetUserId,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Send Connection Request Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get incoming and outgoing connections for authenticated user
 * GET /api/connections
 */
const getConnections = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT c.id, c.sender_id, c.receiver_id, c.status, c.created_at, c.updated_at,
              u_sender.full_name AS sender_name, u_sender.email AS sender_email,
              u_receiver.full_name AS receiver_name, u_receiver.email AS receiver_email
       FROM connections c
       JOIN users u_sender ON c.sender_id = u_sender.id
       JOIN users u_receiver ON c.receiver_id = u_receiver.id
       WHERE c.sender_id = ? OR c.receiver_id = ?
       ORDER BY c.updated_at DESC`,
      [userId, userId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      connections: rows
    });
  } catch (error) {
    console.error('Get Connections Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Accept a pending connection request (Receiver only)
 * PATCH /api/connections/:id/accept
 */
const acceptConnection = async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(connectionId) || connectionId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, sender_id, receiver_id, status FROM connections WHERE id = ?',
      [connectionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Connection request not found'
      });
    }

    const conn = rows[0];

    // Only receiver can accept request
    if (conn.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to accept this request'
      });
    }

    if (conn.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection request is not pending'
      });
    }

    await pool.query(
      'UPDATE connections SET status = ? WHERE id = ?',
      ['accepted', connectionId]
    );

    // Generate notification for requester
    try {
      const [receiverUser] = await pool.query('SELECT full_name FROM users WHERE id = ?', [userId]);
      const receiverName = receiverUser.length > 0 ? receiverUser[0].full_name : 'A student';
      await createNotification(
        conn.sender_id,
        'Connection Accepted',
        `${receiverName} accepted your flatmate connection request!`,
        'connection_accept'
      );
    } catch (notifErr) {
      console.warn('Failed to create accept connection notification:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Connection request accepted'
    });
  } catch (error) {
    console.error('Accept Connection Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reject a pending connection request (Receiver only)
 * PATCH /api/connections/:id/reject
 */
const rejectConnection = async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(connectionId) || connectionId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, sender_id, receiver_id, status FROM connections WHERE id = ?',
      [connectionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Connection request not found'
      });
    }

    const conn = rows[0];

    // Only receiver can reject request
    if (conn.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to reject this request'
      });
    }

    if (conn.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Connection request is not pending'
      });
    }

    await pool.query(
      'UPDATE connections SET status = ? WHERE id = ?',
      ['rejected', connectionId]
    );

    return res.status(200).json({
      success: true,
      message: 'Connection request rejected'
    });
  } catch (error) {
    console.error('Reject Connection Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Block a connection (Either participant)
 * PATCH /api/connections/:id/block
 */
const blockConnection = async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(connectionId) || connectionId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, sender_id, receiver_id, status FROM connections WHERE id = ?',
      [connectionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    const conn = rows[0];

    // Either participant can block
    if (conn.sender_id !== userId && conn.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to block this connection'
      });
    }

    await pool.query(
      'UPDATE connections SET status = ? WHERE id = ?',
      ['blocked', connectionId]
    );

    return res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Block Connection Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete a connection/request (Either participant)
 * DELETE /api/connections/:id
 */
const deleteConnection = async (req, res) => {
  try {
    const connectionId = parseInt(req.params.id, 10);
    const userId = req.user.id;

    if (isNaN(connectionId) || connectionId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid connection ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, sender_id, receiver_id FROM connections WHERE id = ?',
      [connectionId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Connection not found'
      });
    }

    const conn = rows[0];

    // Either participant can delete
    if (conn.sender_id !== userId && conn.receiver_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this connection'
      });
    }

    await pool.query(
      'DELETE FROM connections WHERE id = ?',
      [connectionId]
    );

    return res.status(200).json({
      success: true,
      message: 'Connection deleted successfully'
    });
  } catch (error) {
    console.error('Delete Connection Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Block a user directly by user ID
 * POST /api/connections/block/:userId
 */
const blockUserDirect = async (req, res) => {
  try {
    const senderId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    if (senderId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself'
      });
    }

    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (userRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const [existing] = await pool.query(
      `SELECT id FROM connections
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [senderId, targetUserId, targetUserId, senderId]
    );

    if (existing.length > 0) {
      await pool.query('UPDATE connections SET status = ? WHERE id = ?', ['blocked', existing[0].id]);
    } else {
      await pool.query(
        'INSERT INTO connections (sender_id, receiver_id, status) VALUES (?, ?, ?)',
        [senderId, targetUserId, 'blocked']
      );
    }

    return res.status(200).json({
      success: true,
      message: 'User blocked successfully'
    });
  } catch (error) {
    console.error('Direct Block Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Unblock a user directly by user ID
 * POST /api/connections/unblock/:userId
 */
const unblockUserDirect = async (req, res) => {
  try {
    const senderId = req.user.id;
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const [existing] = await pool.query(
      `SELECT id FROM connections
       WHERE ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
       AND status = 'blocked'`,
      [senderId, targetUserId, targetUserId, senderId]
    );

    if (existing.length > 0) {
      await pool.query('DELETE FROM connections WHERE id = ?', [existing[0].id]);
    }

    return res.status(200).json({
      success: true,
      message: 'User unblocked successfully'
    });
  } catch (error) {
    console.error('Direct Unblock Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  sendConnectionRequest,
  getConnections,
  acceptConnection,
  rejectConnection,
  blockConnection,
  deleteConnection,
  blockUserDirect,
  unblockUserDirect
};
