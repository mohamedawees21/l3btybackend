// backend/routes/branches.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { Branch, Game, Rental, User } = require('../models');
const { Op } = require('sequelize');

// ==================== GET ALL BRANCHES ====================
router.get('/', authenticate, async (req, res) => {
  try {
    let whereClause = {};
    
    // إذا لم يكن المستخدم مدير، يرى فقط فرعه
    if (req.user.role !== 'admin') {
      whereClause.id = req.user.branch_id;
    }
    
    // جلب الفروع مع عدد الألعاب
    const branches = await Branch.findAll({
      where: whereClause,
      attributes: {
        include: [
          [
            Branch.sequelize.literal(`(
              SELECT COUNT(*) FROM games 
              WHERE games.branch_id = Branch.id
              AND games.status = 'متاح'
            )`),
            'available_games'
          ],
          [
            Branch.sequelize.literal(`(
              SELECT COUNT(*) FROM games 
              WHERE games.branch_id = Branch.id
            )`),
            'total_games'
          ]
        ]
      },
      order: [['name', 'ASC']]
    });
    
    res.json({
      success: true,
      data: branches,
      message: 'تم جلب الفروع بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في جلب الفروع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الفروع'
    });
  }
});

// ==================== GET SINGLE BRANCH ====================
router.get('/:id', authenticate, async (req, res) => {
  try {
    const branchId = req.params.id;
    
    // التحقق من الصلاحيات
    if (req.user.role !== 'admin' && req.user.branch_id != branchId) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية للوصول لهذا الفرع'
      });
    }
    
    const branch = await Branch.findByPk(branchId, {
      include: [
        {
          model: Game,
          as: 'games',
          attributes: ['id', 'name', 'category', 'status']
        },
        {
          model: User,
          as: 'employees',
          attributes: ['id', 'name', 'email', 'role'],
          where: { role: { [Op.ne]: 'admin' } },
          required: false
        }
      ]
    });
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    // جلب إحصائيات إضافية
    const stats = await getBranchStats(branchId);
    
    res.json({
      success: true,
      data: {
        ...branch.toJSON(),
        stats
      },
      message: 'تم جلب بيانات الفرع بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في جلب بيانات الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب بيانات الفرع'
    });
  }
});

// ==================== GET BRANCH GAMES ====================
router.get('/:id/games', authenticate, async (req, res) => {
  try {
    const branchId = req.params.id;
    
    // التحقق من الصلاحيات
    if (req.user.role !== 'admin' && req.user.branch_id != branchId) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية للوصول لهذا الفرع'
      });
    }
    
    // جلب الألعاب مع الفرع
    const games = await Game.findAll({
      where: { branch_id: branchId },
      include: [
        {
          model: Branch,
          attributes: ['id', 'name', 'location', 'city']
        }
      ],
      order: [['name', 'ASC']]
    });
    
    // جلب الفرع منفصلاً للإرجاع
    const branch = await Branch.findByPk(branchId, {
      attributes: ['id', 'name', 'location', 'city', 'contact_phone', 'contact_email']
    });
    
    // حساب الإحصائيات
    const totalGames = games.length;
    const availableGames = games.filter(g => g.status === 'متاح').length;
    const rentedGames = games.filter(g => g.status === 'مؤجرة').length;
    const maintenanceGames = games.filter(g => g.status === 'صيانة').length;
    
    res.json({
      success: true,
      data: games,
      branch: branch,
      stats: {
        total: totalGames,
        available: availableGames,
        rented: rentedGames,
        maintenance: maintenanceGames
      },
      message: `تم جلب ${games.length} لعبة للفرع`
    });
  } catch (error) {
    console.error('❌ خطأ في جلب ألعاب الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب ألعاب الفرع'
    });
  }
});

// ==================== CREATE BRANCH ====================
router.post('/', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const branchData = req.body;
    
    // التحقق من البيانات المطلوبة
    if (!branchData.name || !branchData.location) {
      return res.status(400).json({
        success: false,
        message: 'اسم الفرع والموقع مطلوبان'
      });
    }
    
    // إنشاء الفرع
    const branch = await Branch.create({
      name: branchData.name,
      location: branchData.location,
      city: branchData.city || 'القاهرة',
      contact_phone: branchData.contact_phone || '',
      contact_email: branchData.contact_email || '',
      opening_time: branchData.opening_time || '10:00:00',
      closing_time: branchData.closing_time || '22:00:00',
      is_active: 1,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    res.json({
      success: true,
      data: branch,
      message: 'تم إنشاء الفرع بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في إنشاء الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الفرع',
      error: error.message
    });
  }
});

// ==================== UPDATE BRANCH ====================
router.put('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const branchId = req.params.id;
    const updateData = req.body;
    
    const branch = await Branch.findByPk(branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    // تحديث البيانات
    await branch.update({
      ...updateData,
      updated_at: new Date()
    });
    
    res.json({
      success: true,
      data: branch,
      message: 'تم تحديث الفرع بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في تحديث الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في تحديث الفرع'
    });
  }
});

