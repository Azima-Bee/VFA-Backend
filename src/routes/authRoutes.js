const express = require('express');
const router = express.Router();

const {
  register,
  login,
  getMe,
  changePassword,
  deleteAccount,
  forgotPassword
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.get('/me', authMiddleware, getMe);
router.post('/change-password', authMiddleware, changePassword);
router.delete('/account', authMiddleware, deleteAccount);

module.exports = router;
