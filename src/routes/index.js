const express = require('express');
const router = express.Router();

// استيراد جميع المسارات
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const branchRoutes = require('./branches');
const gameRoutes = require('./games');
const rentalRoutes = require('./rentals');
const reportRoutes = require('./reports');
const analyticsRoutes = require('./analytics');
const activityRoutes = require('./activities');

// ربط المسارات
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/branches', branchRoutes);
router.use('/games', gameRoutes);
router.use('/rentals', rentalRoutes);
router.use('/reports', reportRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/activities', activityRoutes);

// مسار الصحة
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'الخادم يعمل بشكل طبيعي',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;