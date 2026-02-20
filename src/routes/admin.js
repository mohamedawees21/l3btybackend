const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');

// 🔹 إحصائيات النظام للمدير
router.get('/stats', auth, checkRole(['admin']), async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                -- إجمالي المستخدمين
                COUNT(*) as total_users,
                
                -- المستخدمين النشطين (تسجيل دخول خلال آخر 7 أيام)
                SUM(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as active_users,
                
                -- عدد الفروع
                (SELECT COUNT(*) FROM branches) as total_branches,
                
                -- الفروع النشطة
                (SELECT COUNT(*) FROM branches WHERE is_active = 1) as active_branches,
                
                -- إجمالي الألعاب
                (SELECT COUNT(*) FROM games) as total_games,
                
                -- الألعاب المؤجرة حالياً
                (SELECT COUNT(*) FROM games WHERE status = 'مؤجر') as rented_games,
                
                -- الألعاب قيد الصيانة
                (SELECT COUNT(*) FROM games WHERE status = 'صيانة') as maintenance_games
            FROM users
        `;
        
        const [stats] = await req.db.query(statsQuery);
        
        res.json({
            success: true,
            data: stats[0]
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
});

// 🔹 تحديث last_login عند تسجيل الدخول
router.put('/update-last-login/:userId', auth, async (req, res) => {
    try {
        const { userId } = req.params;
        const query = 'UPDATE users SET last_login = NOW() WHERE id = ?';
        await req.db.query(query, [userId]);
        
        res.json({
            success: true,
            message: 'تم تحديث وقت آخر تسجيل دخول'
        });
    } catch (error) {
        console.error('Error updating last login:', error);
        res.status(500).json({ success: false, message: 'خطأ في تحديث وقت التسجيل' });
    }
});

module.exports = router;