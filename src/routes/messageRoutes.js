const express = require('express');
const router = express.Router();

const {
  sendMessage,
  getConversationSummary,
  getConversation,
  markMessageAsRead
} = require('../controllers/messageController');

const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, sendMessage);
router.get('/', authMiddleware, getConversationSummary);
router.get('/:userId', authMiddleware, getConversation);
router.patch('/:id/read', authMiddleware, markMessageAsRead);

module.exports = router;
