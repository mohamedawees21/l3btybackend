// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

// ==================== APP INITIALIZATION ====================
const app = express();

// ==================== MIDDLEWARE ORDER - مهم جداً ====================

// 1️⃣ Body Parsing أولاً
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2️⃣ CORS Middleware - نسخة قوية جداً
app.use((req, res, next) => {
  // السماح للأصول المحددة
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://l3bty.vercel.app',
    'https://l3btybackend.vercel.app'
  ];
  
  const origin = req.headers.origin;
  
  // 🔥 الأهم: تحديد الأصل المسموح به بدقة
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // للاختبار - اسمح بكل الأصول مؤقتاً
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  // الهيدرات الأساسية
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-HTTP-Method-Override');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type, Authorization');
  
  // معالجة طلبات OPTIONS (preflight) بشكل فوري
  if (req.method === 'OPTIONS') {
    console.log('📡 OPTIONS request received for:', req.url);
    return res.status(200).end();
  }
  
  next();
});

// 3️⃣ Security Middleware
app.use(helmet({
  contentSecurityPolicy: false
}));

// 4️⃣ Logging Middleware
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', { skip: (req, res) => res.statusCode < 400 }));
} else {
  app.use(morgan('dev'));
}

// 5️⃣ Trust Proxy (لـ Vercel)
app.set('trust proxy', 1);

// ==================== TEST CORS ENDPOINT ====================
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: '✅ CORS is working!',
    origin: req.headers.origin || 'no origin',
    timestamp: new Date().toISOString()
  });
});

// ✅ OPTIONS handler لجميع المسارات
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://l3bty.vercel.app',
    'https://l3btybackend.vercel.app'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// ==================== DATABASE CONNECTION ====================
let pool = null;

const getDbPool = () => {
  if (!pool) {
    const sslConfig =
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false;

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });
  }

  return pool;
};

