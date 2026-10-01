const express = require('express');
const router = express.Router();

const {
  createOrUpdateProfile,
  getOwnProfile,
  getUserProfile
} = require('../controllers/profileController');

const authMiddleware = require('../middleware/authMiddleware');

router.put('/', authMiddleware, createOrUpdateProfile);
router.get('/', authMiddleware, getOwnProfile);
router.get('/:userId', authMiddleware, getUserProfile);

module.exports = router;
