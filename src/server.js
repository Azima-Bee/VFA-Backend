const http = require('http');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { pool, testConnection } = require('./config/database');
const { initSocket } = require('./services/socketService');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const verificationRoutes = require('./routes/verificationRoutes');
const listingRoutes = require('./routes/listingRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const connectionRoutes = require('./routes/connectionRoutes');
const messageRoutes = require('./routes/messageRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO with HTTP server
initSocket(server);

// Enable CORS for React Native & mobile dev environments
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Root health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'FlatMate API is running'
  });
});

// Routes
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// Start server
server.listen(PORT, '0.0.0.0', async () => {
  console.log(`FlatMate Backend API running on port ${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health and /api/health`);
  console.log(`DB Health check available at http://localhost:${PORT}/api/health/db`);

  // Startup DB connectivity check & schema verification
  const dbStatus = await testConnection();
  if (dbStatus.success) {
    console.log(`[Database] Connection test successful: ${dbStatus.message}`);
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          admin_id INT NOT NULL,
          action VARCHAR(100) NOT NULL,
          target_type VARCHAR(50) NULL,
          target_id INT NULL,
          details TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_admin (admin_id),
          INDEX idx_audit_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch (tblErr) {
      console.warn('[Database] Audit log table check:', tblErr.message);
    }
  } else {
    console.warn(`[Database Warning] Unable to connect to MySQL database (${dbStatus.message}). Please ensure MySQL service is running and credentials in .env are correct.`);
  }
});
