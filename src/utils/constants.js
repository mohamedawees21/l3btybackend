module.exports = {
  // أنواع الألعاب
  GAME_TYPES: {
    DRIFT_CAR: 'DRIFT_CAR',
    ELECTRIC_CAR: 'ELECTRIC_CAR', 
    ELECTRIC_BIKE: 'ELECTRIC_BIKE',
    HOVERBOARD: 'HOVERBOARD',
    HARLEY: 'HARLEY',
    ELECTRIC_SCOOTER: 'ELECTRIC_SCOOTER',
    CRAZY_CAR: 'CRAZY_CAR'
  },

  // أسماء الألعاب بالعربية
  GAMES: {
    DRIFT_CAR: {
      name: 'دريفت كار',
      basePrice: 50,
      category: 'cars',
      description: 'سيارة انسيابية مع خاصية الانعطاف الحاد'
    },
    ELECTRIC_CAR: {
      name: 'عربيه كهربائيه', 
      basePrice: 40,
      category: 'cars',
      description: 'سيارة كهربائية صديقة للبيئة'
    },
    ELECTRIC_BIKE: {
      name: 'موتسكل كهربائي',
      basePrice: 30,
      category: 'bikes',
      description: 'دراجة نارية كهربائية خفيفة'
    },
    HOVERBOARD: {
      name: 'هافربورد',
      basePrice: 20,
      category: 'boards',
      description: 'لوح توازن كهربائي'
    },
    HARLEY: {
      name: 'هارلي',
      basePrice: 60,
      category: 'bikes',
      description: 'دراجة نارية أمريكية كلاسيكية'
    },
    ELECTRIC_SCOOTER: {
      name: 'سكوتر كهربائي',
      basePrice: 15,
      category: 'scooters',
      description: 'سكوتر كهربائي قابل للطي'
    },
    CRAZY_CAR: {
      name: 'كريزي كار',
      basePrice: 45,
      category: 'cars',
      description: 'سيارة بأداء عالي وتصميم جريء'
    }
  },

  // حالات التأجير
  RENTAL_STATUS: {
    PENDING: 'pending',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },

  // أدوار المستخدمين
  USER_ROLES: {
    ADMIN: 'admin',
    BRANCH_MANAGER: 'branch_manager',
    EMPLOYEE: 'employee'
  },

  // مدة التأجير الافتراضية
  DEFAULT_DURATIONS: [15, 30, 45, 60],

  // مضاعفات الأسعار حسب المدة
  PRICE_MULTIPLIERS: {
    15: 1.0,
    30: 1.8,
    45: 2.5,
    60: 3.0
  },

  // قيود النظام
  SYSTEM_LIMITS: {
    MAX_CANCELLATION_TIME: 3, // 3 دقائق للإلغاء
    MAX_RENTAL_DURATION: 240, // 4 ساعات كحد أقصى
    MIN_RENTAL_DURATION: 1,   // دقيقة واحدة كحد أدنى
    WARNING_TIME: 5,          // تنبيه قبل 5 دقائق من الانتهاء
    EXTRA_TIME_WARNING: 1     // تنبيه قبل دقيقة من الانتهاء
  }
};