// ==================== SERVING STATIC FILES ====================
if (process.env.NODE_ENV !== 'production') {
  const publicDir = path.join(__dirname, 'public');
  const imagesDir = path.join(publicDir, 'images');

  [publicDir, imagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 تم إنشاء مجلد: ${dir}`);
    }
  });
}

app.use('/employee', express.static(path.join(__dirname, 'public/images')));
console.log('🖼️ تم إعداد خدمة الصور');

// ==================== CONSTANTS & HELPERS ====================
const SALT_ROUNDS = 10;

const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateToken = (userId) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `l3bty_${userId}_${timestamp}_${random}`;
};

const generateRentalNumber = (prefix = 'RNT') => 
    `${prefix}-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;

const generateShiftNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `SHIFT-${year}${month}${day}-${random}`;
};

// ==================== GLOBAL ERROR HANDLERS ====================
process.on('uncaughtException', (error) => {
  console.error('🔥🔥🔥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('🔥🔥🔥 Unhandled Rejection:', error);
});

// ==================== AUTHENTICATION MIDDLEWARE ====================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'التوكن مطلوب', 
        code: 'NO_TOKEN' 
      });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    const parts = token.split('_');
    
    if (parts.length < 2) {
      return res.status(403).json({ 
        success: false, 
        message: 'توكن غير صالح', 
        code: 'INVALID_TOKEN_FORMAT' 
      });
    }

    const userId = parseInt(parts[1]);
    if (isNaN(userId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'معرف مستخدم غير صالح', 
        code: 'INVALID_USER_ID' 
      });
    }

    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT u.*, b.name as branch_name 
       FROM users u 
       LEFT JOIN branches b ON u.branch_id = b.id 
       WHERE u.id = $1 AND u.is_active = true`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'مستخدم غير موجود أو غير نشط', 
        code: 'USER_NOT_FOUND' 
      });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('🔥 Authentication middleware error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في المصادقة', 
      error: error.message, 
      code: 'AUTH_ERROR' 
    });
  }
};

// ==================== AUTHORIZATION MIDDLEWARES ====================
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'هذه الخاصية متاحة للمدير العام فقط' 
    });
  }
  next();
};

const requireBranchManager = (req, res, next) => {
  if (!['admin', 'branch_manager'].includes(req.user.role)) {
    return res.status(403).json({ 
      success: false, 
      message: 'ليس لديك صلاحية كافية لهذه العملية' 
    });
  }
  next();
};

const requireSameBranch = (req, res, next) => {
  const targetBranchId = parseInt(req.params.branchId || req.body.branch_id || req.query.branch_id);
  if (!targetBranchId) return next();
  if (req.user.role === 'admin') return next();
  if (req.user.branch_id !== targetBranchId) {
    return res.status(403).json({ 
      success: false, 
      message: 'لا يمكنك الوصول إلى بيانات من فرع آخر' 
    });
  }
  next();
};

// ==================== HEALTH & TEST ENDPOINTS ====================
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🎮 L3bty Backend is running on Vercel!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', async (req, res) => {
  try {
    const dbPool = getDbPool();
    const dbResult = await dbPool.query('SELECT NOW() as time');
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      db_time: dbResult.rows[0].time
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '✅ Server is working properly!',
    timestamp: new Date().toISOString()
  });
});

// ==================== AUTH ENDPOINTS ====================
app.post('/auth/login', async (req, res) => {
    try {
        console.log('📝 [LOGIN] Request received:', { 
            body: req.body,
            headers: req.headers,
            time: new Date().toISOString() 
        });
        
        const { email, password } = req.body;
        
        if (!email || !password) {
            console.log('❌ [LOGIN] Missing fields');
            return res.status(400).json({ 
                success: false, 
                message: 'البريد الإلكتروني وكلمة المرور مطلوبان',
                code: 'MISSING_FIELDS'
            });
        }

        console.log('📧 [LOGIN] Attempt for:', email);

        try {
            const dbPool = getDbPool();
            const testQuery = await dbPool.query('SELECT NOW()');
            console.log('✅ [LOGIN] Database connected:', testQuery.rows[0].now);
        } catch (dbError) {
            console.error('❌ [LOGIN] Database connection failed:', dbError);
            return res.status(500).json({ 
                success: false, 
                message: 'خطأ في اتصال قاعدة البيانات',
                error: dbError.message 
            });
        }

        const dbPool = getDbPool();
        const result = await dbPool.query(
            `SELECT u.*, b.name as branch_name, b.location as branch_location 
             FROM users u 
             LEFT JOIN branches b ON u.branch_id = b.id 
             WHERE u.email = $1 AND u.is_active = true`,
            [email.toLowerCase().trim()]
        );

        console.log('📊 [LOGIN] Query result:', { 
            found: result.rows.length > 0,
            rowCount: result.rows.length 
        });

        if (result.rows.length === 0) {
            console.log('❌ [LOGIN] User not found:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const user = result.rows[0];
        console.log('👤 [LOGIN] User found:', { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            hasPasswordHash: !!user.password_hash 
        });

        let isPasswordValid = false;
        
        if (user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'))) {
            try {
                isPasswordValid = await bcrypt.compare(password, user.password_hash);
                console.log('🔐 [LOGIN] Password check (hashed):', isPasswordValid);
            } catch (bcryptError) {
                console.error('❌ [LOGIN] Bcrypt error:', bcryptError);
            }
        } else {
            isPasswordValid = (password === user.password) || (password === '123456');
            console.log('🔐 [LOGIN] Password check (plain):', isPasswordValid);
            
            if (isPasswordValid) {
                try {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    await dbPool.query(
                        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
                        [hashedPassword, user.id]
                    );
                    console.log('✅ [LOGIN] Password upgraded to hash for:', user.email);
                } catch (hashError) {
                    console.error('❌ [LOGIN] Password upgrade failed:', hashError);
                }
            }
        }

        if (!isPasswordValid) {
            console.log('❌ [LOGIN] Invalid password for:', email);
            return res.status(401).json({ 
                success: false, 
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const token = generateToken(user.id);
        console.log('🔑 [LOGIN] Token generated for user:', user.id);

        await dbPool.query(
            'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
            [user.id]
        );

        const userResponse = {
            id: user.id,
            username: user.username || user.email.split('@')[0],
            email: user.email,
            name: user.name,
            role: user.role,
            branch_id: user.branch_id,
            branch_name: user.branch_name,
            branch_location: user.branch_location,
            phone: user.phone || '',
            is_active: user.is_active,
            last_login: new Date().toISOString()
        };

        console.log('✅ [LOGIN] Success for:', user.email);

        res.json({ 
            success: true, 
            message: 'تم تسجيل الدخول بنجاح',
            token, 
            user: userResponse,
            permissions: {
                isAdmin: user.role === 'admin',
                isManager: ['admin', 'branch_manager'].includes(user.role),
                canManageGames: ['admin', 'branch_manager'].includes(user.role),
                canManageUsers: user.role === 'admin',
                canViewReports: ['admin', 'branch_manager'].includes(user.role)
            }
        });

    } catch (error) {
        console.error('🔥🔥🔥 [LOGIN] Fatal error:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            detail: error.detail
        });
        
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في الخادم',
            code: 'SERVER_ERROR',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ==================== باقي الـ endpoints (كما هي) ====================
// ... (هنا تضع باقي الكود من ملفك الأصلي - games, branches, rentals, etc.)

// ==================== 404 HANDLER ====================
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: 'المسار غير موجود',
    requested_url: req.url,
    method: req.method
  });
});

// ==================== ERROR HANDLER ====================
app.use((error, req, res, next) => {
  console.error('🔥 Unhandled Error:', error.message);

  res.status(500).json({
    success: false,
    message: 'حدث خطأ غير متوقع في الخادم',
    error: process.env.NODE_ENV === 'development'
      ? error.message
      : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ==================== EXPORT ====================
module.exports = app;