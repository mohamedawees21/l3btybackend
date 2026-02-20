const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'التوكن مطلوب' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'التوكن مطلوب' 
      });
    }
    
    const parts = token.split('_');
    
    if (parts.length < 3 || parts[0] !== 'l3bty') {
      return res.status(403).json({ 
        success: false, 
        message: 'توكن غير صالح' 
      });
    }
    
    const userId = parts[1];
    
    const [users] = await req.db.execute(
      `SELECT u.*, b.name as branch_name 
       FROM users u 
       LEFT JOIN branches b ON u.branch_id = b.id 
       WHERE u.id = ? AND u.is_active = 1`,
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'مستخدم غير موجود أو غير نشط' 
      });
    }
    
    req.user = users[0];
    next();
    
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في المصادقة' 
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'غير مصرح' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'غير مصرح لهذا الإجراء' 
      });
    }
    
    next();
  };
};

module.exports = { authenticateToken, authorizeRoles };