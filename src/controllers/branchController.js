// controllers/branchController.js
const db = require('../config/database');

// الحصول على جميع الفروع
exports.getAllBranches = async (req, res) => {
  try {
    const [branches] = await db.execute('SELECT * FROM branches WHERE is_active = 1 ORDER BY name');
    
    res.status(200).json({
      success: true,
      data: branches
    });
  } catch (error) {
    console.error('❌ خطأ في جلب الفروع:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الفروع'
    });
  }
};

// إنشاء فرع جديد
exports.createBranch = async (req, res) => {
  try {
    console.log('📝 طلب إنشاء فرع جديد:', req.body);
    
    const { 
      name, 
      location, 
      phone, 
      manager_id, 
      status = 'active',
      opening_time = '10:00:00',
      closing_time = '22:00:00',
      max_capacity = 50
    } = req.body;

    // التحقق من الحقول المطلوبة
    if (!name || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'الاسم والموقع مطلوبان' 
      });
    }

    // إدخال الفرع في قاعدة البيانات
    const [result] = await db.execute(
      `INSERT INTO branches 
       (name, location, phone, manager_id, status, opening_time, closing_time, max_capacity) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, location, phone || null, manager_id || null, status, opening_time, closing_time, max_capacity]
    );

    console.log('✅ تم إنشاء الفرع بنجاح، ID:', result.insertId);

    // جلب الفرع الذي تم إنشاؤه
    const [branch] = await db.execute('SELECT * FROM branches WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الفرع بنجاح',
      data: branch[0]
    });

  } catch (error) {
    console.error('❌ خطأ في إنشاء الفرع:', error);
    
    // خطأ فريد للبيانات المكررة
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'اسم الفرع موجود بالفعل'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم عند إنشاء الفرع',
      error: error.message
    });
  }
};

// الحصول على فرع محدد
exports.getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [branch] = await db.execute('SELECT * FROM branches WHERE id = ? AND is_active = 1', [id]);
    
    if (branch.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    res.status(200).json({
      success: true,
      data: branch[0]
    });
  } catch (error) {
    console.error('❌ خطأ في جلب الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الفرع'
    });
  }
};

// تحديث فرع
exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const branchData = req.body;
    
    // التحقق من وجود الفرع
    const [existingBranch] = await db.execute('SELECT * FROM branches WHERE id = ?', [id]);
    
    if (existingBranch.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    // بناء query التحديث ديناميكياً
    const fields = [];
    const values = [];
    
    if (branchData.name !== undefined) {
      fields.push('name = ?');
      values.push(branchData.name);
    }
    if (branchData.location !== undefined) {
      fields.push('location = ?');
      values.push(branchData.location);
    }
    if (branchData.phone !== undefined) {
      fields.push('phone = ?');
      values.push(branchData.phone);
    }
    if (branchData.manager_id !== undefined) {
      fields.push('manager_id = ?');
      values.push(branchData.manager_id);
    }
    if (branchData.status !== undefined) {
      fields.push('status = ?');
      values.push(branchData.status);
    }
    if (branchData.opening_time !== undefined) {
      fields.push('opening_time = ?');
      values.push(branchData.opening_time);
    }
    if (branchData.closing_time !== undefined) {
      fields.push('closing_time = ?');
      values.push(branchData.closing_time);
    }
    if (branchData.max_capacity !== undefined) {
      fields.push('max_capacity = ?');
      values.push(branchData.max_capacity);
    }
    if (branchData.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(branchData.is_active);
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا توجد بيانات للتحديث'
      });
    }
    
    // إضافة معرف الفرع للقيم
    values.push(id);
    
    const query = `UPDATE branches SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`;
    
    await db.execute(query, values);
    
    // جلب البيانات المحدثة
    const [updatedBranch] = await db.execute('SELECT * FROM branches WHERE id = ?', [id]);
    
    res.status(200).json({
      success: true,
      message: 'تم تحديث الفرع بنجاح',
      data: updatedBranch[0]
    });
    
  } catch (error) {
    console.error('❌ خطأ في تحديث الفرع:', error);
    
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'اسم الفرع موجود بالفعل'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الفرع'
    });
  }
};

// حذف فرع (تغيير الحالة)
exports.deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    
    // التحقق من وجود الفرع
    const [existingBranch] = await db.execute('SELECT * FROM branches WHERE id = ?', [id]);
    
    if (existingBranch.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    // تحديث الحالة بدلاً من الحذف الفعلي
    await db.execute('UPDATE branches SET is_active = 0, updated_at = NOW() WHERE id = ?', [id]);
    
    res.status(200).json({
      success: true,
      message: 'تم حذف الفرع بنجاح'
    });
    
  } catch (error) {
    console.error('❌ خطأ في حذف الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف الفرع'
    });
  }
};

// الحصول على إحصائيات الفرع
exports.getBranchStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    // التحقق من وجود الفرع
    const [existingBranch] = await db.execute('SELECT * FROM branches WHERE id = ? AND is_active = 1', [id]);
    
    if (existingBranch.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    // جلب إحصائيات الألعاب
    const [gameStats] = await db.execute(
      `SELECT 
        COUNT(*) as total_games,
        SUM(CASE WHEN status = 'متاح' THEN 1 ELSE 0 END) as available_games,
        SUM(CASE WHEN status = 'مؤجرة' THEN 1 ELSE 0 END) as rented_games,
        SUM(CASE WHEN status = 'صيانة' THEN 1 ELSE 0 END) as maintenance_games
       FROM games 
       WHERE branch_id = ? AND is_active = 1`,
      [id]
    );
    
    // جلب إحصائيات التأجيرات لهذا الشهر
    const currentDate = new Date();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      .toISOString().split('T')[0];
    
    const [rentalStats] = await db.execute(
      `SELECT 
        COUNT(*) as total_rentals,
        SUM(CASE WHEN status = 'مكتمل' THEN final_amount ELSE 0 END) as total_revenue,
        COUNT(DISTINCT customer_phone) as unique_customers
       FROM rentals 
       WHERE branch_id = ? AND DATE(created_at) >= ?`,
      [id, firstDayOfMonth]
    );
    
    res.status(200).json({
      success: true,
      data: {
        branch: existingBranch[0],
        games: gameStats[0],
        rentals: rentalStats[0]
      }
    });
    
  } catch (error) {
    console.error('❌ خطأ في جلب إحصائيات الفرع:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إحصائيات الفرع'
    });
  }
};