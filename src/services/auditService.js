const { pool } = require('../config/database');

/**
 * Logs an administrative action into the admin_audit_logs table.
 * 
 * @param {number} adminId - ID of the admin executing the action
 * @param {string} action - Action identifier (e.g. APPROVE_VERIFICATION, SUSPEND_USER)
 * @param {string} targetType - Type of target entity (e.g. 'verification', 'user', 'listing', 'report')
 * @param {number} targetId - ID of target entity
 * @param {string|object} details - Additional contextual details
 */
const logAdminAction = async (adminId, action, targetType = null, targetId = null, details = null) => {
  try {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : (details ? String(details) : null);
    await pool.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, action, targetType, targetId, detailsStr]
    );
  } catch (err) {
    console.warn('[Audit Log Notice]:', err.message);
  }
};

module.exports = {
  logAdminAction
};
