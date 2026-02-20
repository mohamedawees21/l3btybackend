// backend/src/routes/analytics.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');

// مسارات لوحة التحكم
router.get('/stats', authenticateToken, analyticsController.getDashboardStats);

module.exports = router;