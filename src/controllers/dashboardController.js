// backend/src/controllers/dashboardController.js - النسخة المبسطة
const dashboardController = {
  getDashboardStats: async (req, res) => {
    try {
      const user = req.user;
      const { branch_id } = req.query;
      
      console.log('📊 [DASHBOARD] طلب إحصائيات من:', user.email);
      
      // إذا كان الـ dashboard غير جاهز بعد، أرجع بيانات افتراضية
      const defaultStats = {
        todayRevenue: 0,
        todayRentals: 0,
        todayActiveRentals: 0,
        monthlyRevenue: 0,
        monthlyRentals: 0,
        totalRevenue: 0,
        totalRentals: 0,
        availableGames: 0,
        rentedGames: 0,
        maintenanceGames: 0,
        totalGames: 0
      };
      
      console.log('✅ [DASHBOARD] إرجاع بيانات افتراضية');
      
      return res.json({
        success: true,
        data: defaultStats
      });
      
    } catch (error) {
      console.error('❌ [DASHBOARD] خطأ:', error);
      return res.status(500).json({
        success: false,
        message: 'حدث خطأ في الخادم',
        error: error.message
      });
    }
  }
};

module.exports = dashboardController;