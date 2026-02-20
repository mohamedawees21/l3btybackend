const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.use(authenticateToken);

// التقارير للمدير فقط
router.get('/sales', authorizeRoles('admin'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const user = req.user;
    
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();
    
    const [report] = await req.db.execute(
      `SELECT 
         DATE(r.created_at) as date,
         COUNT(r.id) as rental_count,
         COALESCE(SUM(r.total_amount), 0) as total_revenue,
         COUNT(DISTINCT r.customer_id) as unique_customers,
         b.name as branch_name
       FROM rentals r
       JOIN games g ON r.game_id = g.id
       JOIN branches b ON g.branch_id = b.id
       WHERE r.payment_status = 'مدفوع'
         AND MONTH(r.created_at) = ?
         AND YEAR(r.created_at) = ?
       GROUP BY DATE(r.created_at), b.id
       ORDER BY date`,
      [targetMonth, targetYear]
    );
    
    res.json({
      success: true,
      data: report
    });
    
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'تعذر جلب التقرير'
    });
  }
});

module.exports = router;