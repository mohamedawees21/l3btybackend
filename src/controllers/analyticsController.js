// backend/src/controllers/analyticsController.js
const analyticsController = {
  // إحصائيات لوحة التحكم المتقدمة
  getDashboardStats: async (req, res) => {
    try {
      const user = req.user;
      const { period = 'today', branch_id } = req.query;
      
      let branchFilter = '';
      let params = [];
      
      if (user.role !== 'admin' && user.branch_id) {
        branchFilter = 'AND g.branch_id = ?';
        params.push(user.branch_id);
      } else if (branch_id) {
        branchFilter = 'AND g.branch_id = ?';
        params.push(branch_id);
      }
      
      let dateFilter = '';
      const now = new Date();
      
      switch (period) {
        case 'today':
          const today = now.toISOString().split('T')[0];
          dateFilter = 'AND DATE(r.created_at) = ?';
          params.push(today);
          break;
        case 'week':
          const weekAgo = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
          dateFilter = 'AND DATE(r.created_at) >= ?';
          params.push(weekAgo);
          break;
        case 'month':
          const monthAgo = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
          dateFilter = 'AND DATE(r.created_at) >= ?';
          params.push(monthAgo);
          break;
        case 'year':
          const yearAgo = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
          dateFilter = 'AND DATE(r.created_at) >= ?';
          params.push(yearAgo);
          break;
      }

      // الإحصائيات الأساسية
      const [stats] = await req.db.execute(
        `SELECT 
          COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as total_revenue,
          COUNT(r.id) as total_rentals,
          COUNT(CASE WHEN r.status = 'نشط' THEN 1 END) as active_rentals,
          COUNT(CASE WHEN r.status = 'مكتمل' THEN 1 END) as completed_rentals,
          COUNT(CASE WHEN r.status = 'ملغي' THEN 1 END) as canceled_rentals,
          COUNT(CASE WHEN g.status = 'متاح' THEN 1 END) as available_games,
          COUNT(CASE WHEN g.status = 'مؤجر' THEN 1 END) as rented_games,
          COUNT(CASE WHEN g.status = 'صيانة' THEN 1 END) as maintenance_games,
          COALESCE(SUM(CASE WHEN DATE(r.created_at) = CURDATE() AND r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as today_revenue,
          COUNT(CASE WHEN DATE(r.created_at) = CURDATE() THEN 1 END) as today_rentals,
          (SELECT COUNT(*) FROM users WHERE is_active = 1 ${user.role !== 'admin' && user.branch_id ? 'AND branch_id = ?' : ''}) as total_users,
          (SELECT COUNT(*) FROM branches WHERE is_active = 1) as total_branches,
          (SELECT COUNT(*) FROM games WHERE is_active = 1) as total_games,
          (SELECT COUNT(*) FROM customers) as total_customers
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         WHERE 1=1 ${branchFilter} ${dateFilter}`,
        params
      );

      // أفضل الألعاب
      const [topGames] = await req.db.execute(
        `SELECT 
           g.id,
           g.name,
           g.category,
           g.price_per_hour,
           g.image_url,
           b.name as branch_name,
           COUNT(r.id) as rental_count,
           COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as total_revenue
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         JOIN branches b ON g.branch_id = b.id
         WHERE 1=1 ${branchFilter} ${dateFilter}
         GROUP BY g.id
         ORDER BY total_revenue DESC
         LIMIT 10`,
        params
      );

      // أفضل العملاء
      const [topCustomers] = await req.db.execute(
        `SELECT 
           c.id,
           c.name,
           c.phone,
           c.email,
           COUNT(r.id) as rental_count,
           COALESCE(SUM(r.total_amount), 0) as total_spent,
           MAX(r.created_at) as last_rental_date
         FROM rentals r
         JOIN customers c ON r.customer_id = c.id
         JOIN games g ON r.game_id = g.id
         WHERE 1=1 ${branchFilter} ${dateFilter}
         GROUP BY c.id
         ORDER BY total_spent DESC
         LIMIT 10`,
        params
      );

      // الإيرادات الشهرية
      const [monthlyRevenue] = await req.db.execute(
        `SELECT 
           DATE_FORMAT(r.created_at, '%Y-%m') as month,
           DATE_FORMAT(r.created_at, '%M %Y') as month_name,
           COUNT(r.id) as rental_count,
           COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as revenue
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         WHERE r.payment_status = 'مدفوع' 
           ${branchFilter}
           AND r.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
         GROUP BY DATE_FORMAT(r.created_at, '%Y-%m')
         ORDER BY month`,
        params.slice(0, params.length - (dateFilter ? 1 : 0))
      );

      // التأجيرات النشطة
      const [activeRentals] = await req.db.execute(
        `SELECT 
           r.*,
           g.name as game_name,
           g.price_per_hour,
           c.name as customer_name,
           c.phone as customer_phone,
           u.name as employee_name,
           b.name as branch_name,
           TIMESTAMPDIFF(MINUTE, r.start_time, NOW()) as elapsed_minutes
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         JOIN customers c ON r.customer_id = c.id
         JOIN users u ON r.user_id = u.id
         JOIN branches b ON g.branch_id = b.id
         WHERE r.status = 'نشط' ${branchFilter}
         ORDER BY r.start_time DESC`,
        params.slice(0, params.length - (dateFilter ? 1 : 0))
      );

      const result = {
        success: true,
        data: {
          summary: stats[0] || {},
          topGames,
          topCustomers,
          monthlyRevenue,
          activeRentals,
          analytics: {
            avg_revenue_per_rental: stats[0]?.total_rentals > 0 ? 
              (stats[0]?.total_revenue / stats[0]?.total_rentals).toFixed(2) : 0,
            occupancy_rate: stats[0]?.total_games > 0 ? 
              ((stats[0]?.rented_games / stats[0]?.total_games) * 100).toFixed(2) : 0
          }
        }
      };
      
      res.json(result);
    } catch (error) {
      console.error('❌ خطأ في جلب الإحصائيات:', error);
      res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ في الخادم'
      });
    }
  }
};

module.exports = analyticsController;