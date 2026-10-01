const express = require('express');
const router = express.Router();

const {
  getMyNotifications,
  markNotificationAsRead,
  deleteNotification
} = require('../controllers/notificationController');

const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, getMyNotifications);
router.patch('/:id/read', authMiddleware, markNotificationAsRead);
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;
