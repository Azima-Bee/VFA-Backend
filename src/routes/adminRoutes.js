const express = require('express');
const router = express.Router();

const {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminListings,
  updateListingStatus,
  deleteAdminListing,
  getAdminVerifications,
  getAdminAuditLogs
} = require('../controllers/adminController');

const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All admin routes require valid JWT and admin role
router.use(authMiddleware);
router.use(adminMiddleware);

router.get('/stats', getAdminStats);
router.get('/users', getAdminUsers);
router.patch('/users/:id/status', updateUserStatus);
router.get('/verifications', getAdminVerifications);
router.get('/listings', getAdminListings);
router.patch('/listings/:id/status', updateListingStatus);
router.delete('/listings/:id', deleteAdminListing);
router.get('/audit-logs', getAdminAuditLogs);

module.exports = router;
