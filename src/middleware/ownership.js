// backend/src/middleware/ownership.js
const checkBranchOwnership = async (req, res, next) => {
  try {
    const user = req.user;
    const { branch_id } = req.params || req.body;
    
    // المدير العام يرى كل شيء
    if (user.role === 'admin') return next();
    
    // مدير الفرع يرى فرعه فقط
    if (user.role === 'branch_manager' && user.branch_id == branch_id) {
      return next();
    }
    
    // الموظف يرى فرعه فقط
    if (user.role === 'employee' && user.branch_id == branch_id) {
      return next();
    }
    
    res.status(403).json({ error: 'غير مصرح بالوصول لهذا الفرع' });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};