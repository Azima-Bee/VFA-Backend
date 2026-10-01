const { testConnection } = require('../config/database');

/**
 * Health Controller
 * Returns API health status
 */
const getHealthStatus = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FlatMate API is running'
  });
};

/**
 * Database Health Controller
 * Tests MySQL database connectivity
 */
const getDbHealthStatus = async (req, res) => {
  try {
    const result = await testConnection();
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Database connected successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to connect to database'
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database'
    });
  }
};

module.exports = {
  getHealthStatus,
  getDbHealthStatus
};
