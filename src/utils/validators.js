const Joi = require('joi');

const validators = {
  // مصادقة المستخدم
  auth: {
    login: Joi.object({
      username: Joi.string().min(3).max(50).required().messages({
        'string.empty': 'اسم المستخدم مطلوب',
        'string.min': 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل',
        'string.max': 'اسم المستخدم يجب أن يكون 50 حرفاً على الأكثر'
      }),
      password: Joi.string().min(6).required().messages({
        'string.empty': 'كلمة المرور مطلوبة',
        'string.min': 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
      })
    }),

    register: Joi.object({
      username: Joi.string().min(3).max(50).required(),
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      name: Joi.string().min(2).max(100).required(),
      role: Joi.string().valid('admin', 'branch_manager', 'employee').required(),
      branch_id: Joi.number().integer().positive().optional()
    })
  },

  // التأجيرات
  rental: {
    create: Joi.object({
      game_id: Joi.number().integer().positive().required().messages({
        'number.base': 'معرف اللعبة مطلوب',
        'number.positive': 'معرف اللعبة غير صحيح'
      }),
      duration: Joi.number().integer().min(1).max(240).required().messages({
        'number.base': 'المدة مطلوبة',
        'number.min': 'المدة يجب أن تكون دقيقة واحدة على الأقل',
        'number.max': 'المدة يجب أن تكون 240 دقيقة على الأكثر'
      }),
      customer_name: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'اسم العميل يجب أن يكون حرفين على الأقل',
        'string.max': 'اسم العميل يجب أن يكون 100 حرف على الأكثر'
      }),
      customer_phone: Joi.string().pattern(/^[0-9+]{8,15}$/).optional().messages({
        'string.pattern.base': 'رقم الهاتف غير صحيح'
      })
    }),

    cancel: Joi.object({
      reason: Joi.string().max(500).optional().messages({
        'string.max': 'سبب الإلغاء يجب أن يكون 500 حرف على الأكثر'
      })
    }),

    extend: Joi.object({
      additional_duration: Joi.number().integer().min(1).max(180).required().messages({
        'number.base': 'المدة الإضافية مطلوبة',
        'number.min': 'المدة الإضافية يجب أن تكون دقيقة واحدة على الأقل',
        'number.max': 'المدة الإضافية يجب أن تكون 180 دقيقة على الأكثر'
      })
    })
  },

  // إدارة الألعاب
  game: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      type: Joi.string().required(),
      description: Joi.string().max(500).optional(),
      base_price: Joi.number().min(0).required(),
      branch_id: Joi.number().integer().positive().required()
    })
  },

  // إدارة الفروع
  branch: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      location: Joi.string().min(5).max(255).required(),
      phone: Joi.string().pattern(/^[0-9+]{8,15}$/).optional(),
      email: Joi.string().email().optional()
    })
  }
};

/**
 * التحقق من صحة البيانات
 * @param {Object} data - البيانات للتحقق
 * @param {string} validatorName - اسم المحقق
 * @returns {Object} نتيجة التحقق
 */
function validate(data, validatorName) {
  const [category, action] = validatorName.split('.');
  
  if (!validators[category] || !validators[category][action]) {
    return {
      valid: false,
      errors: ['المحقق المطلوب غير موجود']
    };
  }

  const schema = validators[category][action];
  const { error } = schema.validate(data, { abortEarly: false });

  if (error) {
    return {
      valid: false,
      errors: error.details.map(detail => detail.message)
    };
  }

  return { valid: true, errors: [] };
}

module.exports = {
  validators,
  validate,
  validateRental: (data) => validate(data, 'rental.create'),
  validateLogin: (data) => validate(data, 'auth.login'),
  validateCancelRental: (data) => validate(data, 'rental.cancel'),
  validateExtendRental: (data) => validate(data, 'rental.extend')
};