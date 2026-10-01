const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * JWT Authentication Middleware
 * Verifies Bearer token in Authorization header & active account status
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token required'
      });
    }

    // Expect format: Bearer <token>
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1].trim()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const token = parts[1].trim();

    // Verify token using secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'flatmate_jwt_secret_key_2026');

    // Attach user payload to request
    req.user = decoded;

    // Check if account is suspended in real-time
    try {
      const [rows] = await pool.query('SELECT account_status FROM users WHERE id = ?', [decoded.id]);
      if (rows.length > 0 && rows[0].account_status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended by administration.'
        });
      }
    } catch (dbErr) {
      // Fallback gracefully if db error
    }

    return next();
  } catch (error) {
    // Handle expired, malformed, or invalid tokens
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

module.exports = authMiddleware;
