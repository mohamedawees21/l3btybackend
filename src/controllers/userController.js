// backend/src/controllers/userController.js
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Branch = require('../models/Branch');
const ActivityLog = require('../models/ActivityLog');

// الحصول على جميع المستخدمين
exports.getAllUsers = async (req, res) => {
  try {
    const { role, branch_id, is_active } = req.query;
    const where = {};
    
    if (role) where.role = role;
    if (branch_id) where.branch_id = branch_id;
    if (is_active !== undefined) where.is_active = is_active === 'true';
    
    // المدير العام يرى كل المستخدمين، مدير الفرع يرى مستخدمي فرعه فقط
    if (req.user.role === 'branch_manager') {
      where.branch_id = req.user.branch_id;
    }
    
    const users = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [{
        model: Branch,
        as: 'branch',
        attributes: ['id', 'name', 'location']
      }],
      order: [['created_at', 'DESC']]
    });
    
    res.json({
      success: true,
      data: users
    });
    
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ في جلب البيانات' 
    });
  }
};

// الحصول على مستخدم محدد
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Branch,
        as: 'branch',
        attributes: ['id', 'name', 'location']
      }]
    });
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'المستخدم غير موجود' 
      });
    }
    
    // التحقق من الصلاحية
    if (req.user.role === 'branch_manager' && user.branch_id !== req.user.branch_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح لك بالوصول لهذا المستخدم' 
      });
    }
    
    res.json({
      success: true,
      data: user
    });
    
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// إنشاء مستخدم جديد
exports.createUser = async (req, res) => {
  try {
    const { 
      username, 
      email, 
      password, 
      name, 
      role, 
      branch_id, 
      phone 
    } = req.body;
    
    // التحقق من البيانات المطلوبة
    if (!username || !email || !password || !name || !branch_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'جميع الحقول المطلوبة يجب ملؤها' 
      });
    }
    
    // التحقق من وجود المستخدم مسبقاً
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [{ email }, { username }] 
      } 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'البريد الإلكتروني أو اسم المستخدم مستخدم مسبقاً' 
      });
    }
    
    // التحقق من أن المدير العام فقط يمكنه إنشاء مدير فرع أو مدير عام
    if ((role === 'admin' || role === 'branch_manager') && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح لك بإنشاء هذا النوع من المستخدمين' 
      });
    }
    
    // تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // إنشاء المستخدم
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      name,
      role: role || 'employee',
      branch_id,
      phone,
      is_active: true
    });
    
    // تسجيل النشاط
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'CREATE_USER',
      entity_type: 'user',
      entity_id: user.id,
      details: { 
        username: user.username,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء المستخدم بنجاح',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        branch_id: user.branch_id
      }
    });
    
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ أثناء إنشاء المستخدم' 
    });
  }
};

// تحديث مستخدم
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // البحث عن المستخدم
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'المستخدم غير موجود' 
      });
    }
    
    // التحقق من الصلاحية
    if (req.user.role === 'branch_manager' && user.branch_id !== req.user.branch_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح لك بتعديل هذا المستخدم' 
      });
    }
    
    // التحقق من تحديث كلمة المرور
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    
    // التحقق من تحديث الدور
    if (updates.role && (updates.role === 'admin' || updates.role === 'branch_manager') && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح لك بتغيير الدور إلى هذا النوع' 
      });
    }
    
    // تحديث المستخدم
    await user.update(updates);
    
    // تسجيل النشاط
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'UPDATE_USER',
      entity_type: 'user',
      entity_id: user.id,
      details: { updates }
    });
    
    res.json({
      success: true,
      message: 'تم تحديث المستخدم بنجاح',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        branch_id: user.branch_id,
        is_active: user.is_active
      }
    });
    
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ أثناء تحديث المستخدم' 
    });
  }
};

// حذف مستخدم (Soft Delete)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // البحث عن المستخدم
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'المستخدم غير موجود' 
      });
    }
    
    // لا يمكن حذف المدير العام
    if (user.role === 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'لا يمكن حذف المدير العام' 
      });
    }
    
    // التحقق من الصلاحية
    if (req.user.role === 'branch_manager' && user.branch_id !== req.user.branch_id) {
      return res.status(403).json({ 
        success: false, 
        error: 'غير مصرح لك بحذف هذا المستخدم' 
      });
    }
    
    // Soft Delete - إلغاء تفعيل المستخدم
    await user.update({ is_active: false });
    
    // تسجيل النشاط
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'DELETE_USER',
      entity_type: 'user',
      entity_id: user.id,
      details: { 
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
    
    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
    
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ أثناء حذف المستخدم' 
    });
  }
};