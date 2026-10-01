const { pool } = require('../config/database');

/**
 * Reusable Notification Service
 * Inserts a new notification into the notifications table
 * 
 * @param {number} userId - ID of user receiving notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message body
 * @param {string} [type='general'] - Notification type tag
 */
const createNotification = async (userId, title, message, type = 'general') => {
  try {
    if (!userId || !title || !message) {
      return { success: false, error: 'Missing required notification fields' };
    }

    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, false)',
      [userId, title.trim(), message.trim(), (type || 'general').trim()]
    );

    return {
      success: true,
      notificationId: result.insertId
    };
  } catch (error) {
    console.error('Create Notification Service Error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  createNotification
};
