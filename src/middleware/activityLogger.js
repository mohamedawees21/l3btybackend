const db = require('../config/database');

// Middleware لتسجيل الأنشطة تلقائياً
const activityLogger = async (req, res, next) => {
  // تخطي طلبات تسجيل الدخول والخروج (يتم تسجيلها بشكل منفصل)
  if (req.path.includes('/auth/login') || req.path.includes('/auth/logout')) {
    return next();
  }
  
  const originalSend = res.send;
  res.send = function(data) {
    // تسجيل النشاط بعد إكمال الطلب
    setTimeout(async () => {
      try {
        const user = req.user;
        if (!user) return;
        
        // تحديد نوع الإجراء
        let action_type = 'view';
        if (req.method === 'POST') action_type = 'create';
        else if (req.method === 'PUT' || req.method === 'PATCH') action_type = 'update';
        else if (req.method === 'DELETE') action_type = 'delete';
        
        // تحديد نوع الكيان
        let entity_type = 'system';
        if (req.path.includes('/games')) entity_type = 'game';
        else if (req.path.includes('/branches')) entity_type = 'branch';
        else if (req.path.includes('/rentals')) entity_type = 'rental';
        else if (req.path.includes('/users')) entity_type = 'user';
        
        // استخراج معرف الكيان من المسار أو الجسم
        let entity_id = null;
        let entity_name = null;
        
        if (req.params.id) {
          entity_id = req.params.id;
        } else if (req.body.id) {
          entity_id = req.body.id;
        }
        
        // إنشاء وصف للنشاط
        let description = `${user.name} قام بـ${getActionText(action_type)} ${getEntityText(entity_type)}`;
        
        if (entity_id) {
          description += ` (رقم ${entity_id})`;
        }
        
        // تسجيل النشاط
        await db.ActivityLog.create({
          user_id: user.id,
          user_name: user.name,
          user_role: user.role,
          action_type,
          entity_type,
          entity_id,
          entity_name,
          description,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          metadata: {
            method: req.method,
            path: req.path,
            body: sanitizeBody(req.body),
            params: req.params,
            query: req.query
          }
        });
      } catch (error) {
        console.error('Error logging activity:', error);
      }
    }, 0);
    
    return originalSend.call(this, data);
  };
  
  next();
};

// وظائف مساعدة
function getActionText(action) {
  const actions = {
    'create': 'إضافة',
    'update': 'تعديل',
    'delete': 'حذف',
    'view': 'عرض'
  };
  return actions[action] || action;
}

function getEntityText(entity) {
  const entities = {
    'game': 'لعبة',
    'branch': 'فرع',
    'rental': 'تأجير',
    'user': 'مستخدم',
    'system': 'عنصر نظام'
  };
  return entities[entity] || entity;
}

function sanitizeBody(body) {
  const sanitized = { ...body };
  // إزالة كلمات المرور والحساسة
  delete sanitized.password;
  delete sanitized.new_password;
  delete sanitized.confirm_password;
  delete sanitized.current_password;
  delete sanitized.token;
  return sanitized;
}

module.exports = activityLogger;