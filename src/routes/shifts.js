const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticateToken, checkRole } = require('../middleware/auth');

// 🕒 بدء شيفت جديد
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const branch_id = user.branch_id;

    console.log('📝 محاولة بدء شيفت جديد:', {
      employee_id: user.id,
      employee_name: user.name,
      branch_id: branch_id
    });

    // التحقق من وجود شيفت نشط
    const [activeShift] = await pool.execute(
      `SELECT id FROM shifts 
       WHERE employee_id = ? AND status = 'نشط' 
       AND DATE(start_time) = CURDATE()`,
      [user.id]
    );

    if (activeShift.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'يوجد شيفت نشط بالفعل لهذا الموظف'
      });
    }

    // الحصول على اسم الفرع
    const [branch] = await pool.execute(
      'SELECT name FROM branches WHERE id = ?',
      [branch_id]
    );

    const branch_name = branch.length > 0 ? branch[0].name : 'غير معروف';

    // إنشاء شيفت جديد
    const [result] = await pool.execute(
      `INSERT INTO shifts (
        employee_id, employee_name, 
        branch_id, branch_name,
        start_time, status
      ) VALUES (?, ?, ?, ?, NOW(), 'نشط')`,
      [
        user.id, user.name,
        branch_id, branch_name
      ]
    );

    console.log('✅ تم إنشاء شيفت جديد:', result.insertId);

    res.json({
      success: true,
      message: 'تم بدء الشيفت بنجاح',
      shift_id: result.insertId,
      data: {
        id: result.insertId,
        employee_id: user.id,
        employee_name: user.name,
        branch_id: branch_id,
        branch_name: branch_name,
        start_time: new Date(),
        status: 'نشط'
      }
    });

  } catch (error) {
    console.error('❌ خطأ في بدء الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في بدء الشيفت',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 🏁 إنهاء شيفت
router.post('/:id/end', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log('📝 محاولة إنهاء شيفت:', { shift_id: id, employee_id: user.id });

    // جلب بيانات الشيفت
    const [shift] = await pool.execute(
      `SELECT * FROM shifts 
       WHERE id = ? AND employee_id = ? AND status = 'نشط'`,
      [id, user.id]
    );

    if (shift.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود أو تم إنهاؤه مسبقاً'
      });
    }

    // حساب إحصائيات الشيفت
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_rentals,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(DISTINCT customer_phone) as unique_customers
       FROM rentals 
       WHERE shift_id = ? AND status IN ('مكتمل', 'ملغي')`,
      [id]
    );

    // تحديث الشيفت
    await pool.execute(
      `UPDATE shifts SET 
        end_time = NOW(),
        status = 'منتهي',
        total_rentals = ?,
        total_revenue = ?,
        unique_customers = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        stats[0].total_rentals,
        stats[0].total_revenue,
        stats[0].unique_customers,
        id
      ]
    );

    console.log('✅ تم إنهاء الشيفت:', id);

    res.json({
      success: true,
      message: 'تم إنهاء الشيفت بنجاح',
      stats: stats[0]
    });

  } catch (error) {
    console.error('❌ خطأ في إنهاء الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الشيفت'
    });
  }
});

// 📊 جلب الشيفت النشط
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;

    console.log('📝 جلب الشيفت النشط للموظف:', user.id);

    const [shift] = await pool.execute(
      `SELECT s.*,
        COALESCE(COUNT(r.id), 0) as active_rentals,
        COALESCE(SUM(r.total_amount), 0) as current_revenue
       FROM shifts s
       LEFT JOIN rentals r ON s.id = r.shift_id AND r.status = 'نشط'
       WHERE s.employee_id = ? AND s.status = 'نشط' 
       AND DATE(s.start_time) = CURDATE()
       GROUP BY s.id
       LIMIT 1`,
      [user.id]
    );

    if (shift.length === 0) {
      console.log('ℹ️ لا يوجد شيفت نشط');
      return res.json({
        success: true,
        data: null,
        message: 'لا يوجد شيفت نشط'
      });
    }

    console.log('✅ تم جلب الشيفت النشط:', shift[0].id);

    res.json({
      success: true,
      data: shift[0]
    });

  } catch (error) {
    console.error('❌ خطأ في جلب الشيفت النشط:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الشيفت النشط'
    });
  }
});

// 📈 إحصائيات الشيفت
router.get('/:id/stats', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    console.log('📝 جلب إحصائيات الشيفت:', id);

    // التحقق من ملكية الشيفت
    const [shift] = await pool.execute(
      'SELECT id FROM shifts WHERE id = ? AND employee_id = ?',
      [id, user.id]
    );

    if (shift.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'غير مصرح بالوصول إلى هذا الشيفت'
      });
    }

    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_rentals,
        COUNT(CASE WHEN status = 'نشط' THEN 1 END) as active_rentals,
        COUNT(CASE WHEN status = 'مكتمل' THEN 1 END) as completed_rentals,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COUNT(DISTINCT customer_phone) as unique_customers
       FROM rentals 
       WHERE shift_id = ?`,
      [id]
    );

    // أفضل الألعاب
    const [topGames] = await pool.execute(
      `SELECT 
         g.name as game_name,
         COUNT(r.id) as rental_count,
         COALESCE(SUM(r.total_amount), 0) as revenue
       FROM rentals r
       JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = ? AND r.status = 'مكتمل'
       GROUP BY g.id
       ORDER BY rental_count DESC
       LIMIT 5`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...stats[0],
        top_games: topGames
      }
    });

  } catch (error) {
    console.error('❌ خطأ في جلب إحصائيات الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات الشيفت'
    });
  }
});

module.exports = router;