// ==================== DELETE BRANCH ====================
router.delete('/:id', authenticate, authorize(['admin']), async (req, res) => {
  try {
    const branchId = req.params.id;
    
    const branch = await Branch.findByPk(branchId);
    
    if (!branch) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    // التحقق إذا كان الفرع يحتوي على ألعاب
    const gamesCount = await Game.count({ where: { branch_id: branchId } });
    const usersCount = await User.count({ where: { branch_id: branchId } });
    
    if (gamesCount > 0 || usersCount > 0) {
      // تعطيل الفرع بدلاً من حذفه
      await branch.update({ is_active: 0 });
      
      return res.json({
        success: true,
        message: 'تم تعطيل الفرع (لا يمكن حذفه لأنه يحتوي على ألعاب أو موظفين)'
      });
    }
    
    // حذف الفرع إذا كان فارغاً
    await branch.destroy();
    
    res.json({
      success: true,
      message: 'تم حذف الفرع بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في حذف الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في حذف الفرع'
    });
  }
});

// ==================== ADD GAME TO BRANCH ====================
router.post('/:id/games', authenticate, authorize(['admin', 'branch_manager']), async (req, res) => {
  try {
    const branchId = req.params.id;
    const gameData = req.body;
    
    // التحقق من الصلاحيات
    if (req.user.role === 'branch_manager' && req.user.branch_id != branchId) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لإضافة لعبة لهذا الفرع'
      });
    }
    
    // التحقق من البيانات المطلوبة
    if (!gameData.name || !gameData.price_per_hour) {
      return res.status(400).json({
        success: false,
        message: 'اسم اللعبة وسعر الساعة مطلوبان'
      });
    }
    
    // إنشاء اللعبة
    const game = await Game.create({
      name: gameData.name,
      description: gameData.description || gameData.name,
      category: gameData.category || 'سيارات',
      price_per_hour: parseFloat(gameData.price_per_hour),
      price_per_15min: Math.ceil(parseFloat(gameData.price_per_hour) / 4),
      branch_id: branchId,
      status: 'متاح',
      is_active: 1,
      min_rental_time: gameData.min_rental_time || 15,
      max_rental_time: gameData.max_rental_time || 120,
      minimum_age: gameData.minimum_age || 16,
      max_speed: gameData.max_speed || 30,
      weight_limit: gameData.weight_limit || '100',
      image_url: gameData.image_url || 'default-game.jpg',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    res.json({
      success: true,
      data: game,
      message: 'تم إضافة اللعبة للفرع بنجاح'
    });
  } catch (error) {
    console.error('❌ خطأ في إضافة لعبة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إضافة اللعبة للفرع',
      sqlError: error.parent?.sqlMessage || error.message,
      sqlCode: error.parent?.code
    });
  }
});

// ==================== GET BRANCH STATISTICS ====================
router.get('/:id/stats', authenticate, async (req, res) => {
  try {
    const branchId = req.params.id;
    
    // التحقق من الصلاحيات
    if (req.user.role !== 'admin' && req.user.branch_id != branchId) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية للوصول لهذه الإحصائيات'
      });
    }
    
    const stats = await getBranchStats(branchId);
    
    res.json({
      success: true,
      data: stats,
      message: 'تم جلب إحصائيات الفرع'
    });
  } catch (error) {
    console.error('❌ خطأ في جلب إحصائيات الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب إحصائيات الفرع'
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

// دالة مساعدة لجلب إحصائيات الفرع
async function getBranchStats(branchId) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    // إجمالي الألعاب
    const totalGames = await Game.count({ where: { branch_id: branchId } });
    const availableGames = await Game.count({ 
      where: { 
        branch_id: branchId,
        status: 'متاح'
      }
    });
    
    // التأجيرات النشطة
    const activeRentals = await Rental.count({
      where: {
        branch_id: branchId,
        status: 'نشط'
      }
    });
    
    // التأجيرات اليوم
    const todayRentals = await Rental.count({
      where: {
        branch_id: branchId,
        status: 'مكتمل',
        end_time: {
          [Op.between]: [today, todayEnd]
        }
      }
    });
    
    // إيرادات اليوم
    const todayRevenue = await Rental.sum('total_amount', {
      where: {
        branch_id: branchId,
        status: 'مكتمل',
        end_time: {
          [Op.between]: [today, todayEnd]
        }
      }
    });
    
    return {
      total_games: totalGames,
      available_games: availableGames,
      active_rentals: activeRentals,
      today_rentals: todayRentals || 0,
      today_revenue: todayRevenue || 0
    };
  } catch (error) {
    console.error('❌ خطأ في حساب إحصائيات الفرع:', error);
    return {
      total_games: 0,
      available_games: 0,
      active_rentals: 0,
      today_rentals: 0,
      today_revenue: 0
    };
  }
}

module.exports = router;