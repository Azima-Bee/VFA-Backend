const express = require('express');
const router = express.Router();

const {
  sendConnectionRequest,
  getConnections,
  acceptConnection,
  rejectConnection,
  blockConnection,
  deleteConnection,
  blockUserDirect,
  unblockUserDirect
} = require('../controllers/connectionController');

const authMiddleware = require('../middleware/authMiddleware');

router.get('/', authMiddleware, getConnections);
router.post('/block/:userId', authMiddleware, blockUserDirect);
router.post('/unblock/:userId', authMiddleware, unblockUserDirect);
router.post('/:userId', authMiddleware, sendConnectionRequest);
router.patch('/:id/accept', authMiddleware, acceptConnection);
router.patch('/:id/reject', authMiddleware, rejectConnection);
router.patch('/:id/block', authMiddleware, blockConnection);
router.delete('/:id', authMiddleware, deleteConnection);

module.exports = router;
