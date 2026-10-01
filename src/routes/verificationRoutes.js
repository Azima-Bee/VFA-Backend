const express = require('express');
const router = express.Router();

const {
  submitVerification,
  getOwnVerification,
  getUserVerification,
  updateVerificationStatus,
  adminGetAllVerifications
} = require('../controllers/verificationController');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.post('/', authMiddleware, submitVerification);
router.get('/', authMiddleware, getOwnVerification);
router.get('/admin', authMiddleware, adminMiddleware, adminGetAllVerifications);
router.get('/:userId', authMiddleware, getUserVerification);
router.patch('/:id/status', authMiddleware, adminMiddleware, updateVerificationStatus);

module.exports = router;
