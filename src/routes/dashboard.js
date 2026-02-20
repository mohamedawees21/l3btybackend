// backend/src/routes/dashboard.js
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/auth');

// أضف هذا في routes/dashboard.js
router.get('/health', (req, res) => {
  console.log('🏥 فحص صحة الداشبورد...');
  res.json({
    success: true,
    message: 'الداشبورد يعمل بشكل صحيح',
    timestamp: new Date().toISOString()
  });
});

router.get('/test-db', async (req, res) => {
  try {
    console.log('🔍 اختبار اتصال قاعدة البيانات...');
    
    // اختبار بسيط
    const [result] = await req.db.execute('SELECT 1 as test');
    
    res.json({
      success: true,
      message: 'قاعدة البيانات متصلة',
      test: result[0]
    });
  } catch (error) {
    console.error('❌ فشل اختبار قاعدة البيانات:', error);
    res.status(500).json({
      success: false,
      message: 'فشل اتصال قاعدة البيانات',
      error: error.message
    });
  }
});