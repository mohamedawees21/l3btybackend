const db = require('../config/database');

class ActivityController {
  // تسجيل نشاط جديد
  static async logActivity(req, res) {
    try {
      const { user_id, user_name, user_role, action_type, entity_type, entity_id, entity_name, description, metadata } = req.body;
      
      const activity = await db.ActivityLog.create({
        user_id,
        user_name,
        user_role,
        action_type,
        entity_type,
        entity_id,
        entity_name,
        description,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        metadata: metadata || {}
      });
      
      res.status(201).json({
        success: true,
        message: 'تم تسجيل النشاط',
        data: activity
      });
    } catch (error) {
      console.error('Error logging activity:', error);
      res.status(500).json({
        success: false,
        message: 'فشل في تسجيل النشاط'
      });
    }
  }

  // جلب سجل الأنشطة
  static async getActivities(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        user_id,
        entity_type,
        start_date,
        end_date,
        search
      } = req.query;
      
      const where = {};
      
      if (type && type !== 'all') where.action_type = type;
      if (user_id && user_id !== 'all') where.user_id = user_id;
      if (entity_type && entity_type !== 'all') where.entity_type = entity_type;
      
      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) where.created_at.$gte = new Date(start_date);
        if (end_date) where.created_at.$lte = new Date(end_date);
      }
      
      if (search) {
        where.$or = [
          { user_name: { $like: `%${search}%` } },
          { description: { $like: `%${search}%` } },
          { entity_name: { $like: `%${search}%` } }
        ];
      }
      
      const offset = (page - 1) * limit;
      
      const { count, rows } = await db.ActivityLog.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
      res.json({
        success: true,
        data: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / limit)
        }
      });
    } catch (error) {
      console.error('Error getting activities:', error);
      res.status(500).json({
        success: false,
        message: 'فشل في جلب سجل الأنشطة'
      });
    }
  }

  // إحصائيات الأنشطة
  static async getActivityStats(req, res) {
    try {
      const today = new Date();
      const last24Hours = new Date(today.getTime() - (24 * 60 * 60 * 1000));
      const last7Days = new Date(today.getTime() - (7 * 24 * 60 * 60 * 1000));
      
      const [totalActivities, last24HoursCount, last7DaysCount, topUsers] = await Promise.all([
        db.ActivityLog.count(),
        db.ActivityLog.count({
          where: { created_at: { $gte: last24Hours } }
        }),
        db.ActivityLog.count({
          where: { created_at: { $gte: last7Days } }
        }),
        db.ActivityLog.findAll({
          attributes: [
            'user_id',
            'user_name',
            [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'activity_count']
          ],
          group: ['user_id', 'user_name'],
          order: [[db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'DESC']],
          limit: 5
        })
      ]);
      
      res.json({
        success: true,
        data: {
          total_activities: totalActivities,
          last_24_hours: last24HoursCount,
          last_7_days: last7DaysCount,
          top_users: topUsers
        }
      });
    } catch (error) {
      console.error('Error getting activity stats:', error);
      res.status(500).json({
        success: false,
        message: 'فشل في جلب إحصائيات الأنشطة'
      });
    }
  }
}

module.exports = ActivityController;