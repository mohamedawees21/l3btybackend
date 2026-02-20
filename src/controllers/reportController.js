// backend/src/controllers/reportController.js
const reportController = {
  // تقرير ملخص المبيعات
  getSalesSummary: async (req, res) => {
    try {
      const user = req.user;
      const { start_date, end_date, branch_id } = req.query;
      
      let branchFilter = '';
      let params = [];
      
      if (user.role !== 'admin' && user.branch_id) {
        branchFilter = 'AND g.branch_id = ?';
        params.push(user.branch_id);
      } else if (branch_id) {
        branchFilter = 'AND g.branch_id = ?';
        params.push(branch_id);
      }
      
      if (start_date && end_date) {
        params.push(start_date, end_date);
      }
      
      const [summary] = await req.db.execute(
        `SELECT 
           -- إجمالي الإيرادات
           COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as total_revenue,
           
           -- إجمالي الضرائب
           COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.tax_amount ELSE 0 END), 0) as total_tax,
           
           -- عدد التأجيرات
           COUNT(r.id) as total_rentals,
           
           -- متوسط قيمة الفاتورة
           COALESCE(AVG(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount END), 0) as avg_ticket_size,
           
           -- متوسط مدة التأجير
           COALESCE(AVG(r.duration_minutes), 0) as avg_rental_duration,
           
           -- عدد العملاء الفريدين
           COUNT(DISTINCT r.customer_id) as unique_customers,
           
           -- عدد الألعاب المستخدمة
           COUNT(DISTINCT r.game_id) as unique_games,
           
           -- معدل الإلغاء
           ROUND(COUNT(CASE WHEN r.status = 'ملغي' THEN 1 END) * 100.0 / COUNT(*), 2) as cancellation_rate,
           
           -- معدل الإشغال
           ROUND(
             (SELECT COUNT(*) FROM games WHERE status = 'مؤجر' ${user.role !== 'admin' && user.branch_id ? 'AND branch_id = ?' : ''}) * 100.0 / 
             (SELECT COUNT(*) FROM games WHERE is_active = 1 ${user.role !== 'admin' && user.branch_id ? 'AND branch_id = ?' : ''}), 
             2
           ) as occupancy_rate
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         WHERE 1=1 
           ${branchFilter}
           ${start_date && end_date ? 'AND DATE(r.created_at) BETWEEN ? AND ?' : ''}
         `,
        params
      );
      
      // الإيرادات حسب طريقة الدفع
      const [paymentMethods] = await req.db.execute(
        `SELECT 
           r.payment_method,
           COUNT(r.id) as transaction_count,
           COALESCE(SUM(r.total_amount), 0) as total_amount
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         WHERE r.payment_status = 'مدفوع'
           ${branchFilter}
           ${start_date && end_date ? 'AND DATE(r.created_at) BETWEEN ? AND ?' : ''}
         GROUP BY r.payment_method
         ORDER BY total_amount DESC`,
        params
      );
      
      // الإيرادات حسب الفئة
      const [revenueByCategory] = await req.db.execute(
        `SELECT 
           g.category,
           COUNT(r.id) as rental_count,
           COALESCE(SUM(r.total_amount), 0) as total_revenue,
           ROUND(COALESCE(AVG(r.total_amount), 0), 2) as avg_revenue_per_rental
         FROM rentals r
         JOIN games g ON r.game_id = g.id
         WHERE r.payment_status = 'مدفوع'
           ${branchFilter}
           ${start_date && end_date ? 'AND DATE(r.created_at) BETWEEN ? AND ?' : ''}
         GROUP BY g.category
         ORDER BY total_revenue DESC`,
        params
      );
      
      res.json({
        success: true,
        data: {
          summary: summary[0] || {},
          paymentMethods,
          revenueByCategory,
          period: {
            start_date,
            end_date,
            branch_id
          }
        }
      });
      
    } catch (error) {
      console.error('❌ خطأ في تقرير المبيعات:', error);
      res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ في الخادم' 
      });
    }
  },

  // تقرير استخدام الألعاب
  getGameUtilization: async (req, res) => {
    try {
      const user = req.user;
      const { start_date, end_date } = req.query;
      
      let branchFilter = '';
      let params = [];
      
      if (user.role !== 'admin' && user.branch_id) {
        branchFilter = 'AND g.branch_id = ?';
        params.push(user.branch_id);
      }
      
      if (start_date && end_date) {
        params.push(start_date, end_date);
      }
      
      const [utilization] = await req.db.execute(
        `SELECT 
           g.id,
           g.name,
           g.category,
           g.price_per_hour,
           g.status,
           b.name as branch_name,
           
           -- إحصائيات الاستخدام
           COUNT(r.id) as total_rentals,
           COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as total_revenue,
           COALESCE(AVG(r.duration_minutes), 0) as avg_duration,
           COALESCE(SUM(r.duration_minutes), 0) as total_minutes_rented,
           
           -- معدل الاستخدام
           ROUND(
             COALESCE(SUM(r.duration_minutes), 0) * 100.0 / 
             (TIMESTAMPDIFF(DAY, ?, ?) * 24 * 60), 
             2
           ) as utilization_rate,
           
           -- أيام التأجير
           COUNT(DISTINCT DATE(r.start_time)) as days_rented,
           
           -- أول وآخر تأجير
           MIN(r.start_time) as first_rental_date,
           MAX(r.start_time) as last_rental_date
           
         FROM games g
         LEFT JOIN branches b ON g.branch_id = b.id
         LEFT JOIN rentals r ON g.id = r.game_id
           ${start_date && end_date ? 'AND DATE(r.start_time) BETWEEN ? AND ?' : ''}
         WHERE g.is_active = 1
           ${branchFilter}
         GROUP BY g.id
         ORDER BY total_revenue DESC`,
        params
      );
      
      // إحصائيات حسب الحالة
      const [statusStats] = await req.db.execute(
        `SELECT 
           g.status,
           COUNT(g.id) as game_count,
           ROUND(COUNT(g.id) * 100.0 / (SELECT COUNT(*) FROM games WHERE is_active = 1 ${branchFilter}), 2) as percentage
         FROM games g
         WHERE g.is_active = 1 ${branchFilter}
         GROUP BY g.status`,
        user.role !== 'admin' && user.branch_id ? [user.branch_id] : []
      );
      
      res.json({
        success: true,
        data: {
          games: utilization,
          statusStats,
          totalGames: utilization.length
        }
      });
      
    } catch (error) {
      console.error('❌ خطأ في تقرير استخدام الألعاب:', error);
      res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ في الخادم' 
      });
    }
  },

  // تحليل العملاء
  getCustomerAnalysis: async (req, res) => {
    try {
      const user = req.user;
      const { start_date, end_date } = req.query;
      
      let branchFilter = '';
      let params = [];
      
      if (user.role !== 'admin' && user.branch_id) {
        branchFilter = 'AND g.branch_id = ?';
        params.push(user.branch_id);
      }
      
      if (start_date && end_date) {
        params.push(start_date, end_date);
      }
      
      const [customerAnalysis] = await req.db.execute(
        `SELECT 
           c.id,
           c.name,
           c.phone,
           c.email,
           c.created_at as registration_date,
           
           -- إحصائيات التأجير
           COUNT(r.id) as total_rentals,
           COALESCE(SUM(r.total_amount), 0) as total_spent,
           COALESCE(AVG(r.total_amount), 0) as avg_spent_per_rental,
           COALESCE(AVG(r.duration_minutes), 0) as avg_rental_duration,
           
           -- الفترة بين التأجيرات
           DATEDIFF(MAX(r.created_at), MIN(r.created_at)) as customer_lifetime_days,
           ROUND(
             DATEDIFF(MAX(r.created_at), MIN(r.created_at)) / NULLIF(COUNT(r.id) - 1, 0), 
             2
           ) as avg_days_between_rentals,
           
           -- تاريخ أول وآخر تأجير
           MIN(r.created_at) as first_rental_date,
           MAX(r.created_at) as last_rental_date,
           
           -- أنواع الألعاب المفضلة
           GROUP_CONCAT(DISTINCT g.category) as favorite_categories,
           
           -- الفروع التي زارها
           GROUP_CONCAT(DISTINCT b.name) as visited_branches,
           
           -- حالة العميل
           CASE 
             WHEN COUNT(r.id) >= 10 THEN 'مميز'
             WHEN COUNT(r.id) >= 5 THEN 'متكرر'
             WHEN COUNT(r.id) >= 2 THEN 'عادي'
             ELSE 'جديد'
           END as customer_segment
           
         FROM customers c
         LEFT JOIN rentals r ON c.id = r.customer_id
         LEFT JOIN games g ON r.game_id = g.id
         LEFT JOIN branches b ON g.branch_id = b.id
         WHERE 1=1 
           ${branchFilter}
           ${start_date && end_date ? 'AND DATE(r.created_at) BETWEEN ? AND ?' : ''}
         GROUP BY c.id
         HAVING total_rentals > 0
         ORDER BY total_spent DESC`,
        params
      );
      
      // إحصائيات تجميعية
      const [aggregateStats] = await req.db.execute(
        `SELECT 
           COUNT(DISTINCT c.id) as total_customers,
           COUNT(r.id) as total_rentals,
           COALESCE(AVG(rentals_per_customer), 0) as avg_rentals_per_customer,
           COALESCE(AVG(total_spent_per_customer), 0) as avg_spent_per_customer,
           SUM(CASE WHEN rentals_per_customer = 1 THEN 1 ELSE 0 END) as one_time_customers,
           SUM(CASE WHEN rentals_per_customer > 1 THEN 1 ELSE 0 END) as repeat_customers,
           ROUND(
             SUM(CASE WHEN rentals_per_customer > 1 THEN 1 ELSE 0 END) * 100.0 / 
             NULLIF(COUNT(DISTINCT c.id), 0), 
             2
           ) as repeat_customer_rate
         FROM (
           SELECT 
             c.id,
             COUNT(r.id) as rentals_per_customer,
             COALESCE(SUM(r.total_amount), 0) as total_spent_per_customer
           FROM customers c
           LEFT JOIN rentals r ON c.id = r.customer_id
           LEFT JOIN games g ON r.game_id = g.id
           WHERE 1=1 
             ${branchFilter}
             ${start_date && end_date ? 'AND DATE(r.created_at) BETWEEN ? AND ?' : ''}
           GROUP BY c.id
         ) as customer_stats`,
        params
      );
      
      // تحليل التسوق عبر الزمن
      const [acquisitionOverTime] = await req.db.execute(
        `SELECT 
           DATE(c.created_at) as acquisition_date,
           COUNT(DISTINCT c.id) as new_customers,
           COUNT(DISTINCT r.id) as rentals_by_new_customers,
           COALESCE(SUM(r.total_amount), 0) as revenue_from_new_customers
         FROM customers c
         LEFT JOIN rentals r ON c.id = r.customer_id
           AND DATE(r.created_at) BETWEEN DATE(c.created_at) AND DATE_ADD(DATE(c.created_at), INTERVAL 30 DAY)
         LEFT JOIN games g ON r.game_id = g.id
         WHERE 1=1 
           ${branchFilter}
           ${start_date && end_date ? 'AND DATE(c.created_at) BETWEEN ? AND ?' : ''}
         GROUP BY DATE(c.created_at)
         ORDER BY acquisition_date`,
        params
      );
      
      res.json({
        success: true,
        data: {
          customers: customerAnalysis,
          aggregateStats: aggregateStats[0] || {},
          acquisitionOverTime,
          totalCustomers: customerAnalysis.length
        }
      });
      
    } catch (error) {
      console.error('❌ خطأ في تحليل العملاء:', error);
      res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ في الخادم' 
      });
    }
  },

  // أداء الموظفين
  getEmployeePerformance: async (req, res) => {
    try {
      const user = req.user;
      
      // فقط المدير يمكنه رؤية هذا التقرير
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'غير مصرح بهذا التقرير'
        });
      }
      
      const { start_date, end_date } = req.query;
      
      let params = [];
      let dateFilter = '';
      
      if (start_date && end_date) {
        dateFilter = 'AND DATE(r.created_at) BETWEEN ? AND ?';
        params.push(start_date, end_date);
      }
      
      const [employeePerformance] = await req.db.execute(
        `SELECT 
           u.id,
           u.name,
           u.email,
           u.role,
           u.branch_id,
           b.name as branch_name,
           u.created_at as hire_date,
           COALESCE(DATEDIFF(NOW(), u.created_at), 0) as days_since_hire,
           
           -- إحصائيات التأجير
           COUNT(r.id) as total_rentals,
           COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as total_revenue,
           COALESCE(AVG(r.total_amount), 0) as avg_ticket_size,
           COALESCE(AVG(r.duration_minutes), 0) as avg_rental_duration,
           
           -- العملاء
           COUNT(DISTINCT r.customer_id) as unique_customers_served,
           
           -- الألعاب
           COUNT(DISTINCT r.game_id) as unique_games_rented,
           
           -- معدل الإلغاء
           ROUND(
             COUNT(CASE WHEN r.status = 'ملغي' THEN 1 END) * 100.0 / 
             NULLIF(COUNT(r.id), 0), 
             2
           ) as cancellation_rate,
           
           -- إحصائيات زمنية
           MIN(r.created_at) as first_rental_date,
           MAX(r.created_at) as last_rental_date,
           COUNT(DISTINCT DATE(r.created_at)) as active_days,
           
           -- متوسط التأجيرات اليومية
           ROUND(
             COUNT(r.id) * 1.0 / 
             NULLIF(COUNT(DISTINCT DATE(r.created_at)), 0), 
             2
           ) as avg_daily_rentals,
           
           -- تصنيف الأداء
           CASE 
             WHEN COUNT(r.id) >= 100 THEN 'ممتاز'
             WHEN COUNT(r.id) >= 50 THEN 'جيد جداً'
             WHEN COUNT(r.id) >= 20 THEN 'جيد'
             ELSE 'تحت التطوير'
           END as performance_rating
           
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.id
         LEFT JOIN rentals r ON u.id = r.user_id
           ${dateFilter}
         WHERE u.role IN ('employee', 'branch_manager')
           AND u.is_active = 1
         GROUP BY u.id
         ORDER BY total_revenue DESC`,
        params
      );
      
      // إحصائيات تجميعية
      const [aggregateStats] = await req.db.execute(
        `SELECT 
           COUNT(DISTINCT u.id) as total_employees,
           SUM(total_rentals) as total_rentals_by_employees,
           ROUND(AVG(total_rentals), 2) as avg_rentals_per_employee,
           ROUND(AVG(total_revenue), 2) as avg_revenue_per_employee,
           ROUND(STD(total_rentals), 2) as std_dev_rentals,
           ROUND(STD(total_revenue), 2) as std_dev_revenue
         FROM (
           SELECT 
             u.id,
             COUNT(r.id) as total_rentals,
             COALESCE(SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END), 0) as total_revenue
           FROM users u
           LEFT JOIN rentals r ON u.id = r.user_id
             ${dateFilter}
           WHERE u.role IN ('employee', 'branch_manager')
             AND u.is_active = 1
           GROUP BY u.id
         ) as emp_stats`,
        params
      );
      
      // أداء الموظفين حسب الفرع
      const [performanceByBranch] = await req.db.execute(
        `SELECT 
           b.id,
           b.name,
           COUNT(DISTINCT u.id) as employee_count,
           SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END) as branch_revenue,
           COUNT(r.id) as branch_rentals,
           ROUND(
             SUM(CASE WHEN r.payment_status = 'مدفوع' THEN r.total_amount ELSE 0 END) / 
             NULLIF(COUNT(DISTINCT u.id), 0), 
             2
           ) as revenue_per_employee,
           ROUND(
             COUNT(r.id) * 1.0 / 
             NULLIF(COUNT(DISTINCT u.id), 0), 
             2
           ) as rentals_per_employee
         FROM branches b
         LEFT JOIN users u ON b.id = u.branch_id AND u.role IN ('employee', 'branch_manager') AND u.is_active = 1
         LEFT JOIN rentals r ON u.id = r.user_id
           ${dateFilter}
         GROUP BY b.id
         ORDER BY branch_revenue DESC`,
        params
      );
      
      res.json({
        success: true,
        data: {
          employees: employeePerformance,
          aggregateStats: aggregateStats[0] || {},
          performanceByBranch,
          totalEmployees: employeePerformance.length
        }
      });
      
    } catch (error) {
      console.error('❌ خطأ في تقرير أداء الموظفين:', error);
      res.status(500).json({ 
        success: false, 
        message: 'حدث خطأ في الخادم' 
      });
    }
  }
};

module.exports = reportController;