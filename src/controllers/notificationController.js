const { pool } = require('../config/database');

/**
 * Get authenticated user's notifications
 * GET /api/notifications
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `SELECT id, title, message, type, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      notifications: rows
    });
  } catch (error) {
    console.error('Get Notifications Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Mark a notification as read (Owner only)
 * PATCH /api/notifications/:id/read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, user_id FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const notification = rows[0];

    // Ownership check: Only notification owner can mark as read
    if (notification.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to update this notification'
      });
    }

    await pool.query('UPDATE notifications SET is_read = true WHERE id = ?', [notificationId]);

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark Notification Read Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete a notification (Owner only)
 * DELETE /api/notifications/:id
 */
const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id, 10);

    if (isNaN(notificationId) || notificationId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID'
      });
    }

    const [rows] = await pool.query(
      'SELECT id, user_id FROM notifications WHERE id = ?',
      [notificationId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const notification = rows[0];

    // Ownership check: Only notification owner can delete
    if (notification.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this notification'
      });
    }

    await pool.query('DELETE FROM notifications WHERE id = ?', [notificationId]);

    return res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete Notification Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  deleteNotification
};
