// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Branch = require('../models/Branch');
const ActivityLog = require('../models/ActivityLog');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // البحث عن المستخدم مع الفرع
    const user = await User.findOne({
      where: { email },
      include: [{
        model: Branch,
        as: 'branch',
        attributes: ['id', 'name', 'location']
      }]
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      });
    }

    // التحقق من كلمة المرور
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      });
    }

    // التحقق من أن المستخدم نشط
    if (!user.is_active) {
      return res.status(403).json({ 
        success: false, 
        error: 'الحساب معطل، يرجى التواصل مع المدير' 
      });
    }

    // إنشاء token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        branch_id: user.branch_id,
        name: user.name
      },
      process.env.JWT_SECRET || 'l3bty-rental-secret-key-2024',
      { expiresIn: '24h' }
    );

    // تسجيل النشاط
    await ActivityLog.create({
      user_id: user.id,
      action: 'LOGIN',
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      details: { email: user.email, role: user.role }
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id,
        branch_name: user.branch?.name || 'الفرع الرئيسي',
        branch_location: user.branch?.location
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'حدث خطأ في الخادم' 
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
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

    res.json({
      success: true,
      user
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

exports.logout = async (req, res) => {
  try {
    // تسجيل النشاط
    await ActivityLog.create({
      user_id: req.user.id,
      action: 'LOGOUT',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح'
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};