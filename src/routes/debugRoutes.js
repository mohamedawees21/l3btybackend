// backend/src/routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// جميع المسارات تتطلب مصادقة
router.use(authenticateToken);

// اختبار جلب التأجيرات
router.get('/debug/rentals', async (req, res) => {
  try {
    const user = req.user;
    const pool = req.db;
    
    console.log('🔍 [DEBUG] جلب التأجيرات للمستخدم:', user.email);
    console.log('🔍 [DEBUG] فرع المستخدم:', user.branch_id);
    
    // محاولة جلب تأجيرات مباشرة
    let query = 'SELECT COUNT(*) as count FROM rentals WHERE 1=1';
    let params = [];
    
    if (user.role !== 'admin' && user.branch_id) {
      query += ' AND branch_id = ?';
      params.push(user.branch_id);
    }
    
    const [countResult] = await pool.execute(query, params);
    const totalCount = countResult[0].count;
    
    console.log(`🔍 [DEBUG] إجمالي التأجيرات: ${totalCount}`);
    
    // محاولة جلب بعض التأجيرات
    const [rentals] = await pool.execute(
      `SELECT r.id, r.rental_number, r.customer_name, r.status, r.created_at,
              g.name as game_name, b.name as branch_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       LEFT JOIN branches b ON r.branch_id = b.id
       WHERE 1=1 ${user.role !== 'admin' && user.branch_id ? 'AND r.branch_id = ?' : ''}
       ORDER BY r.created_at DESC
       LIMIT 10`,
      user.role !== 'admin' && user.branch_id ? [user.branch_id] : []
    );
    
    console.log(`✅ [DEBUG] تم جلب ${rentals.length} تأجير للعرض`);
    
    res.json({
      success: true,
      message: '✅ اختبار جلب التأجيرات ناجح',
      totalRentals: totalCount,
      sampleRentals: rentals,
      userInfo: {
        id: user.id,
        name: user.name,
        role: user.role,
        branch_id: user.branch_id
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] خطأ في اختبار جلب التأجيرات:', error);
    console.error('❌ [DEBUG] SQL Error:', error.sqlMessage);
    
    res.status(500).json({
      success: false,
      message: 'خطأ في اختبار جلب التأجيرات',
      error: error.message,
      sqlError: error.sqlMessage
    });
  }
});

// تحقق من هيكل قاعدة البيانات
router.get('/debug/database-structure', async (req, res) => {
  try {
    const user = req.user;
    const pool = req.db;
    
    console.log('🔍 [DEBUG] جلب هيكل قاعدة البيانات');
    
    // هيكل الجداول الأساسية
    const [rentalsStructure] = await pool.execute('DESCRIBE rentals');
    const [gamesStructure] = await pool.execute('DESCRIBE games');
    const [usersStructure] = await pool.execute('DESCRIBE users');
    const [branchesStructure] = await pool.execute('DESCRIBE branches');
    
    // تعداد السجلات
    const [counts] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM rentals) as rentals_count,
        (SELECT COUNT(*) FROM games) as games_count,
        (SELECT COUNT(*) FROM users) as users_count,
        (SELECT COUNT(*) FROM branches) as branches_count
    `);
    
    res.json({
      success: true,
      message: 'هيكل قاعدة البيانات',
      structures: {
        rentals: rentalsStructure,
        games: gamesStructure,
        users: usersStructure,
        branches: branchesStructure
      },
      counts: counts[0],
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        branch_id: user.branch_id
      }
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] خطأ في جلب هيكل قاعدة البيانات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب هيكل قاعدة البيانات',
      error: error.message
    });
  }
});

// اختبار قاعدة البيانات الأساسي
router.get('/debug/test-db', async (req, res) => {
  try {
    const pool = req.db;
    
    console.log('🔍 [DEBUG] اختبار اتصال قاعدة البيانات');
    
    // اختبار اتصال بسيط
    const [result] = await pool.execute('SELECT 1 as test_value');
    
    // التحقق من الجداول
    const [tables] = await pool.execute(`
      SHOW TABLES
    `);
    
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    res.json({
      success: true,
      message: '✅ اتصال قاعدة البيانات يعمل بشكل صحيح',
      testResult: result[0],
      tables: tableNames,
      tableCount: tables.length
    });
    
  } catch (error) {
    console.error('❌ [DEBUG] خطأ في اختبار قاعدة البيانات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في اختبار قاعدة البيانات',
      error: error.message
    });
  }
});

module.exports = router;