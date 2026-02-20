// backend/src/middleware/roles.js
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'غير مصرح، يرجى تسجيل الدخول' 
      });
    }
    
    const userRole = req.user.role;
    
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    
    res.status(403).json({ 
      success: false, 
      error: 'غير مصرح لهذا الدور' 
    });
  };
};

module.exports = checkRole;