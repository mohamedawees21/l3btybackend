const express = require('express');
const router = express.Router();
const ActivityController = require('../controllers/activityController');
const { auth, roles } = require('../middleware');

// مسارات سجل الأنشطة
router.get('/', auth, roles(['admin']), ActivityController.getActivities);
router.get('/stats', auth, roles(['admin']), ActivityController.getActivityStats);
router.post('/log', auth, ActivityController.logActivity);

module.exports = router;