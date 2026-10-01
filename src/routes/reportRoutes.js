const express = require('express');
const router = express.Router();

const {
  submitReport,
  getMyReports,
  adminGetAllReports,
  adminUpdateReportStatus
} = require('../controllers/reportController');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

router.post('/', authMiddleware, submitReport);
router.get('/', authMiddleware, getMyReports);
router.get('/admin', authMiddleware, adminMiddleware, adminGetAllReports);
router.patch('/:id/status', authMiddleware, adminMiddleware, adminUpdateReportStatus);

module.exports = router;
