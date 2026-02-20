// backend/src/routes/admin/monitoring.js
const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { authenticateToken, checkRole } = require('../../middleware/auth');

// مراقبة الشيفتات النشطة
router.get('/shifts/active', 
  authenticateToken, 
  checkRole(['admin', 'branch_manager']),
  async (req, res) => {
    try {
      const { user } = req;
      let query = `
        SELECT 
          s.*,
          u.role as employee_role,
          b.name as branch_name,
          COUNT(r.id) as active_rentals,
          COALESCE(SUM(r.total_amount), 0) as current_revenue
        FROM shifts s
        JOIN users u ON s.employee_id = u.id
        JOIN branches b ON s.branch_id = b.id
        LEFT JOIN rentals r ON s.id = r.shift_id AND r.status = 'نشط'
        WHERE s.status = 'نشط'
      `;

      const params = [];

      // إذا كان مدير فرع، يرى فقط فروعته
      if (user.role === 'branch_manager') {
        query += ` AND s.branch_id = ?`;
        params.push(user.branch_id);
      }

      query += ` GROUP BY s.id ORDER BY s.start_time DESC`;

      const [shifts] = await pool.execute(query, params);

      res.json({
        success: true,
        data: shifts
      });
    } catch (error) {
      console.error('Monitoring error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في جلب بيانات المراقبة'
      });
    }
  }
);

// إجبار إنهاء شيفت
router.post('/shifts/:id/force-end',
  authenticateToken,
  checkRole(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // التحقق من وجود الشيفت
      const [shift] = await pool.execute(
        'SELECT * FROM shifts WHERE id = ? AND status = "نشط"',
        [id]
      );

      if (shift.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'الشيفت غير موجود أو تم إنهاؤه مسبقاً'
        });
      }

      // إنهاء جميع التأجيرات النشطة في هذا الشيفت
      await pool.execute(
        `UPDATE rentals SET 
          status = 'ملغي',
          admin_notes = 'تم إلغاء التأجير بسبب إنهاء الشيفت إجبارياً'
         WHERE shift_id = ? AND status = 'نشط'`,
        [id]
      );

      // تحديث حالة الشيفت
      await pool.execute(
        `UPDATE shifts SET 
          status = 'ملغي',
          end_time = NOW(),
          notes = CONCAT(IFNULL(notes, ''), ' \\nتم إنهاء الشيفت إجبارياً بواسطة المدير')
         WHERE id = ?`,
        [id]
      );

      // تسجيل الإجراء
      await pool.execute(
        `INSERT INTO admin_logs SET ?`,
        [{
          admin_id: req.user.id,
          action_type: 'force_end_shift',
          target_type: 'shift',
          target_id: id,
          details: JSON.stringify({
            shift_id: id,
            employee_id: shift[0].employee_id,
            reason: 'مدير النظام'
          }),
          ip_address: req.ip,
          user_agent: req.headers['user-agent']
        }]
      );

      res.json({
        success: true,
        message: 'تم إنهاء الشيفت إجبارياً بنجاح'
      });

    } catch (error) {
      console.error('Force end shift error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في إنهاء الشيفت'
      });
    }
  }
);

// جلب إحصائيات النظام
router.get('/stats/overview',
  authenticateToken,
  checkRole(['admin', 'branch_manager']),
  async (req, res) => {
    try {
      const { user } = req;
      let whereClause = '';
      const params = [];

      if (user.role === 'branch_manager') {
        whereClause = 'WHERE branch_id = ?';
        params.push(user.branch_id);
      }

      const [stats] = await pool.execute(`
        SELECT 
          (SELECT COUNT(*) FROM shifts ${whereClause} AND status = 'نشط') as active_shifts,
          (SELECT COUNT(DISTINCT employee_id) FROM shifts ${whereClause} AND status = 'نشط') as active_employees,
          (SELECT COUNT(*) FROM rentals ${whereClause} AND status = 'نشط') as active_rentals,
          (SELECT COALESCE(SUM(total_amount), 0) FROM rentals ${whereClause} AND status = 'نشط') as active_revenue,
          (SELECT COUNT(*) FROM rentals ${whereClause} AND DATE(created_at) = CURDATE()) as today_rentals,
          (SELECT COALESCE(SUM(total_amount), 0) FROM rentals ${whereClause} AND DATE(created_at) = CURDATE()) as today_revenue
      `, params);

      res.json({
        success: true,
        data: stats[0]
      });

    } catch (error) {
      console.error('Stats error:', error);
      res.status(500).json({
        success: false,
        message: 'حدث خطأ في جلب الإحصائيات'
      });
    }
  }
);

module.exports = router;