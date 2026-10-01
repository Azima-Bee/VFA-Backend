const mysql = require('mysql2/promise');
require('dotenv').config();

// Create MySQL connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flatmate_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Test database connection
 * Returns { success: boolean, message: string }
 */
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return {
      success: true,
      message: 'Database connected successfully'
    };
  } catch (error) {
    console.error('MySQL Database Connection Error:', error.message);
    return {
      success: false,
      message: 'Failed to connect to database',
      error: error.message
    };
  }
};

module.exports = {
  pool,
  testConnection
};
