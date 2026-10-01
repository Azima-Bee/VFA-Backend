const express = require('express');
const router = express.Router();
const { getHealthStatus, getDbHealthStatus } = require('../controllers/healthController');

router.get('/health', getHealthStatus);
router.get('/health/db', getDbHealthStatus);

module.exports = router;
