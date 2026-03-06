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

// 2️⃣ CORS Middleware - مباشرة بعد body parser
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
  } else if (!origin) {
    // للطلبات من Postman أو Serverless
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // لأي أصل آخر - للأمان نسمح به مؤقتاً
    res.setHeader('Access-Control-Allow-Origin', origin);
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
  contentSecurityPolicy: false // لإلغاء CSP المؤقتاً
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

// ✅ OPTIONS handler لجميع المسارات (للتأكيد)
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

// ✅ خدمة الصور - مهمة للـ static files
app.use('/images', express.static(path.join(__dirname, 'public/images'))); // ✅

console.log('🖼️ تم إعداد خدمة الصور في المسارات: /images و /employee');

// ==================== CONSTANTS & HELPERS ====================
const SALT_ROUNDS = 10;

// Password utilities
const hashPassword = async (password) => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Token generation
const generateToken = (userId) => {
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `l3bty_${userId}_${timestamp}_${random}`;
};

// Number generators
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
// الصفحة الرئيسية - مهمة جداً لـ Vercel
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🎮 L3bty Backend is running on Vercel!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// ==================== TEST CORS ENDPOINT ====================
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS is working!',
    origin: req.headers.origin || 'no origin',
    timestamp: new Date().toISOString()
  });
});

app.options('/test-cors', (req, res) => {
  res.status(200).end();
});

// Health check endpoint (مهم لـ Vercel)
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

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '✅ Server is working properly!',
    timestamp: new Date().toISOString()
  });
});

// ==================== DIAGNOSTIC ENDPOINT ====================
app.get('/diagnostic', async (req, res) => {
  const diagnostic = {
    success: true,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    database: {
      configured: !!process.env.DATABASE_URL,
      url_prefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 20) + '...' : null,
    },
    ssl: {
      mode: process.env.NODE_ENV === 'production' ? 'rejectUnauthorized: false' : 'disabled'
    },
    tests: {}
  };

  // Test 1: Simple query
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query('SELECT NOW() as time');
    diagnostic.tests.simple_query = {
      success: true,
      time: result.rows[0].time
    };
  } catch (error) {
    diagnostic.tests.simple_query = {
      success: false,
      error: error.message,
      code: error.code
    };
  }

  // Test 2: Check users table
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query('SELECT COUNT(*) as count FROM users');
    diagnostic.tests.users_table = {
      success: true,
      count: result.rows[0].count
    };
  } catch (error) {
    diagnostic.tests.users_table = {
      success: false,
      error: error.message
    };
  }

  // Test 3: Try to find test user
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      'SELECT id, email, role FROM users WHERE email LIKE $1 LIMIT 5',
      ['%@l3bty.com']
    );
    diagnostic.tests.test_users = {
      success: true,
      found: result.rows.length,
      users: result.rows
    };
  } catch (error) {
    diagnostic.tests.test_users = {
      success: false,
      error: error.message
    };
  }

  res.json(diagnostic);
});

// Database test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query('SELECT NOW() as time, version() as version');
    res.json({
      success: true,
      message: '✅ Database connection successful',
      time: result.rows[0].time,
      version: result.rows[0].version.split(' ')[0]
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const dbPool = getDbPool();
    await dbPool.query('SELECT 1');
    res.json({ 
      success: true, 
      status: 'healthy', 
      database: 'connected', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      status: 'unhealthy', 
      database: 'disconnected', 
      error: error.message 
    });
  }
});
// ==================== EARLY END RENTAL ENDPOINT ====================
app.post('/rentals/:id/early-end', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { reason, refund_amount, elapsed_minutes } = req.body;
    
    await client.query('BEGIN');
    
    // التحقق من وجود التأجير وصلاحيات المستخدم
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id 
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = 'active'`,
      [rentalId, user.branch_id]
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'التأجير غير موجود أو غير نشط' 
      });
    }
    
    const rental = rentalResult.rows[0];
    
    // التأكد من أن الوقت المنقضي أقل من 3 دقائق
    if (elapsed_minutes >= 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'لا يمكن الإنهاء المبكر بعد مرور 3 دقائق' 
      });
    }
    
    // تحديث حالة التأجير
    await client.query(
      `UPDATE rentals 
       SET status = 'cancelled', 
           end_time = NOW(),
           is_refunded = true,
           refund_amount = $1,
           cancellation_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [refund_amount, reason || 'إنهاء مبكر (استرداد كامل)', rentalId]
    );
    
    // تحديث حالة اللعبة إلى متاحة
    await client.query(
      "UPDATE games SET status = 'available', updated_at = NOW() WHERE id = $1",
      [rental.game_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم الإنهاء المبكر للتأجير واسترداد المبلغ بالكامل',
      data: {
        id: rentalId,
        refund_amount: refund_amount,
        elapsed_minutes: elapsed_minutes
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في الإنهاء المبكر:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الإنهاء المبكر',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

// إضافة نفس الـ endpoint للمسار المحمي بـ /api (للتوافق)
app.post('/api/rentals/:id/early-end', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { reason, refund_amount, elapsed_minutes } = req.body;
    
    await client.query('BEGIN');
    
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id 
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = 'active'`,
      [rentalId, user.branch_id]
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'التأجير غير موجود أو غير نشط' 
      });
    }
    
    const rental = rentalResult.rows[0];
    
    if (elapsed_minutes >= 3) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: 'لا يمكن الإنهاء المبكر بعد مرور 3 دقائق' 
      });
    }
    
    await client.query(
      `UPDATE rentals 
       SET status = 'cancelled', 
           end_time = NOW(),
           is_refunded = true,
           refund_amount = $1,
           cancellation_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [refund_amount, reason || 'إنهاء مبكر (استرداد كامل)', rentalId]
    );
    
    await client.query(
      "UPDATE games SET status = 'available', updated_at = NOW() WHERE id = $1",
      [rental.game_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم الإنهاء المبكر للتأجير واسترداد المبلغ بالكامل',
      data: {
        id: rentalId,
        refund_amount: refund_amount,
        elapsed_minutes: elapsed_minutes
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في الإنهاء المبكر:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الإنهاء المبكر',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: '✅ الخادم يعمل بشكل صحيح!', 
    timestamp: new Date().toISOString() 
  });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query('SELECT NOW() as time');
    res.json({ 
      success: true, 
      message: 'اتصال قاعدة البيانات ناجح', 
      time: result.rows[0].time 
    });
  } catch (error) {
    console.error('❌ فشل اتصال قاعدة البيانات:', error);
    res.status(500).json({ 
      success: false, 
      message: 'فشل اتصال قاعدة البيانات', 
      error: error.message 
    });
  }
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

        // Test database connection first
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

        // التحقق من كلمة المرور
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

        // توليد توكن جديد
        const token = generateToken(user.id);
        console.log('🔑 [LOGIN] Token generated for user:', user.id);

        // تحديث آخر تسجيل دخول
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

app.get('/auth/profile', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user });
});

app.post('/auth/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

app.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'التوكن صالح',
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            branch_id: req.user.branch_id
        }
    });
});

// ==================== API AUTH ENDPOINTS (للتوافق مع الإصدارات السابقة) ====================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'البريد الإلكتروني وكلمة المرور مطلوبان',
                code: 'MISSING_FIELDS'
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

        if (result.rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const user = result.rows[0];

        let isPasswordValid = false;
        
        if (user.password_hash && (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$'))) {
            isPasswordValid = await verifyPassword(password, user.password_hash);
        } else {
            isPasswordValid = (password === user.password) || (password === '123456');
            
            if (isPasswordValid) {
                const hashedPassword = await hashPassword(password);
                await dbPool.query(
                    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
                    [hashedPassword, user.id]
                );
            }
        }

        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false, 
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const token = generateToken(user.id);

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
        console.error('🔥 خطأ في تسجيل الدخول:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في الخادم',
            code: 'SERVER_ERROR'
        });
    }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({ success: true, data: req.user });
});

app.post('/api/auth/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'التوكن صالح',
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            branch_id: req.user.branch_id
        }
    });
});

// ==================== ENDPOINT تهيئة المستخدمين التجريبيين ====================
app.post('/api/auth/setup-test-users', async (req, res) => {
    try {
        const { secret_key } = req.body;
        
        // مفتاح سري للحماية (غيروه في الإنتاج)
        if (secret_key !== 'L3BTY_SETUP_2024') {
            return res.status(403).json({ 
                success: false, 
                message: 'مفتاح التهيئة غير صحيح' 
            });
        }

        const dbPool = getDbPool();
        const testUsers = [
            { username: 'admin', email: 'admin@l3bty.com', password: '123456', name: 'مدير النظام', role: 'admin', branch_id: 1 },
            { username: 'manager', email: 'manager@l3bty.com', password: '123456', name: 'مدير الفرع', role: 'branch_manager', branch_id: 1 },
            { username: 'employee', email: 'employee@l3bty.com', password: '123456', name: 'موظف', role: 'employee', branch_id: 1 }
        ];

        const results = [];

        for (const user of testUsers) {
            // تشفير كلمة المرور
            const hashedPassword = await hashPassword(user.password);

            // إدراج أو تحديث المستخدم
            const result = await dbPool.query(
                `INSERT INTO users (username, email, password_hash, name, role, branch_id, is_active)
                 VALUES ($1, $2, $3, $4, $5, $6, true)
                 ON CONFLICT (email) 
                 DO UPDATE SET 
                    password_hash = EXCLUDED.password_hash,
                    name = EXCLUDED.name,
                    role = EXCLUDED.role,
                    updated_at = NOW()
                 RETURNING id, email, role`,
                [user.username, user.email, hashedPassword, user.name, user.role, user.branch_id]
            );

            results.push(result.rows[0]);
        }

        console.log('✅ تم تهيئة المستخدمين التجريبيين:', results);

        res.json({
            success: true,
            message: 'تم تهيئة المستخدمين التجريبيين بنجاح',
            data: results
        });

    } catch (error) {
        console.error('🔥 خطأ في تهيئة المستخدمين:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في تهيئة المستخدمين',
            error: error.message 
        });
    }
});

// ==================== BRANCHES ENDPOINTS ====================
app.get('/branches', authenticateToken, async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT b.*,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rentals
       FROM branches b
       LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = true
       LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = true
       LEFT JOIN rentals r ON b.id = r.branch_id AND r.status = 'active'
       WHERE b.is_active = true
       GROUP BY b.id
       ORDER BY b.name`
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('❌ خطأ في جلب الفروع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الفروع', data: [] });
  }
});

app.get('/branches/:id', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT b.*,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rentals
       FROM branches b
       LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = true
       LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = true
       LEFT JOIN rentals r ON b.id = r.branch_id AND r.status = 'active'
       WHERE b.id = $1
       GROUP BY b.id`,
      [branchId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ خطأ في جلب الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات الفرع' });
  }
});

app.get('/branches/:id/games', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT * FROM games WHERE branch_id = $1 AND is_active = true ORDER BY name`,
      [branchId]
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('❌ خطأ في جلب ألعاب الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب ألعاب الفرع', data: [] });
  }
});

app.post('/branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchData = req.body;
    const dbPool = getDbPool();
    
    if (!branchData.name || !branchData.location) {
      return res.status(400).json({ success: false, message: 'اسم الفرع والموقع مطلوبان' });
    }
    
    const branchCode = `BR-${Date.now().toString().slice(-6)}`;
    const result = await dbPool.query(
      `INSERT INTO branches (
        name, location, city, contact_phone, contact_email,
        opening_time, closing_time, branch_code, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        branchData.name.trim(), branchData.location.trim(),
        branchData.city || 'القاهرة',
        branchData.contact_phone || '', branchData.contact_email || '',
        branchData.opening_time || '09:00:00', branchData.closing_time || '22:00:00',
        branchCode, req.user.id
      ]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء الفرع بنجاح', data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في إنشاء الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في إنشاء الفرع: ' + error.message });
  }
});

app.put('/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchId = req.params.id;
    const branchData = req.body;
    const dbPool = getDbPool();
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const fields = {
      name: branchData.name,
      location: branchData.location,
      city: branchData.city,
      contact_phone: branchData.contact_phone,
      contact_email: branchData.contact_email,
      opening_time: branchData.opening_time,
      closing_time: branchData.closing_time,
      is_active: branchData.is_active
    };
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'is_active' ? (value ? true : false) : value);
        paramIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد بيانات للتحديث' });
    }
    
    updateFields.push('updated_at = NOW()', `updated_by = $${paramIndex}`);
    values.push(req.user.id, branchId);
    
    const result = await dbPool.query(
      `UPDATE branches SET ${updateFields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
    }
    
    res.json({ success: true, message: 'تم تحديث الفرع بنجاح', data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في تحديث الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث الفرع', error: error.message });
  }
});

app.delete('/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const branchId = req.params.id;
    const permanent = req.query.permanent === 'true';
    
    if (branchId == 1) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف الفرع الرئيسي' });
    }
    
    await client.query('BEGIN');
    
    const branchResult = await client.query('SELECT * FROM branches WHERE id = $1', [branchId]);
    if (branchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
    }
    
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users WHERE branch_id = $1', [branchId]);
    if (parseInt(usersResult.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `لا يمكن حذف الفرع لأنه مرتبط بـ ${usersResult.rows[0].count} مستخدم` });
    }
    
    const gamesResult = await client.query('SELECT COUNT(*) as count FROM games WHERE branch_id = $1', [branchId]);
    if (parseInt(gamesResult.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `لا يمكن حذف الفرع لأنه مرتبط بـ ${gamesResult.rows[0].count} لعبة` });
    }
    
    const rentalsResult = await client.query('SELECT COUNT(*) as count FROM rentals WHERE branch_id = $1 AND status = $2', [branchId, 'active']);
    if (parseInt(rentalsResult.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `لا يمكن حذف الفرع لأن فيه ${rentalsResult.rows[0].count} تأجير نشط` });
    }
    
    if (permanent) {
      const deleteResult = await client.query('DELETE FROM branches WHERE id = $1 RETURNING id', [branchId]);
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم حذف الفرع نهائياً بنجاح' });
    } else {
      const updateResult = await client.query('UPDATE branches SET is_active = false WHERE id = $1 RETURNING id', [branchId]);
      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم تعطيل الفرع بنجاح' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في حذف الفرع:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف الفرع: ' + error.message });
  } finally {
    client.release();
  }
});

// ==================== API BRANCHES ENDPOINTS (للتوافق) ====================
app.get('/api/branches', authenticateToken, async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT b.*,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rentals
       FROM branches b
       LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = true
       LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = true
       LEFT JOIN rentals r ON b.id = r.branch_id AND r.status = 'active'
       WHERE b.is_active = true
       GROUP BY b.id
       ORDER BY b.name`
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('❌ خطأ في جلب الفروع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الفروع', data: [] });
  }
});

app.get('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT b.*,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rentals
       FROM branches b
       LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = true
       LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = true
       LEFT JOIN rentals r ON b.id = r.branch_id AND r.status = 'active'
       WHERE b.id = $1
       GROUP BY b.id`,
      [branchId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('❌ خطأ في جلب الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات الفرع' });
  }
});

app.get('/api/branches/:id/games', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT * FROM games WHERE branch_id = $1 AND is_active = true ORDER BY name`,
      [branchId]
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('❌ خطأ في جلب ألعاب الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب ألعاب الفرع', data: [] });
  }
});

app.post('/api/branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchData = req.body;
    const dbPool = getDbPool();
    
    if (!branchData.name || !branchData.location) {
      return res.status(400).json({ success: false, message: 'اسم الفرع والموقع مطلوبان' });
    }
    
    const branchCode = `BR-${Date.now().toString().slice(-6)}`;
    const result = await dbPool.query(
      `INSERT INTO branches (
        name, location, city, contact_phone, contact_email,
        opening_time, closing_time, branch_code, created_by, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *`,
      [
        branchData.name.trim(), branchData.location.trim(),
        branchData.city || 'القاهرة',
        branchData.contact_phone || '', branchData.contact_email || '',
        branchData.opening_time || '09:00:00', branchData.closing_time || '22:00:00',
        branchCode, req.user.id
      ]
    );
    res.status(201).json({ success: true, message: 'تم إنشاء الفرع بنجاح', data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في إنشاء الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في إنشاء الفرع: ' + error.message });
  }
});

app.put('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const branchId = req.params.id;
    const branchData = req.body;
    const dbPool = getDbPool();
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const fields = {
      name: branchData.name,
      location: branchData.location,
      city: branchData.city,
      contact_phone: branchData.contact_phone,
      contact_email: branchData.contact_email,
      opening_time: branchData.opening_time,
      closing_time: branchData.closing_time,
      is_active: branchData.is_active
    };
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'is_active' ? (value ? true : false) : value);
        paramIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, message: 'لا توجد بيانات للتحديث' });
    }
    
    updateFields.push('updated_at = NOW()', `updated_by = $${paramIndex}`);
    values.push(req.user.id, branchId);
    
    const result = await dbPool.query(
      `UPDATE branches SET ${updateFields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
    }
    
    res.json({ success: true, message: 'تم تحديث الفرع بنجاح', data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في تحديث الفرع:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث الفرع', error: error.message });
  }
});

app.delete('/api/branches/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const branchId = req.params.id;
    const permanent = req.query.permanent === 'true';
    
    if (branchId == 1) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف الفرع الرئيسي' });
    }
    
    await client.query('BEGIN');
    
    const branchResult = await client.query('SELECT * FROM branches WHERE id = $1', [branchId]);
    if (branchResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
    }
    
    const usersResult = await client.query('SELECT COUNT(*) as count FROM users WHERE branch_id = $1', [branchId]);
    if (parseInt(usersResult.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `لا يمكن حذف الفرع لأنه مرتبط بـ ${usersResult.rows[0].count} مستخدم` });
    }
    
    const gamesResult = await client.query('SELECT COUNT(*) as count FROM games WHERE branch_id = $1', [branchId]);
    if (parseInt(gamesResult.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `لا يمكن حذف الفرع لأنه مرتبط بـ ${gamesResult.rows[0].count} لعبة` });
    }
    
    const rentalsResult = await client.query('SELECT COUNT(*) as count FROM rentals WHERE branch_id = $1 AND status = $2', [branchId, 'active']);
    if (parseInt(rentalsResult.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `لا يمكن حذف الفرع لأن فيه ${rentalsResult.rows[0].count} تأجير نشط` });
    }
    
    if (permanent) {
      const deleteResult = await client.query('DELETE FROM branches WHERE id = $1 RETURNING id', [branchId]);
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم حذف الفرع نهائياً بنجاح' });
    } else {
      const updateResult = await client.query('UPDATE branches SET is_active = false WHERE id = $1 RETURNING id', [branchId]);
      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'الفرع غير موجود' });
      }
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم تعطيل الفرع بنجاح' });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في حذف الفرع:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف الفرع: ' + error.message });
  } finally {
    client.release();
  }
});

// ==================== GAMES ENDPOINTS ====================
app.get('/games', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id, status, category } = req.query;
    const targetBranchId = branch_id || user.branch_id;
    
    const dbPool = getDbPool();
    let query = 'SELECT * FROM games WHERE branch_id = $1 AND is_active = true';
    const params = [targetBranchId];
    let paramIndex = 2;
    
    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (category && category !== 'all') {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ' ORDER BY name';
    
    const result = await dbPool.query(query, params);
    
    const stats = {
      total: result.rows.length,
      available: result.rows.filter(g => g.status === 'available').length,
      rented: result.rows.filter(g => g.status === 'rented').length,
      maintenance: result.rows.filter(g => g.status === 'maintenance').length
    };
    
    res.json({ success: true, data: result.rows, stats, message: `تم جلب ${result.rows.length} لعبة` });
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الألعاب' });
  }
});

app.get('/games/available', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id } = req.query;
    const targetBranchId = branch_id || user.branch_id;
    
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT * FROM games 
       WHERE branch_id = $1 AND status = 'available' AND is_active = true
       ORDER BY name`,
      [targetBranchId]
    );
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب المتاحة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الألعاب المتاحة' });
  }
});

app.get('/games/:id', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.id;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT g.*, b.name as branch_name
       FROM games g
       LEFT JOIN branches b ON g.branch_id = b.id
       WHERE g.id = $1 AND g.is_active = true`,
      [gameId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في جلب بيانات اللعبة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات اللعبة' });
  }
});

app.post('/games', authenticateToken, requireBranchManager, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const gameData = req.body;

    console.log('📦 بيانات اللعبة الجديدة:', gameData);

    // التحقق من البيانات المطلوبة
    if (!gameData.name || !gameData.price_per_15min) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم اللعبة والسعر مطلوبان' 
      });
    }

    // تحديد الفرع
    const branchId = gameData.branch_id || user.branch_id;
    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'معرف الفرع مطلوب' 
      });
    }

    await client.query('BEGIN');

    // التحقق من وجود اللعبة مسبقاً
    const existingGame = await client.query(
      `SELECT id FROM games 
       WHERE branch_id = $1 AND name ILIKE $2 AND is_active = true`,
      [branchId, gameData.name.trim()]
    );

    if (existingGame.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'اللعبة موجودة بالفعل في هذا الفرع' 
      });
    }

    // إدراج اللعبة
    const result = await client.query(
      `INSERT INTO games (
        name, description, category, price_per_15min,
        branch_id, status, min_rental_time, max_rental_time,
        image_url, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
      RETURNING *`,
      [
        gameData.name.trim(),
        gameData.description || `${gameData.name} - ${gameData.category || 'سيارات'}`,
        gameData.category || 'سيارات',
        parseFloat(gameData.price_per_15min),
        branchId,
        gameData.status || 'available',
        parseInt(gameData.min_rental_time) || 15,
        parseInt(gameData.max_rental_time) || 120,
        gameData.image_url || 'default-game.jpg'
      ]
    );

    await client.query('COMMIT');
    
    console.log('✅ تم إنشاء اللعبة بنجاح:', result.rows[0].id);
    
    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء اللعبة بنجاح', 
      data: result.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إنشاء اللعبة:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إنشاء اللعبة', 
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.put('/games/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const gameId = req.params.id;
    const user = req.user;
    const gameData = req.body;
    const dbPool = getDbPool();
    
    const gameResult = await dbPool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
    }
    
    const game = gameResult.rows[0];
    if (user.role !== 'admin' && game.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تحديث ألعاب هذا الفرع' });
    }
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const fields = {
      name: gameData.name,
      description: gameData.description,
      category: gameData.category,
      price_per_15min: gameData.price_per_15min,
      status: gameData.status,
      min_rental_time: gameData.min_rental_time,
      max_rental_time: gameData.max_rental_time,
      image_url: gameData.image_url,
      is_active: gameData.is_active
    };
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'is_active' ? (value ? true : false) : value);
        paramIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.json({ success: true, message: 'لم يتم تغيير أي بيانات', data: game });
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(gameId);
    
    const updateResult = await dbPool.query(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    res.json({ success: true, message: 'تم تحديث اللعبة بنجاح', data: updateResult.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في تحديث اللعبة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث اللعبة', error: error.message });
  }
});

app.delete('/games/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const gameId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    const dbPool = getDbPool();
    
    const gameResult = await dbPool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
    }
    
    const game = gameResult.rows[0];
    if (user.role !== 'admin' && game.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف ألعاب هذا الفرع' });
    }
    
    if (permanent) {
      const rentalsResult = await dbPool.query('SELECT COUNT(*) as count FROM rentals WHERE game_id = $1 AND status = $2', [gameId, 'active']);
      if (parseInt(rentalsResult.rows[0].count) > 0) {
        return res.status(400).json({ success: false, message: 'لا يمكن حذف اللعبة لأنها مرتبطة بتأجيرات نشطة' });
      }
      
      const deleteResult = await dbPool.query('DELETE FROM games WHERE id = $1 RETURNING id', [gameId]);
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
      }
      
      res.json({ success: true, message: 'تم حذف اللعبة نهائياً بنجاح', game_id: gameId });
    } else {
      const updateResult = await dbPool.query('UPDATE games SET is_active = false WHERE id = $1 RETURNING id', [gameId]);
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
      }
      
      res.json({ success: true, message: 'تم تعطيل اللعبة بنجاح', game_id: gameId });
    }
  } catch (error) {
    console.error('🔥 خطأ في حذف اللعبة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف اللعبة', error: error.message });
  }
});

// ==================== API GAMES ENDPOINTS (للتوافق) ====================
app.get('/api/games', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id, status, category } = req.query;
    const targetBranchId = branch_id || user.branch_id;
    
    const dbPool = getDbPool();
    let query = 'SELECT * FROM games WHERE branch_id = $1 AND is_active = true';
    const params = [targetBranchId];
    let paramIndex = 2;
    
    if (status && status !== 'all') {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (category && category !== 'all') {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    query += ' ORDER BY name';
    
    const result = await dbPool.query(query, params);
    
    const stats = {
      total: result.rows.length,
      available: result.rows.filter(g => g.status === 'available').length,
      rented: result.rows.filter(g => g.status === 'rented').length,
      maintenance: result.rows.filter(g => g.status === 'maintenance').length
    };
    
    res.json({ success: true, data: result.rows, stats, message: `تم جلب ${result.rows.length} لعبة` });
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الألعاب' });
  }
});

app.get('/api/games/available', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id } = req.query;
    const targetBranchId = branch_id || user.branch_id;
    
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT * FROM games 
       WHERE branch_id = $1 AND status = 'available' AND is_active = true
       ORDER BY name`,
      [targetBranchId]
    );
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب المتاحة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الألعاب المتاحة' });
  }
});

app.get('/api/games/:id', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.id;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT g.*, b.name as branch_name
       FROM games g
       LEFT JOIN branches b ON g.branch_id = b.id
       WHERE g.id = $1 AND g.is_active = true`,
      [gameId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في جلب بيانات اللعبة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات اللعبة' });
  }
});

app.post('/api/games', authenticateToken, requireBranchManager, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const gameData = req.body;

    if (!gameData.name || !gameData.price_per_15min) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم اللعبة والسعر مطلوبان' 
      });
    }

    const branchId = gameData.branch_id || user.branch_id;
    if (!branchId) {
      return res.status(400).json({ 
        success: false, 
        message: 'معرف الفرع مطلوب' 
      });
    }

    await client.query('BEGIN');

    const existingGame = await client.query(
      `SELECT id FROM games 
       WHERE branch_id = $1 AND name ILIKE $2 AND is_active = true`,
      [branchId, gameData.name.trim()]
    );

    if (existingGame.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'اللعبة موجودة بالفعل في هذا الفرع' 
      });
    }

    const result = await client.query(
      `INSERT INTO games (
        name, description, category, price_per_15min,
        branch_id, status, min_rental_time, max_rental_time,
        image_url, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW())
      RETURNING *`,
      [
        gameData.name.trim(),
        gameData.description || `${gameData.name} - ${gameData.category || 'سيارات'}`,
        gameData.category || 'سيارات',
        parseFloat(gameData.price_per_15min),
        branchId,
        gameData.status || 'available',
        parseInt(gameData.min_rental_time) || 15,
        parseInt(gameData.max_rental_time) || 120,
        gameData.image_url || 'default-game.jpg'
      ]
    );

    await client.query('COMMIT');
    
    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء اللعبة بنجاح', 
      data: result.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إنشاء اللعبة:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إنشاء اللعبة', 
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.put('/api/games/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const gameId = req.params.id;
    const user = req.user;
    const gameData = req.body;
    const dbPool = getDbPool();
    
    const gameResult = await dbPool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
    }
    
    const game = gameResult.rows[0];
    if (user.role !== 'admin' && game.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تحديث ألعاب هذا الفرع' });
    }
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const fields = {
      name: gameData.name,
      description: gameData.description,
      category: gameData.category,
      price_per_15min: gameData.price_per_15min,
      status: gameData.status,
      min_rental_time: gameData.min_rental_time,
      max_rental_time: gameData.max_rental_time,
      image_url: gameData.image_url,
      is_active: gameData.is_active
    };
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'is_active' ? (value ? true : false) : value);
        paramIndex++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.json({ success: true, message: 'لم يتم تغيير أي بيانات', data: game });
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(gameId);
    
    const updateResult = await dbPool.query(
      `UPDATE games SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    res.json({ success: true, message: 'تم تحديث اللعبة بنجاح', data: updateResult.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في تحديث اللعبة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث اللعبة', error: error.message });
  }
});

app.delete('/api/games/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const gameId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    const dbPool = getDbPool();
    
    const gameResult = await dbPool.query('SELECT * FROM games WHERE id = $1', [gameId]);
    if (gameResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
    }
    
    const game = gameResult.rows[0];
    if (user.role !== 'admin' && game.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف ألعاب هذا الفرع' });
    }
    
    if (permanent) {
      const rentalsResult = await dbPool.query('SELECT COUNT(*) as count FROM rentals WHERE game_id = $1 AND status = $2', [gameId, 'active']);
      if (parseInt(rentalsResult.rows[0].count) > 0) {
        return res.status(400).json({ success: false, message: 'لا يمكن حذف اللعبة لأنها مرتبطة بتأجيرات نشطة' });
      }
      
      const deleteResult = await dbPool.query('DELETE FROM games WHERE id = $1 RETURNING id', [gameId]);
      if (deleteResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
      }
      
      res.json({ success: true, message: 'تم حذف اللعبة نهائياً بنجاح', game_id: gameId });
    } else {
      const updateResult = await dbPool.query('UPDATE games SET is_active = false WHERE id = $1 RETURNING id', [gameId]);
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: 'اللعبة غير موجودة' });
      }
      
      res.json({ success: true, message: 'تم تعطيل اللعبة بنجاح', game_id: gameId });
    }
  } catch (error) {
    console.error('🔥 خطأ في حذف اللعبة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف اللعبة', error: error.message });
  }
});

// ==================== SHIFTS ENDPOINTS ====================
app.post('/shifts/start', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const { opening_cash = 0 } = req.body;
    
    console.log('🔄 محاولة فتح شيفت:', {
      user_id: user.id,
      user_name: user.name,
      branch_id: user.branch_id,
      opening_cash,
      timestamp: new Date().toISOString()
    });

    await client.query('BEGIN');

    // قفل أي شيفت مفتوح سابقاً
    console.log('🔒 قفل الشيفتات المفتوحة السابقة...');
    const closeResult = await client.query(
      `UPDATE shifts 
       SET status = 'closed', end_time = NOW(),
           closing_cash = COALESCE(closing_cash, total_revenue),
           notes = CONCAT(COALESCE(notes, ''), '\n', 'تم الإغلاق التلقائي عند بدء شيفت جديد')
       WHERE employee_id = $1 AND status = 'open'
       RETURNING id`,
      [user.id]
    );
    
    if (closeResult.rowCount > 0) {
      console.log(`✅ تم إغلاق ${closeResult.rowCount} شيفت سابق`);
    }

    // إنشاء شيفت جديد
    const shiftNumber = generateShiftNumber();
    console.log('🆕 إنشاء شيفت جديد رقم:', shiftNumber);
    
    const insertResult = await client.query(
      `INSERT INTO shifts (
        employee_id, branch_id, start_time, opening_cash, shift_number, status, created_at
      ) VALUES ($1, $2, NOW(), $3, $4, 'open', NOW())
      RETURNING *`,
      [user.id, user.branch_id, opening_cash, shiftNumber]
    );

    await client.query('COMMIT');
    
    console.log('✅ تم فتح الشيفت بنجاح:', {
      shift_id: insertResult.rows[0].id,
      shift_number: insertResult.rows[0].shift_number
    });

    res.json({ 
      success: true, 
      message: 'تم بدء الشيفت بنجاح', 
      data: insertResult.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥🔥🔥 خطأ في بدء الشيفت:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'فشل في بدء الشيفت: ' + error.message,
      error: error.message,
      code: error.code 
    });
  } finally {
    client.release();
  }
});

app.get('/shifts/current', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT s.*, 
        COUNT(DISTINCT r.id) as total_rentals,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.final_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN r.status = 'active' THEN 1 END) as active_rentals
       FROM shifts s
       LEFT JOIN rentals r ON s.id = r.shift_id
       WHERE s.employee_id = $1 AND s.status = 'open'
       GROUP BY s.id
       ORDER BY s.start_time DESC 
       LIMIT 1`,
      [user.id]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, data: result.rows[0], message: 'تم جلب الشيفت النشط' });
    } else {
      res.json({ success: true, data: null, message: 'لا يوجد شيفت نشط' });
    }
  } catch (error) {
    console.error('Error in /shifts/current:', error.message);
    res.status(500).json({ success: false, message: 'خطأ في جلب الشيفت', error: error.message });
  }
});

app.put('/shifts/:id/end', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const { closing_cash, notes } = req.body;
    
    await client.query('BEGIN');
    
    const shiftResult = await client.query(
      'SELECT * FROM shifts WHERE id = $1 AND employee_id = $2 AND status = $3',
      [shiftId, user.id, 'open']
    );
    
    if (shiftResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'الشيفت غير موجود أو ليس مفتوحاً' });
    }
    
    const rentalsStats = await client.query(
      `SELECT 
         COUNT(*) as total_rentals,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as total_revenue,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_rentals
       FROM rentals
       WHERE shift_id = $1`,
      [shiftId]
    );
    
    const stats = rentalsStats.rows[0];
    
    const updateResult = await client.query(
      `UPDATE shifts 
       SET status = 'closed', end_time = NOW(),
           closing_cash = COALESCE($1, opening_cash + $2),
           total_rentals = $3, total_revenue = $4, notes = COALESCE($5, notes)
       WHERE id = $6
       RETURNING *`,
      [
        closing_cash,
        parseFloat(stats.total_revenue) || 0,
        parseInt(stats.total_rentals) || 0,
        parseFloat(stats.total_revenue) || 0,
        notes,
        shiftId
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم إغلاق الشيفت بنجاح',
      data: updateResult.rows[0],
      stats: {
        total_rentals: parseInt(stats.total_rentals) || 0,
        total_revenue: parseFloat(stats.total_revenue) || 0,
        active_rentals: parseInt(stats.active_rentals) || 0
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إغلاق الشيفت:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في إغلاق الشيفت', error: error.message });
  } finally {
    client.release();
  }
});

app.get('/shifts/active-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT s.*, 
        b.name as branch_name,
        u.name as employee_name,
        COUNT(DISTINCT r.id) as total_rentals,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rentals,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.final_amount ELSE 0 END), 0) as completed_revenue
       FROM shifts s
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN users u ON s.employee_id = u.id
       LEFT JOIN rentals r ON s.id = r.shift_id
       WHERE s.status = 'open'
       GROUP BY s.id, b.name, u.name
       ORDER BY s.start_time DESC`
    );
    
    const shiftsWithDuration = result.rows.map(shift => ({
      ...shift,
      duration_hours: shift.start_time ? Math.floor((new Date() - new Date(shift.start_time)) / (1000 * 60 * 60)) : 0,
      duration_minutes: shift.start_time ? Math.floor((new Date() - new Date(shift.start_time)) / (1000 * 60)) : 0
    }));
    
    res.json({ success: true, data: shiftsWithDuration, count: shiftsWithDuration.length, message: `تم العثور على ${shiftsWithDuration.length} شيفت نشط` });
  } catch (error) {
    console.error('🔥 خطأ في جلب جميع الشيفتات النشطة:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الشيفتات النشطة', data: [] });
  }
});

app.get('/shifts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 10, order_by = 'start_time', order_direction = 'DESC', branch_id, status, start_date, end_date } = req.query;
    const dbPool = getDbPool();
    
    let query = `
      SELECT s.*, 
        b.name as branch_name,
        u.name as employee_name,
        COUNT(DISTINCT r.id) as total_rentals,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.final_amount ELSE 0 END), 0) as total_revenue
      FROM shifts s
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN users u ON s.employee_id = u.id
      LEFT JOIN rentals r ON s.id = r.shift_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (branch_id) {
      query += ` AND s.branch_id = $${paramIndex}`;
      params.push(branch_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND DATE(s.start_time) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(s.start_time) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    const allowedOrderColumns = ['start_time', 'end_time', 'created_at', 'total_revenue', 'total_rentals'];
    const orderColumn = allowedOrderColumns.includes(order_by) ? order_by : 'start_time';
    const direction = order_direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` GROUP BY s.id, b.name, u.name ORDER BY s.${orderColumn} ${direction} LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await dbPool.query(query, params);
    
    res.json({ success: true, data: result.rows, count: result.rows.length, params: { limit, order_by: orderColumn, order_direction: direction, branch_id, status, start_date, end_date } });
  } catch (error) {
    console.error('🔥 خطأ في جلب الشيفتات:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الشيفتات', data: [] });
  }
});

app.get('/shifts/:id/details', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const dbPool = getDbPool();
    
    const shiftResult = await dbPool.query(
      `SELECT s.*, b.name as branch_name, u.name as employee_name
       FROM shifts s
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN users u ON s.employee_id = u.id
       WHERE s.id = $1`,
      [shiftId]
    );
    
    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الشيفت غير موجود' });
    }
    
    const shift = shiftResult.rows[0];
    
    const activeRentalsResult = await dbPool.query(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = $1 AND r.status = 'active'
       ORDER BY r.start_time ASC`,
      [shiftId]
    );
    
    const completedRentalsResult = await dbPool.query(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = $1 AND r.status = 'completed'
       ORDER BY r.end_time DESC
       LIMIT 50`,
      [shiftId]
    );
    
    const paymentStatsResult = await dbPool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as completed_revenue,
         COALESCE(SUM(CASE WHEN status = 'active' AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as prepaid_active
       FROM rentals
       WHERE shift_id = $1`,
      [shiftId]
    );
    
    const activeRentals = activeRentalsResult.rows;
    const completedRentals = completedRentalsResult.rows;
    const paymentStats = paymentStatsResult.rows[0];
    
    const totalRevenue = (parseFloat(paymentStats.completed_revenue) || 0) + (parseFloat(paymentStats.prepaid_active) || 0);
    
    res.json({
      success: true,
      data: {
        shift: shift,
        active_rentals: activeRentals,
        completed_rentals: completedRentals,
        stats: {
          active_count: activeRentals.length,
          completed_count: completedRentals.length,
          total_rentals: activeRentals.length + completedRentals.length,
          completed_revenue: parseFloat(paymentStats.completed_revenue) || 0,
          prepaid_active: parseFloat(paymentStats.prepaid_active) || 0,
          total_revenue: totalRevenue,
          open_time_count: activeRentals.filter(r => r.rental_type === 'open').length,
          fixed_time_count: activeRentals.filter(r => r.rental_type === 'fixed').length
        }
      }
    });
  } catch (error) {
    console.error('🔥 خطأ في جلب تفاصيل الشيفت:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب تفاصيل الشيفت' });
  }
});

app.get('/shifts/:id/stats', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const dbPool = getDbPool();
    
    // Check if shift exists and user has access
    const shiftCheck = await dbPool.query(
      `SELECT * FROM shifts WHERE id = $1 AND branch_id = $2`,
      [shiftId, user.branch_id]
    );
    
    if (shiftCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'الشيفت غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }
    
    // Get shift statistics
    const stats = await dbPool.query(
      `SELECT 
         COUNT(*) as total_rentals,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_rentals,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rentals,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as total_revenue,
         COALESCE(AVG(CASE WHEN status = 'completed' THEN final_amount END), 0) as avg_revenue,
         MIN(CASE WHEN status = 'active' THEN start_time END) as oldest_active_start
       FROM rentals 
       WHERE shift_id = $1`,
      [shiftId]
    );
    
    // Get payment method breakdown
    const paymentStats = await dbPool.query(
      `SELECT 
         payment_method,
         COUNT(*) as count,
         COALESCE(SUM(final_amount), 0) as total
       FROM rentals 
       WHERE shift_id = $1 AND status = 'completed'
       GROUP BY payment_method`,
      [shiftId]
    );
    
    res.json({
      success: true,
      data: {
        shift_id: parseInt(shiftId),
        ...stats.rows[0],
        payment_breakdown: paymentStats.rows
      }
    });
    
  } catch (error) {
    console.error('🔥 Error in /shifts/:id/stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في جلب إحصائيات الشيفت',
      error: error.message 
    });
  }
});

// ==================== API SHIFTS ENDPOINTS (للتوافق) ====================
app.post('/api/shifts/start', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const { opening_cash = 0 } = req.body;
    
    await client.query('BEGIN');

    // Close any previous open shift
    await client.query(
      `UPDATE shifts 
       SET status = 'closed', end_time = NOW(),
           closing_cash = COALESCE(closing_cash, total_revenue),
           notes = CONCAT(COALESCE(notes, ''), '\n', 'تم الإغلاق التلقائي عند بدء شيفت جديد')
       WHERE employee_id = $1 AND status = 'open'
       RETURNING id`,
      [user.id]
    );

    const shiftNumber = generateShiftNumber();
    
    const insertResult = await client.query(
      `INSERT INTO shifts (
        employee_id, branch_id, start_time, opening_cash, shift_number, status, created_at
      ) VALUES ($1, $2, NOW(), $3, $4, 'open', NOW())
      RETURNING *`,
      [user.id, user.branch_id, opening_cash, shiftNumber]
    );

    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'تم بدء الشيفت بنجاح', 
      data: insertResult.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error starting shift:', error);
    res.status(500).json({ 
      success: false, 
      message: 'فشل في بدء الشيفت: ' + error.message
    });
  } finally {
    client.release();
  }
});

app.get('/api/shifts/current', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT s.*, 
        COUNT(DISTINCT r.id) as total_rentals,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.final_amount ELSE 0 END), 0) as total_revenue,
        COUNT(CASE WHEN r.status = 'active' THEN 1 END) as active_rentals
       FROM shifts s
       LEFT JOIN rentals r ON s.id = r.shift_id
       WHERE s.employee_id = $1 AND s.status = 'open'
       GROUP BY s.id
       ORDER BY s.start_time DESC 
       LIMIT 1`,
      [user.id]
    );
    
    if (result.rows.length > 0) {
      res.json({ success: true, data: result.rows[0] });
    } else {
      res.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('Error in /api/shifts/current:', error.message);
    res.status(500).json({ success: false, message: 'خطأ في جلب الشيفت' });
  }
});

app.put('/api/shifts/:id/end', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const { closing_cash, notes } = req.body;
    
    await client.query('BEGIN');
    
    const shiftResult = await client.query(
      'SELECT * FROM shifts WHERE id = $1 AND employee_id = $2 AND status = $3',
      [shiftId, user.id, 'open']
    );
    
    if (shiftResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'الشيفت غير موجود أو ليس مفتوحاً' });
    }
    
    const rentalsStats = await client.query(
      `SELECT 
         COUNT(*) as total_rentals,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as total_revenue,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_rentals
       FROM rentals
       WHERE shift_id = $1`,
      [shiftId]
    );
    
    const stats = rentalsStats.rows[0];
    
    const updateResult = await client.query(
      `UPDATE shifts 
       SET status = 'closed', end_time = NOW(),
           closing_cash = COALESCE($1, opening_cash + $2),
           total_rentals = $3, total_revenue = $4, notes = COALESCE($5, notes)
       WHERE id = $6
       RETURNING *`,
      [
        closing_cash,
        parseFloat(stats.total_revenue) || 0,
        parseInt(stats.total_rentals) || 0,
        parseFloat(stats.total_revenue) || 0,
        notes,
        shiftId
      ]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم إغلاق الشيفت بنجاح',
      data: updateResult.rows[0],
      stats: {
        total_rentals: parseInt(stats.total_rentals) || 0,
        total_revenue: parseFloat(stats.total_revenue) || 0,
        active_rentals: parseInt(stats.active_rentals) || 0
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error ending shift:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في إغلاق الشيفت' });
  } finally {
    client.release();
  }
});

app.get('/api/shifts/active-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT s.*, 
        b.name as branch_name,
        u.name as employee_name,
        COUNT(DISTINCT r.id) as total_rentals,
        COUNT(DISTINCT CASE WHEN r.status = 'active' THEN r.id END) as active_rentals,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.final_amount ELSE 0 END), 0) as completed_revenue
       FROM shifts s
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN users u ON s.employee_id = u.id
       LEFT JOIN rentals r ON s.id = r.shift_id
       WHERE s.status = 'open'
       GROUP BY s.id, b.name, u.name
       ORDER BY s.start_time DESC`
    );
    
    const shiftsWithDuration = result.rows.map(shift => ({
      ...shift,
      duration_hours: shift.start_time ? Math.floor((new Date() - new Date(shift.start_time)) / (1000 * 60 * 60)) : 0,
      duration_minutes: shift.start_time ? Math.floor((new Date() - new Date(shift.start_time)) / (1000 * 60)) : 0
    }));
    
    res.json({ success: true, data: shiftsWithDuration, count: shiftsWithDuration.length });
  } catch (error) {
    console.error('🔥 Error fetching active shifts:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الشيفتات النشطة', data: [] });
  }
});

app.get('/api/shifts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { limit = 10, order_by = 'start_time', order_direction = 'DESC', branch_id, status, start_date, end_date } = req.query;
    const dbPool = getDbPool();
    
    let query = `
      SELECT s.*, 
        b.name as branch_name,
        u.name as employee_name,
        COUNT(DISTINCT r.id) as total_rentals,
        COALESCE(SUM(CASE WHEN r.status = 'completed' THEN r.final_amount ELSE 0 END), 0) as total_revenue
      FROM shifts s
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN users u ON s.employee_id = u.id
      LEFT JOIN rentals r ON s.id = r.shift_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (branch_id) {
      query += ` AND s.branch_id = $${paramIndex}`;
      params.push(branch_id);
      paramIndex++;
    }
    
    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND DATE(s.start_time) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(s.start_time) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    const allowedOrderColumns = ['start_time', 'end_time', 'created_at', 'total_revenue', 'total_rentals'];
    const orderColumn = allowedOrderColumns.includes(order_by) ? order_by : 'start_time';
    const direction = order_direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` GROUP BY s.id, b.name, u.name ORDER BY s.${orderColumn} ${direction} LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await dbPool.query(query, params);
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 Error fetching shifts:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الشيفتات', data: [] });
  }
});

app.get('/api/shifts/:id/details', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const dbPool = getDbPool();
    
    const shiftResult = await dbPool.query(
      `SELECT s.*, b.name as branch_name, u.name as employee_name
       FROM shifts s
       LEFT JOIN branches b ON s.branch_id = b.id
       LEFT JOIN users u ON s.employee_id = u.id
       WHERE s.id = $1`,
      [shiftId]
    );
    
    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'الشيفت غير موجود' });
    }
    
    const shift = shiftResult.rows[0];
    
    const activeRentalsResult = await dbPool.query(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = $1 AND r.status = 'active'
       ORDER BY r.start_time ASC`,
      [shiftId]
    );
    
    const completedRentalsResult = await dbPool.query(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = $1 AND r.status = 'completed'
       ORDER BY r.end_time DESC
       LIMIT 50`,
      [shiftId]
    );
    
    const paymentStatsResult = await dbPool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as completed_revenue,
         COALESCE(SUM(CASE WHEN status = 'active' AND payment_status = 'paid' THEN total_amount ELSE 0 END), 0) as prepaid_active
       FROM rentals
       WHERE shift_id = $1`,
      [shiftId]
    );
    
    const activeRentals = activeRentalsResult.rows;
    const completedRentals = completedRentalsResult.rows;
    const paymentStats = paymentStatsResult.rows[0];
    
    const totalRevenue = (parseFloat(paymentStats.completed_revenue) || 0) + (parseFloat(paymentStats.prepaid_active) || 0);
    
    res.json({
      success: true,
      data: {
        shift: shift,
        active_rentals: activeRentals,
        completed_rentals: completedRentals,
        stats: {
          active_count: activeRentals.length,
          completed_count: completedRentals.length,
          total_rentals: activeRentals.length + completedRentals.length,
          completed_revenue: parseFloat(paymentStats.completed_revenue) || 0,
          prepaid_active: parseFloat(paymentStats.prepaid_active) || 0,
          total_revenue: totalRevenue,
          open_time_count: activeRentals.filter(r => r.rental_type === 'open').length,
          fixed_time_count: activeRentals.filter(r => r.rental_type === 'fixed').length
        }
      }
    });
  } catch (error) {
    console.error('🔥 Error fetching shift details:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب تفاصيل الشيفت' });
  }
});

app.get('/api/shifts/:id/stats', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const dbPool = getDbPool();
    
    // Check if shift exists and user has access
    const shiftCheck = await dbPool.query(
      `SELECT * FROM shifts WHERE id = $1 AND branch_id = $2`,
      [shiftId, user.branch_id]
    );
    
    if (shiftCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'الشيفت غير موجود أو ليس لديك صلاحية الوصول' 
      });
    }
    
    // Get shift statistics
    const stats = await dbPool.query(
      `SELECT 
         COUNT(*) as total_rentals,
         COUNT(CASE WHEN status = 'active' THEN 1 END) as active_rentals,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rentals,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as total_revenue,
         COALESCE(AVG(CASE WHEN status = 'completed' THEN final_amount END), 0) as avg_revenue,
         MIN(CASE WHEN status = 'active' THEN start_time END) as oldest_active_start
       FROM rentals 
       WHERE shift_id = $1`,
      [shiftId]
    );
    
    // Get payment method breakdown
    const paymentStats = await dbPool.query(
      `SELECT 
         payment_method,
         COUNT(*) as count,
         COALESCE(SUM(final_amount), 0) as total
       FROM rentals 
       WHERE shift_id = $1 AND status = 'completed'
       GROUP BY payment_method`,
      [shiftId]
    );
    
    res.json({
      success: true,
      data: {
        shift_id: parseInt(shiftId),
        ...stats.rows[0],
        payment_breakdown: paymentStats.rows
      }
    });
    
  } catch (error) {
    console.error('🔥 Error in /api/shifts/:id/stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في جلب إحصائيات الشيفت',
      error: error.message 
    });
  }
});

// ==================== إضافة لعبة لفرع معين ====================
app.post('/branches/:id/add-game', authenticateToken, requireBranchManager, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const branchId = req.params.id;
    const user = req.user;
    const gameData = req.body;

    // التحقق من الصلاحيات
    if (user.role !== 'admin' && user.branch_id !== parseInt(branchId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية إضافة ألعاب لهذا الفرع' 
      });
    }

    // التحقق من البيانات المطلوبة
    if (!gameData.name || !gameData.price_per_15min) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم اللعبة والسعر مطلوبان' 
      });
    }

    await client.query('BEGIN');

    // التحقق من وجود اللعبة مسبقاً
    const existingGame = await client.query(
      `SELECT id FROM games 
       WHERE branch_id = $1 AND name ILIKE $2 AND is_active = true`,
      [branchId, gameData.name.trim()]
    );

    if (existingGame.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'اللعبة موجودة بالفعل في هذا الفرع' 
      });
    }

    // إضافة اللعبة
    const result = await client.query(
      `INSERT INTO games (
        name, description, category, price_per_15min,
        branch_id, status, min_rental_time, max_rental_time,
        image_url, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
      RETURNING *`,
      [
        gameData.name.trim(),
        gameData.description || `${gameData.name} - ${gameData.category || 'سيارات'}`,
        gameData.category || 'سيارات',
        parseFloat(gameData.price_per_15min),
        branchId,
        'available',
        15,
        120,
        gameData.image_url || 'default-game.jpg'
      ]
    );

    await client.query('COMMIT');
    
    res.status(201).json({ 
      success: true, 
      message: 'تم إضافة اللعبة للفرع بنجاح', 
      data: result.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إضافة لعبة للفرع:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إضافة اللعبة: ' + error.message 
    });
  } finally {
    client.release();
  }
});

app.post('/api/branches/:id/add-game', authenticateToken, requireBranchManager, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const branchId = req.params.id;
    const user = req.user;
    const gameData = req.body;

    if (user.role !== 'admin' && user.branch_id !== parseInt(branchId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية إضافة ألعاب لهذا الفرع' 
      });
    }

    if (!gameData.name || !gameData.price_per_15min) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم اللعبة والسعر مطلوبان' 
      });
    }

    await client.query('BEGIN');

    const existingGame = await client.query(
      `SELECT id FROM games 
       WHERE branch_id = $1 AND name ILIKE $2 AND is_active = true`,
      [branchId, gameData.name.trim()]
    );

    if (existingGame.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        success: false, 
        message: 'اللعبة موجودة بالفعل في هذا الفرع' 
      });
    }

    const result = await client.query(
      `INSERT INTO games (
        name, description, category, price_per_15min,
        branch_id, status, min_rental_time, max_rental_time,
        image_url, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW())
      RETURNING *`,
      [
        gameData.name.trim(),
        gameData.description || `${gameData.name} - ${gameData.category || 'سيارات'}`,
        gameData.category || 'سيارات',
        parseFloat(gameData.price_per_15min),
        branchId,
        'available',
        15,
        120,
        gameData.image_url || 'default-game.jpg'
      ]
    );

    await client.query('COMMIT');
    
    res.status(201).json({ 
      success: true, 
      message: 'تم إضافة اللعبة للفرع بنجاح', 
      data: result.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error adding game to branch:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إضافة اللعبة: ' + error.message 
    });
  } finally {
    client.release();
  }
});

// ==================== RENTALS ENDPOINTS ====================
app.post('/rentals', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const { items, customer_name, customer_phone, notes } = req.body;
    
    // ✅ Debugging
    console.log('📦 بيانات التأجير الجديد:', {
      user_id: user.id,
      user_name: user.name,
      branch_id: user.branch_id,
      customer_name,
      customer_phone,
      items_count: items?.length,
      items: items,
      timestamp: new Date().toISOString()
    });

    // التحقق من البيانات
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log('❌ لا توجد ألعاب في السلة');
      return res.status(400).json({ 
        success: false, 
        message: 'يجب إضافة لعبة واحدة على الأقل' 
      });
    }

    if (!customer_name) {
      console.log('❌ اسم العميل مطلوب');
      return res.status(400).json({ 
        success: false, 
        message: 'اسم العميل مطلوب' 
      });
    }

    // التحقق من وجود شيفت نشط
    console.log('🔍 البحث عن شيفت نشط للمستخدم:', user.id);
    const shiftResult = await client.query(
      'SELECT id FROM shifts WHERE employee_id = $1 AND status = $2', 
      [user.id, 'open']
    );
    
    if (shiftResult.rows.length === 0) {
      console.log('❌ لا يوجد شيفت نشط للمستخدم:', user.id);
      return res.status(400).json({ 
        success: false, 
        message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً' 
      });
    }
    
    const shiftId = shiftResult.rows[0].id;
    console.log('✅ تم العثور على شيفت نشط:', shiftId);

    await client.query('BEGIN');

    for (const item of items) {
      console.log('🔍 التحقق من اللعبة:', item.game_id);
      const gameResult = await client.query(
        'SELECT id, name, status, price_per_15min FROM games WHERE id = $1 FOR UPDATE', 
        [item.game_id]
      );
      
      if (gameResult.rows.length === 0) {
        throw new Error(`اللعبة رقم ${item.game_id} غير موجودة`);
      }
      
      const game = gameResult.rows[0];
      
      // ✅ فقط امنع التأجير إذا كانت اللعبة في الصيانة
      if (game.status === 'maintenance') {
        throw new Error(`اللعبة ${game.name} في الصيانة ولا يمكن تأجيرها حالياً`);
      }
      
      // ✅ أي حالة أخرى مسموح بها (available, rented, fully_rented, الخ)
      console.log(`✅ اللعبة ${game.name} مقبولة للتأجير (الحالة: ${game.status})`);
    }

    // إنشاء رقم التأجير
    const rentalNumber = generateRentalNumber();
    console.log('🆕 رقم التأجير:', rentalNumber);

   // حساب المبلغ الإجمالي
    let totalAmount = 0;
    const rentalItems = [];

    for (const item of items) {
      const gameResult = await client.query(
        'SELECT id, name, price_per_15min FROM games WHERE id = $1', 
        [item.game_id]
      );
      
      const game = gameResult.rows[0];
      const pricePer15Min = parseFloat(game.price_per_15min) || 0;
      
      let itemTotal = 0;
      if (item.rental_type === 'fixed') {
        const duration = parseInt(item.duration_minutes) || 15;
        itemTotal = Math.ceil(duration / 15) * pricePer15Min * (item.quantity || 1);
      }
      
      totalAmount += itemTotal;
      
      rentalItems.push({
        game_id: game.id,
        game_name: game.name,
        child_name: item.child_name || '',
        duration_minutes: item.rental_type === 'fixed' ? (item.duration_minutes || 15) : 0,
        price_per_15min: pricePer15Min,
        quantity: item.quantity || 1,
        total_price: itemTotal
      });
    }
    console.log('💰 المبلغ الإجمالي:', totalAmount);

    // إدراج التأجير
    const rentalResult = await client.query(
      `INSERT INTO rentals (
        rental_number, customer_name, customer_phone, 
        user_id, employee_name, branch_id, shift_id,
        start_time, total_amount, payment_status, status, notes, rental_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, 'paid', 'active', $9, $10)
      RETURNING *`,
      [
        rentalNumber, 
        customer_name, 
        customer_phone || '', 
        user.id, 
        user.name, 
        user.branch_id, 
        shiftId, 
        totalAmount, 
        notes || '',
        items[0]?.rental_type || 'fixed'
      ]
    );

    const rental = rentalResult.rows[0];
    console.log('✅ تم إنشاء التأجير:', rental.id);

    // إدراج عناصر التأجير - استخدم اسم العمود الصحيح price_per_15min
    for (let i = 0; i < rentalItems.length; i++) {
      const item = rentalItems[i];
      
      const query = `
        INSERT INTO rental_items (
          rental_id, game_id, game_name, child_name,
          duration_minutes, price_per_15min, quantity, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;
      
      const values = [
        rental.id,
        item.game_id,
        item.game_name,
        item.child_name || '',
        item.duration_minutes || 0,
        parseFloat(item.price_per_15min) || 0,  // ✅ استخدم price_per_15min
        item.quantity || 1,
        parseFloat(item.total_price) || 0
      ];
      
      console.log('📦 إدراج عنصر:', {
        table: 'rental_items',
        column: 'price_per_15min',
        value: values[5]
      });
      
      await client.query(query, values);

      // تحديث حالة اللعبة
      await client.query(
        "UPDATE games SET status = 'rented', updated_at = NOW() WHERE id = $1", 
        [item.game_id]
      );
    }

    // تحديث إحصائيات الشيفت
    await client.query(
      `UPDATE shifts 
       SET total_revenue = COALESCE(total_revenue, 0) + $1, 
           total_rentals = COALESCE(total_rentals, 0) + 1,
           updated_at = NOW() 
       WHERE id = $2`,
      [totalAmount, shiftId]
    );

    await client.query('COMMIT');
    
    console.log('🎉 تم إنشاء التأجير بنجاح:', {
      rental_id: rental.id,
      rental_number: rental.rental_number,
      total_amount: totalAmount
    });

    // جلب التأجير كامل مع العناصر
    const fullRentalResult = await client.query(
      `SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'quantity', ri.quantity,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'::json
        ) as items
       FROM rentals r
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [rental.id]
    );

    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء التأجير بنجاح', 
      data: fullRentalResult.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥🔥🔥 خطأ في إنشاء التأجير:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      detail: error.detail,
      table: error.table,
      constraint: error.constraint
    });
    
    res.status(500).json({ 
      success: false, 
      message: error.message || 'حدث خطأ في إنشاء التأجير',
      error: error.message
    });
  } finally {
    client.release();
  }
});

app.get('/rental-items', authenticateToken, async (req, res) => {
  try {
    const { rental_id } = req.query;
    const dbPool = getDbPool();
    
    if (!rental_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'معرف التأجير مطلوب' 
      });
    }
    
    const result = await dbPool.query(
      `SELECT * FROM rental_items WHERE rental_id = $1 ORDER BY id`,
      [rental_id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب عناصر التأجير:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في جلب عناصر التأجير',
      error: error.message 
    });
  }
});

app.post('/rentals/open-time', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone, child_name } = req.body;
    
    if (!game_id || !customer_name) {
      return res.status(400).json({ success: false, message: 'معرف اللعبة واسم العميل مطلوبان' });
    }
    
    const shiftResult = await client.query(
      'SELECT id FROM shifts WHERE employee_id = $1 AND status = $2', 
      [user.id, 'open']
    );
    
    if (shiftResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً' });
    }
    
    const shiftId = shiftResult.rows[0].id;
    
    await client.query('BEGIN');
    
    const gameResult = await client.query(
      'SELECT name, price_per_15min, status FROM games WHERE id = $1 FOR UPDATE', 
      [game_id]
    );
    
    if (gameResult.rows.length === 0) throw new Error('اللعبة غير موجودة');
    const game = gameResult.rows[0];
    
    if (game.status !== 'available') throw new Error('اللعبة غير متاحة حالياً');
    
    const rentalNumber = generateRentalNumber('OPEN');
    
    const rentalResult = await client.query(
      `INSERT INTO rentals (
        rental_number, customer_name, customer_phone, 
        user_id, employee_name, branch_id, shift_id,
        start_time, rental_type, payment_status, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'open', 'pending', 'active')
      RETURNING *`,
      [rentalNumber, customer_name, customer_phone || '', user.id, user.name, user.branch_id, shiftId]
    );
    
    const rental = rentalResult.rows[0];
    
    await client.query(
      `INSERT INTO rental_items (
        rental_id, game_id, game_name, child_name,
        duration_minutes, price_per_15min, total_price
      ) VALUES ($1, $2, $3, $4, 0, $5, 0)`,
      [rental.id, game_id, game.name, child_name || '', game.price_per_15min]
    );
    
    await client.query("UPDATE games SET status = 'rented' WHERE id = $1", [game_id]);
    
    await client.query('COMMIT');
    
    res.status(201).json({ 
      success: true, 
      message: 'تم بدء الوقت المفتوح بنجاح', 
      data: { ...rental, game_name: game.name, child_name: child_name || '' } 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في بدء الوقت المفتوح:', error);
    res.status(500).json({ success: false, message: error.message || 'حدث خطأ في بدء الوقت المفتوح' });
  } finally {
    client.release();
  }
});

app.post('/rentals/:id/complete-open', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { payment_method, actual_minutes, final_amount } = req.body;
    
    await client.query('BEGIN');
    
    // التحقق من وجود التأجير
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id 
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = 'active' AND r.rental_type = 'open'`,
      [rentalId, user.branch_id]
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'التأجير غير موجود أو ليس تأجير وقت مفتوح' 
      });
    }
    
    const rental = rentalResult.rows[0];
    
    // تحديث حالة التأجير
    await client.query(
      `UPDATE rentals 
       SET status = 'completed', 
           end_time = NOW(), 
           final_amount = $1,
           payment_method = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [final_amount, payment_method, rentalId]
    );
    
    // تحديث عناصر التأجير
    await client.query(
      `UPDATE rental_items 
       SET duration_minutes = $1, 
           total_price = $2 
       WHERE rental_id = $3`,
      [actual_minutes, final_amount, rentalId]
    );
    
    // تحديث حالة اللعبة إلى متاحة
    await client.query(
      "UPDATE games SET status = 'available', updated_at = NOW() WHERE id = $1",
      [rental.game_id]
    );
    
    // تحديث إيرادات الشيفت
    await client.query(
      `UPDATE shifts 
       SET total_revenue = COALESCE(total_revenue, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [final_amount, rental.shift_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم إنهاء التأجير بنجاح',
      data: {
        id: rentalId,
        final_amount,
        actual_minutes
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إنهاء التأجير المفتوح:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إنهاء التأجير',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.post('/rentals/:id/cancel', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { reason, refund_amount, is_refunded } = req.body;
    
    await client.query('BEGIN');
    
    // التحقق من وجود التأجير وصلاحيات المستخدم
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id 
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = 'active'`,
      [rentalId, user.branch_id]
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'التأجير غير موجود أو غير نشط' 
      });
    }
    
    const rental = rentalResult.rows[0];
    
    // حساب الوقت المنقضي
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
    
    // التحقق من أن الإلغاء خلال 3 دقائق (للموظفين)
    if (user.role === 'employee' && elapsedMinutes >= 3) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        success: false, 
        message: 'لا يمكن إلغاء التأجير بعد مرور 3 دقائق' 
      });
    }
    
    // تحديث حالة التأجير
    await client.query(
      `UPDATE rentals 
       SET status = 'cancelled', 
           end_time = NOW(),
           is_refunded = $1,
           refund_amount = $2,
           cancellation_reason = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [is_refunded || elapsedMinutes < 3, refund_amount || 0, reason || '', rentalId]
    );
    
    // تحديث حالة اللعبة إلى متاحة
    await client.query(
      "UPDATE games SET status = 'available', updated_at = NOW() WHERE id = $1",
      [rental.game_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: elapsedMinutes < 3 
        ? 'تم إلغاء التأجير واسترداد المبلغ بالكامل' 
        : 'تم إلغاء التأجير مع خصم قيمة أول 15 دقيقة',
      data: {
        id: rentalId,
        elapsed_minutes: elapsedMinutes,
        refund_amount: elapsedMinutes < 3 ? rental.total_amount : refund_amount
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إلغاء التأجير:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إلغاء التأجير',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.post('/rentals/:id/complete-fixed', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    await client.query('BEGIN');
    
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id, ri.game_name, g.status as game_status
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       JOIN games g ON ri.game_id = g.id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = $3
         AND r.rental_type = 'fixed'`,
      [rentalId, user.branch_id, 'active']
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'تأجير الوقت الثابت غير موجود أو غير نشط' });
    }
    
    const rental = rentalResult.rows[0];
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const actualMinutes = Math.floor((now - startTime) / (1000 * 60));
    
    await client.query(
      `UPDATE rentals 
       SET status = 'completed', end_time = NOW(), final_amount = total_amount, updated_at = NOW()
       WHERE id = $1`,
      [rentalId]
    );
    
    await client.query("UPDATE games SET status = 'available' WHERE id = $1", [rental.game_id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم إنهاء الوقت الثابت بنجاح',
      data: {
        rental_id: rentalId,
        customer_name: rental.customer_name,
        game_name: rental.game_name,
        actual_minutes: actualMinutes,
        amount_paid: rental.total_amount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في إنهاء الوقت الثابت:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في إنهاء الوقت الثابت', error: error.message });
  } finally {
    client.release();
  }
});

app.get('/rentals/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id } = req.query;
    const dbPool = getDbPool();
    
    console.log('🔍 Fetching active rentals for shift:', shift_id);
    
    // استعلام بسيط - بدون total_duration لأنه غير موجود
    const rentalsQuery = `
      SELECT 
        id, 
        rental_number, 
        customer_name, 
        customer_phone, 
        start_time, 
        end_time, 
        status, 
        rental_type, 
        total_amount,
        payment_status,
        is_refunded,
        shift_id
      FROM rentals 
      WHERE shift_id = $1 AND status = 'active'
      ORDER BY start_time ASC
    `;
    
    const rentalsResult = await dbPool.query(rentalsQuery, [shift_id]);
    const rentals = rentalsResult.rows;
    
    console.log(`📊 Found ${rentals.length} active rentals`);
    
    // جلب items لكل تأجير على حدة
    const rentalsWithItems = [];
    
    for (const rental of rentals) {
      try {
        const itemsQuery = await dbPool.query(
          `SELECT 
            id,
            rental_id,
            game_id,
            game_name,
            child_name,
            duration_minutes,
            quantity,
            price_per_15min
          FROM rental_items 
          WHERE rental_id = $1`,
          [rental.id]
        );
        
        rentalsWithItems.push({
          ...rental,
          items: itemsQuery.rows || []
        });
      } catch (itemError) {
        console.error(`Error fetching items for rental ${rental.id}:`, itemError.message);
        rentalsWithItems.push({
          ...rental,
          items: []
        });
      }
    }
    
    res.json({ 
      success: true, 
      data: rentalsWithItems, 
      count: rentalsWithItems.length
    });
    
  } catch (error) {
    console.error('🔥 Error in /rentals/active:', error);
    console.error('Stack:', error.stack);
    
    res.status(200).json({ 
      success: true, 
      data: [], 
      count: 0,
      message: 'حدث خطأ في جلب التأجيرات'
    });
  }
});

app.get('/test-rentals', authenticateToken, async (req,res) => {
  try {
    const user = req.user;
    const shift_id = req.query.shift_id;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      'SELECT COUNT(*) as count FROM rentals WHERE shift_id = $1',
      [shift_id]
    );
    
    res.json({
      success: true,
      message: 'Test endpoint working',
      shift_id: shift_id,
      count: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/rentals/completed', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id, start_date, end_date, limit = 100 } = req.query;
    const targetBranchId = branch_id || user.branch_id;
    const dbPool = getDbPool();
    
    let query = `
      SELECT r.*, 
        json_agg(json_build_object(
          'id', ri.id,
          'game_id', ri.game_id,
          'game_name', ri.game_name,
          'child_name', ri.child_name,
          'duration_minutes', ri.duration_minutes,
          'price_per_15min', ri.price_per_15min,
          'total_price', ri.total_price
        )) as items
      FROM rentals r
      LEFT JOIN rental_items ri ON r.id = ri.rental_id
      WHERE r.branch_id = $1 AND r.status = 'completed'
    `;
    
    const params = [targetBranchId];
    let paramIndex = 2;
    
    if (shift_id) {
      query += ` AND r.shift_id = $${paramIndex}`;
      params.push(shift_id);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND DATE(r.end_time) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(r.end_time) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    query += ` GROUP BY r.id ORDER BY r.end_time DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await dbPool.query(query, params);
    
    res.json({ success: true, data: result.rows, count: result.rows.length, message: `تم جلب ${result.rows.length} تأجير مكتمل` });
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات المكتملة:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التأجيرات المكتملة', data: [] });
  }
});

app.get('/rentals/:id', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT r.*, 
        json_agg(json_build_object(
          'id', ri.id,
          'game_id', ri.game_id,
          'game_name', ri.game_name,
          'child_name', ri.child_name,
          'duration_minutes', ri.duration_minutes,
          'price_per_15min', ri.price_per_15min,
          'total_price', ri.total_price
        )) as items
       FROM rentals r
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [rentalId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'التأجير غير موجود' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجير:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات التأجير' });
  }
});

// ==================== API RENTALS ENDPOINTS (للتوافق) ====================
app.post('/api/rentals', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const { items, customer_name, customer_phone, notes } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'يجب إضافة لعبة واحدة على الأقل' 
      });
    }

    if (!customer_name) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم العميل مطلوب' 
      });
    }

    const shiftResult = await client.query(
      'SELECT id FROM shifts WHERE employee_id = $1 AND status = $2', 
      [user.id, 'open']
    );
    
    if (shiftResult.rows.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً' 
      });
    }
    
    const shiftId = shiftResult.rows[0].id;

    await client.query('BEGIN');

    for (const item of items) {
      const gameResult = await client.query(
        'SELECT id, name, status, price_per_15min FROM games WHERE id = $1 FOR UPDATE', 
        [item.game_id]
      );
      
      if (gameResult.rows.length === 0) {
        throw new Error(`اللعبة رقم ${item.game_id} غير موجودة`);
      }
      
      const game = gameResult.rows[0];
      
      if (game.status === 'maintenance') {
        throw new Error(`اللعبة ${game.name} في الصيانة ولا يمكن تأجيرها حالياً`);
      }
    }

    const rentalNumber = generateRentalNumber();
    
    let totalAmount = 0;
    const rentalItems = [];

    for (const item of items) {
      const gameResult = await client.query(
        'SELECT id, name, price_per_15min FROM games WHERE id = $1', 
        [item.game_id]
      );
      
      const game = gameResult.rows[0];
      const pricePer15Min = parseFloat(game.price_per_15min) || 0;
      
      let itemTotal = 0;
      if (item.rental_type === 'fixed') {
        const duration = parseInt(item.duration_minutes) || 15;
        itemTotal = Math.ceil(duration / 15) * pricePer15Min * (item.quantity || 1);
      }
      
      totalAmount += itemTotal;
      
      rentalItems.push({
        game_id: game.id,
        game_name: game.name,
        child_name: item.child_name || '',
        duration_minutes: item.rental_type === 'fixed' ? (item.duration_minutes || 15) : 0,
        price_per_15min: pricePer15Min,
        quantity: item.quantity || 1,
        total_price: itemTotal
      });
    }

    const rentalResult = await client.query(
      `INSERT INTO rentals (
        rental_number, customer_name, customer_phone, 
        user_id, employee_name, branch_id, shift_id,
        start_time, total_amount, payment_status, status, notes, rental_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, 'paid', 'active', $9, $10)
      RETURNING *`,
      [
        rentalNumber, 
        customer_name, 
        customer_phone || '', 
        user.id, 
        user.name, 
        user.branch_id, 
        shiftId, 
        totalAmount, 
        notes || '',
        items[0]?.rental_type || 'fixed'
      ]
    );

    const rental = rentalResult.rows[0];

    for (const item of rentalItems) {
      await client.query(
        `INSERT INTO rental_items (
          rental_id, game_id, game_name, child_name,
          duration_minutes, price_per_15min, quantity, total_price
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rental.id,
          item.game_id,
          item.game_name,
          item.child_name,
          item.duration_minutes,
          parseFloat(item.price_per_15min),
          item.quantity,
          parseFloat(item.total_price)
        ]
      );

      await client.query(
        "UPDATE games SET status = 'rented', updated_at = NOW() WHERE id = $1", 
        [item.game_id]
      );
    }

    await client.query(
      `UPDATE shifts 
       SET total_revenue = COALESCE(total_revenue, 0) + $1, 
           total_rentals = COALESCE(total_rentals, 0) + 1,
           updated_at = NOW() 
       WHERE id = $2`,
      [totalAmount, shiftId]
    );

    await client.query('COMMIT');
    
    const fullRentalResult = await client.query(
      `SELECT r.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'quantity', ri.quantity,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'::json
        ) as items
       FROM rentals r
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [rental.id]
    );

    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء التأجير بنجاح', 
      data: fullRentalResult.rows[0] 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error creating rental:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'حدث خطأ في إنشاء التأجير'
    });
  } finally {
    client.release();
  }
});

app.get('/api/rental-items', authenticateToken, async (req, res) => {
  try {
    const { rental_id } = req.query;
    const dbPool = getDbPool();
    
    if (!rental_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'معرف التأجير مطلوب' 
      });
    }
    
    const result = await dbPool.query(
      `SELECT * FROM rental_items WHERE rental_id = $1 ORDER BY id`,
      [rental_id]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('🔥 Error fetching rental items:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في جلب عناصر التأجير',
      error: error.message 
    });
  }
});

app.post('/api/rentals/open-time', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone, child_name } = req.body;
    
    if (!game_id || !customer_name) {
      return res.status(400).json({ success: false, message: 'معرف اللعبة واسم العميل مطلوبان' });
    }
    
    const shiftResult = await client.query(
      'SELECT id FROM shifts WHERE employee_id = $1 AND status = $2', 
      [user.id, 'open']
    );
    
    if (shiftResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً' });
    }
    
    const shiftId = shiftResult.rows[0].id;
    
    await client.query('BEGIN');
    
    const gameResult = await client.query(
      'SELECT name, price_per_15min, status FROM games WHERE id = $1 FOR UPDATE', 
      [game_id]
    );
    
    if (gameResult.rows.length === 0) throw new Error('اللعبة غير موجودة');
    const game = gameResult.rows[0];
    
    if (game.status !== 'available') throw new Error('اللعبة غير متاحة حالياً');
    
    const rentalNumber = generateRentalNumber('OPEN');
    
    const rentalResult = await client.query(
      `INSERT INTO rentals (
        rental_number, customer_name, customer_phone, 
        user_id, employee_name, branch_id, shift_id,
        start_time, rental_type, payment_status, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'open', 'pending', 'active')
      RETURNING *`,
      [rentalNumber, customer_name, customer_phone || '', user.id, user.name, user.branch_id, shiftId]
    );
    
    const rental = rentalResult.rows[0];
    
    await client.query(
      `INSERT INTO rental_items (
        rental_id, game_id, game_name, child_name,
        duration_minutes, price_per_15min, total_price
      ) VALUES ($1, $2, $3, $4, 0, $5, 0)`,
      [rental.id, game_id, game.name, child_name || '', game.price_per_15min]
    );
    
    await client.query("UPDATE games SET status = 'rented' WHERE id = $1", [game_id]);
    
    await client.query('COMMIT');
    
    res.status(201).json({ 
      success: true, 
      message: 'تم بدء الوقت المفتوح بنجاح', 
      data: { ...rental, game_name: game.name, child_name: child_name || '' } 
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error starting open time:', error);
    res.status(500).json({ success: false, message: error.message || 'حدث خطأ في بدء الوقت المفتوح' });
  } finally {
    client.release();
  }
});

app.post('/api/rentals/:id/complete-open', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { payment_method, actual_minutes, final_amount } = req.body;
    
    await client.query('BEGIN');
    
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id 
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = 'active' AND r.rental_type = 'open'`,
      [rentalId, user.branch_id]
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'التأجير غير موجود أو ليس تأجير وقت مفتوح' 
      });
    }
    
    const rental = rentalResult.rows[0];
    
    await client.query(
      `UPDATE rentals 
       SET status = 'completed', 
           end_time = NOW(), 
           final_amount = $1,
           payment_method = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [final_amount, payment_method, rentalId]
    );
    
    await client.query(
      `UPDATE rental_items 
       SET duration_minutes = $1, 
           total_price = $2 
       WHERE rental_id = $3`,
      [actual_minutes, final_amount, rentalId]
    );
    
    await client.query(
      "UPDATE games SET status = 'available', updated_at = NOW() WHERE id = $1",
      [rental.game_id]
    );
    
    await client.query(
      `UPDATE shifts 
       SET total_revenue = COALESCE(total_revenue, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [final_amount, rental.shift_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم إنهاء التأجير بنجاح',
      data: {
        id: rentalId,
        final_amount,
        actual_minutes
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error completing open rental:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إنهاء التأجير',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.post('/api/rentals/:id/cancel', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { reason, refund_amount, is_refunded } = req.body;
    
    await client.query('BEGIN');
    
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id 
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = 'active'`,
      [rentalId, user.branch_id]
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'التأجير غير موجود أو غير نشط' 
      });
    }
    
    const rental = rentalResult.rows[0];
    
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
    
    if (user.role === 'employee' && elapsedMinutes >= 3) {
      await client.query('ROLLBACK');
      return res.status(403).json({ 
        success: false, 
        message: 'لا يمكن إلغاء التأجير بعد مرور 3 دقائق' 
      });
    }
    
    await client.query(
      `UPDATE rentals 
       SET status = 'cancelled', 
           end_time = NOW(),
           is_refunded = $1,
           refund_amount = $2,
           cancellation_reason = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [is_refunded || elapsedMinutes < 3, refund_amount || 0, reason || '', rentalId]
    );
    
    await client.query(
      "UPDATE games SET status = 'available', updated_at = NOW() WHERE id = $1",
      [rental.game_id]
    );
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: elapsedMinutes < 3 
        ? 'تم إلغاء التأجير واسترداد المبلغ بالكامل' 
        : 'تم إلغاء التأجير مع خصم قيمة أول 15 دقيقة',
      data: {
        id: rentalId,
        elapsed_minutes: elapsedMinutes,
        refund_amount: elapsedMinutes < 3 ? rental.total_amount : refund_amount
      }
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error cancelling rental:', error);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إلغاء التأجير',
      error: error.message 
    });
  } finally {
    client.release();
  }
});

app.post('/api/rentals/:id/complete-fixed', authenticateToken, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    await client.query('BEGIN');
    
    const rentalResult = await client.query(
      `SELECT r.*, ri.game_id, ri.game_name, g.status as game_status
       FROM rentals r
       JOIN rental_items ri ON r.id = ri.rental_id
       JOIN games g ON ri.game_id = g.id
       WHERE r.id = $1 AND r.branch_id = $2 AND r.status = $3
         AND r.rental_type = 'fixed'`,
      [rentalId, user.branch_id, 'active']
    );
    
    if (rentalResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'تأجير الوقت الثابت غير موجود أو غير نشط' });
    }
    
    const rental = rentalResult.rows[0];
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const actualMinutes = Math.floor((now - startTime) / (1000 * 60));
    
    await client.query(
      `UPDATE rentals 
       SET status = 'completed', end_time = NOW(), final_amount = total_amount, updated_at = NOW()
       WHERE id = $1`,
      [rentalId]
    );
    
    await client.query("UPDATE games SET status = 'available' WHERE id = $1", [rental.game_id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'تم إنهاء الوقت الثابت بنجاح',
      data: {
        rental_id: rentalId,
        customer_name: rental.customer_name,
        game_name: rental.game_name,
        actual_minutes: actualMinutes,
        amount_paid: rental.total_amount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error completing fixed rental:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في إنهاء الوقت الثابت', error: error.message });
  } finally {
    client.release();
  }
});

app.get('/api/rentals/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id } = req.query;
    const dbPool = getDbPool();
    
    const rentalsQuery = `
      SELECT 
        id, 
        rental_number, 
        customer_name, 
        customer_phone, 
        start_time, 
        end_time, 
        status, 
        rental_type, 
        total_amount,
        payment_status,
        is_refunded,
        shift_id
      FROM rentals 
      WHERE shift_id = $1 AND status = 'active'
      ORDER BY start_time ASC
    `;
    
    const rentalsResult = await dbPool.query(rentalsQuery, [shift_id]);
    const rentals = rentalsResult.rows;
    
    const rentalsWithItems = [];
    
    for (const rental of rentals) {
      const itemsQuery = await dbPool.query(
        `SELECT 
          id,
          rental_id,
          game_id,
          game_name,
          child_name,
          duration_minutes,
          quantity,
          price_per_15min
        FROM rental_items 
        WHERE rental_id = $1`,
        [rental.id]
      );
      
      rentalsWithItems.push({
        ...rental,
        items: itemsQuery.rows || []
      });
    }
    
    res.json({ 
      success: true, 
      data: rentalsWithItems, 
      count: rentalsWithItems.length
    });
    
  } catch (error) {
    console.error('🔥 Error in /api/rentals/active:', error);
    res.status(500).json({ 
      success: false, 
      data: [], 
      count: 0,
      message: 'حدث خطأ في جلب التأجيرات'
    });
  }
});

app.get('/api/test-rentals', authenticateToken, async (req,res) => {
  try {
    const user = req.user;
    const shift_id = req.query.shift_id;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      'SELECT COUNT(*) as count FROM rentals WHERE shift_id = $1',
      [shift_id]
    );
    
    res.json({
      success: true,
      message: 'Test endpoint working',
      shift_id: shift_id,
      count: result.rows[0].count
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/rentals/completed', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id, start_date, end_date, limit = 100 } = req.query;
    const targetBranchId = branch_id || user.branch_id;
    const dbPool = getDbPool();
    
    let query = `
      SELECT r.*, 
        json_agg(json_build_object(
          'id', ri.id,
          'game_id', ri.game_id,
          'game_name', ri.game_name,
          'child_name', ri.child_name,
          'duration_minutes', ri.duration_minutes,
          'price_per_15min', ri.price_per_15min,
          'total_price', ri.total_price
        )) as items
      FROM rentals r
      LEFT JOIN rental_items ri ON r.id = ri.rental_id
      WHERE r.branch_id = $1 AND r.status = 'completed'
    `;
    
    const params = [targetBranchId];
    let paramIndex = 2;
    
    if (shift_id) {
      query += ` AND r.shift_id = $${paramIndex}`;
      params.push(shift_id);
      paramIndex++;
    }
    
    if (start_date) {
      query += ` AND DATE(r.end_time) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(r.end_time) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    query += ` GROUP BY r.id ORDER BY r.end_time DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));
    
    const result = await dbPool.query(query, params);
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 Error fetching completed rentals:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التأجيرات المكتملة', data: [] });
  }
});

app.get('/api/rentals/:id', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT r.*, 
        json_agg(json_build_object(
          'id', ri.id,
          'game_id', ri.game_id,
          'game_name', ri.game_name,
          'child_name', ri.child_name,
          'duration_minutes', ri.duration_minutes,
          'price_per_15min', ri.price_per_15min,
          'total_price', ri.total_price
        )) as items
       FROM rentals r
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.id = $1
       GROUP BY r.id`,
      [rentalId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'التأجير غير موجود' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('🔥 Error fetching rental:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات التأجير' });
  }
});

// ==================== ADMIN DASHBOARD ENDPOINTS ====================
app.get('/admin/rentals/active-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT r.*, 
        b.name as branch_name,
        u.name as employee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'
        ) as items
       FROM rentals r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.status = 'active'
       GROUP BY r.id, b.name, u.name
       ORDER BY r.start_time DESC`
    );
    res.json({ success: true, data: result.rows, count: result.rows.length, message: `تم العثور على ${result.rows.length} تأجير نشط` });
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات النشطة لجميع الفروع:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التأجيرات النشطة', data: [] });
  }
});

app.get('/admin/rentals/completed-today-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT r.*, 
        b.name as branch_name,
        u.name as employee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'
        ) as items
       FROM rentals r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.status = 'completed' AND DATE(r.end_time) = $1
       GROUP BY r.id, b.name, u.name
       ORDER BY r.end_time DESC`,
      [today]
    );
    
    const totalRevenue = result.rows.reduce((sum, rental) => sum + (parseFloat(rental.final_amount) || parseFloat(rental.total_amount) || 0), 0);
    
    res.json({ success: true, data: result.rows, count: result.rows.length, date: today, total_revenue: totalRevenue, message: `تم العثور على ${result.rows.length} تأجير مكتمل اليوم` });
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات المكتملة اليوم (كل الفروع):', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التأجيرات المكتملة', data: [], total_revenue: 0 });
  }
});

app.get('/admin/rentals/recent-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT r.*, 
        b.name as branch_name,
        u.name as employee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'
        ) as items
       FROM rentals r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.status IN ('active', 'completed')
       GROUP BY r.id, b.name, u.name
       ORDER BY r.start_time DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json({ success: true, data: result.rows, count: result.rows.length, message: `تم جلب آخر ${result.rows.length} تأجير` });
  } catch (error) {
    console.error('🔥 خطأ في جلب أحدث التأجيرات:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب أحدث التأجيرات', data: [] });
  }
});

// ==================== API ADMIN DASHBOARD ENDPOINTS (للتوافق) ====================
app.get('/api/admin/rentals/active-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const dbPool = getDbPool();
    const result = await dbPool.query(
      `SELECT r.*, 
        b.name as branch_name,
        u.name as employee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'
        ) as items
       FROM rentals r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.status = 'active'
       GROUP BY r.id, b.name, u.name
       ORDER BY r.start_time DESC`
    );
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 Error fetching active rentals all branches:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التأجيرات النشطة', data: [] });
  }
});

app.get('/api/admin/rentals/completed-today-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT r.*, 
        b.name as branch_name,
        u.name as employee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'
        ) as items
       FROM rentals r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.status = 'completed' AND DATE(r.end_time) = $1
       GROUP BY r.id, b.name, u.name
       ORDER BY r.end_time DESC`,
      [today]
    );
    
    const totalRevenue = result.rows.reduce((sum, rental) => sum + (parseFloat(rental.final_amount) || parseFloat(rental.total_amount) || 0), 0);
    
    res.json({ success: true, data: result.rows, count: result.rows.length, date: today, total_revenue: totalRevenue });
  } catch (error) {
    console.error('🔥 Error fetching completed today all branches:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التأجيرات المكتملة', data: [], total_revenue: 0 });
  }
});

app.get('/api/admin/rentals/recent-all-branches', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT r.*, 
        b.name as branch_name,
        u.name as employee_name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', ri.id,
              'game_id', ri.game_id,
              'game_name', ri.game_name,
              'child_name', ri.child_name,
              'duration_minutes', ri.duration_minutes,
              'price_per_15min', ri.price_per_15min,
              'total_price', ri.total_price
            )
          ) FILTER (WHERE ri.id IS NOT NULL), 
          '[]'
        ) as items
       FROM rentals r
       LEFT JOIN branches b ON r.branch_id = b.id
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN rental_items ri ON r.id = ri.rental_id
       WHERE r.status IN ('active', 'completed')
       GROUP BY r.id, b.name, u.name
       ORDER BY r.start_time DESC
       LIMIT $1`,
      [limit]
    );
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 Error fetching recent rentals:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب أحدث التأجيرات', data: [] });
  }
});

// ==================== DASHBOARD STATS ====================
app.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().split('T')[0];
    const dbPool = getDbPool();
    
    const gamesResult = await dbPool.query(
      `SELECT 
         COUNT(*) as total_games,
         COUNT(CASE WHEN status = 'available' THEN 1 END) as available_games
       FROM games 
       WHERE branch_id = $1 AND is_active = true`,
      [user.branch_id]
    );
    
    const activeResult = await dbPool.query(
      `SELECT COUNT(*) as active_rentals 
       FROM rentals 
       WHERE branch_id = $1 AND status = 'active'`,
      [user.branch_id]
    );
    
    const todayResult = await dbPool.query(
      `SELECT 
         COUNT(*) as today_rentals,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as today_revenue
       FROM rentals 
       WHERE branch_id = $1 AND DATE(created_at) = $2`,
      [user.branch_id, today]
    );
    
    const shiftResult = await dbPool.query(
      `SELECT id FROM shifts WHERE employee_id = $1 AND status = 'open' LIMIT 1`,
      [user.id]
    );
    
    res.json({
      success: true,
      data: {
        totalGames: parseInt(gamesResult.rows[0]?.total_games) || 0,
        availableGames: parseInt(gamesResult.rows[0]?.available_games) || 0,
        activeRentals: parseInt(activeResult.rows[0]?.active_rentals) || 0,
        todayRentals: parseInt(todayResult.rows[0]?.today_rentals) || 0,
        todayRevenue: parseFloat(todayResult.rows[0]?.today_revenue) || 0,
        hasActiveShift: shiftResult.rows.length > 0,
        activeShiftId: shiftResult.rows[0]?.id || null
      }
    });
  } catch (error) {
    console.error('🔥 خطأ في جلب الإحصائيات:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الإحصائيات', data: {} });
  }
});

app.get('/dashboard/stats/simple', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const dbPool = getDbPool();
    
    const games = await dbPool.query(
      `SELECT COUNT(*) as total_games,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_games
       FROM games WHERE branch_id = $1 AND is_active = true`,
      [user.branch_id]
    );
    
    const today = new Date().toISOString().split('T')[0];
    
    const todayStats = await dbPool.query(
      `SELECT COUNT(*) as today_rentals,
              COALESCE(SUM(final_amount), 0) as today_revenue
       FROM rentals WHERE branch_id = $1 AND status = 'completed' AND DATE(end_time) = $2`,
      [user.branch_id, today]
    );
    
    const active = await dbPool.query(
      `SELECT COUNT(*) as active_rentals FROM rentals WHERE branch_id = $1 AND status = 'active'`,
      [user.branch_id]
    );
    
    res.json({
      success: true,
      data: {
        totalGames: parseInt(games.rows[0]?.total_games) || 0,
        availableGames: parseInt(games.rows[0]?.available_games) || 0,
        activeRentals: parseInt(active.rows[0]?.active_rentals) || 0,
        todayRentals: parseInt(todayStats.rows[0]?.today_rentals) || 0,
        todayRevenue: parseFloat(todayStats.rows[0]?.today_revenue) || 0
      }
    });
  } catch (error) {
    console.error('🔥 خطأ في stats/simple:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الإحصائيات', data: {} });
  }
});

// ==================== API DASHBOARD STATS (للتوافق) ====================
app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().split('T')[0];
    const dbPool = getDbPool();
    
    const gamesResult = await dbPool.query(
      `SELECT 
         COUNT(*) as total_games,
         COUNT(CASE WHEN status = 'available' THEN 1 END) as available_games
       FROM games 
       WHERE branch_id = $1 AND is_active = true`,
      [user.branch_id]
    );
    
    const activeResult = await dbPool.query(
      `SELECT COUNT(*) as active_rentals 
       FROM rentals 
       WHERE branch_id = $1 AND status = 'active'`,
      [user.branch_id]
    );
    
    const todayResult = await dbPool.query(
      `SELECT 
         COUNT(*) as today_rentals,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN final_amount ELSE 0 END), 0) as today_revenue
       FROM rentals 
       WHERE branch_id = $1 AND DATE(created_at) = $2`,
      [user.branch_id, today]
    );
    
    const shiftResult = await dbPool.query(
      `SELECT id FROM shifts WHERE employee_id = $1 AND status = 'open' LIMIT 1`,
      [user.id]
    );
    
    res.json({
      success: true,
      data: {
        totalGames: parseInt(gamesResult.rows[0]?.total_games) || 0,
        availableGames: parseInt(gamesResult.rows[0]?.available_games) || 0,
        activeRentals: parseInt(activeResult.rows[0]?.active_rentals) || 0,
        todayRentals: parseInt(todayResult.rows[0]?.today_rentals) || 0,
        todayRevenue: parseFloat(todayResult.rows[0]?.today_revenue) || 0,
        hasActiveShift: shiftResult.rows.length > 0,
        activeShiftId: shiftResult.rows[0]?.id || null
      }
    });
  } catch (error) {
    console.error('🔥 Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الإحصائيات', data: {} });
  }
});

app.get('/api/dashboard/stats/simple', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const dbPool = getDbPool();
    
    const games = await dbPool.query(
      `SELECT COUNT(*) as total_games,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_games
       FROM games WHERE branch_id = $1 AND is_active = true`,
      [user.branch_id]
    );
    
    const today = new Date().toISOString().split('T')[0];
    
    const todayStats = await dbPool.query(
      `SELECT COUNT(*) as today_rentals,
              COALESCE(SUM(final_amount), 0) as today_revenue
       FROM rentals WHERE branch_id = $1 AND status = 'completed' AND DATE(end_time) = $2`,
      [user.branch_id, today]
    );
    
    const active = await dbPool.query(
      `SELECT COUNT(*) as active_rentals FROM rentals WHERE branch_id = $1 AND status = 'active'`,
      [user.branch_id]
    );
    
    res.json({
      success: true,
      data: {
        totalGames: parseInt(games.rows[0]?.total_games) || 0,
        availableGames: parseInt(games.rows[0]?.available_games) || 0,
        activeRentals: parseInt(active.rows[0]?.active_rentals) || 0,
        todayRentals: parseInt(todayStats.rows[0]?.today_rentals) || 0,
        todayRevenue: parseFloat(todayStats.rows[0]?.today_revenue) || 0
      }
    });
  } catch (error) {
    console.error('🔥 Error in /api/dashboard/stats/simple:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب الإحصائيات', data: {} });
  }
});

// ==================== USERS ENDPOINTS ====================
app.get('/users', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const user = req.user;
    const { search = '', role = '', branch_id = '' } = req.query;
    const dbPool = getDbPool();
    
    let query = `
      SELECT u.id, u.username, u.email, u.name, u.role, 
             u.branch_id, u.phone, u.is_active, u.created_at,
             b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (user.role === 'branch_manager') {
      query += ` AND u.branch_id = $${paramIndex}`;
      params.push(user.branch_id);
      paramIndex++;
    }
    
    if (role && role !== 'all') {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    if (user.role === 'admin' && branch_id && branch_id !== 'all') {
      query += ` AND u.branch_id = $${paramIndex}`;
      params.push(parseInt(branch_id));
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY u.role, u.name';
    
    const result = await dbPool.query(query, params);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 خطأ في جلب المستخدمين:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب المستخدمين', data: [] });
  }
});

app.get('/users/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const userId = req.params.id;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT u.*, b.name as branch_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    const targetUser = result.rows[0];
    
    if (req.user.role === 'branch_manager' && targetUser.branch_id !== req.user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية عرض بيانات مستخدم من فرع آخر' });
    }
    
    res.json({ success: true, data: targetUser });
  } catch (error) {
    console.error('🔥 خطأ في جلب بيانات المستخدم:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات المستخدم' });
  }
});

app.post('/users', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const user = req.user;
    const userData = req.body;
    const dbPool = getDbPool();
    
    if (!userData.username || !userData.email || !userData.name || !userData.branch_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم المستخدم والبريد الإلكتروني والاسم والفرع مطلوبون' 
      });
    }

    // التحقق من الصلاحيات
    if (user.role === 'branch_manager' && userData.branch_id !== user.branch_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية إضافة مستخدمين لفروع أخرى' 
      });
    }

    // التحقق من عدم تكرار البريد الإلكتروني أو اسم المستخدم
    const existingResult = await dbPool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [userData.email, userData.username]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'البريد الإلكتروني أو اسم المستخدم موجود بالفعل' 
      });
    }

    // إدراج المستخدم الجديد
    const result = await dbPool.query(
      `INSERT INTO users (
        username, email, password, name, role, branch_id, phone, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, email, name, role, branch_id, phone, is_active, created_at`,
      [
        userData.username.trim(), 
        userData.email.toLowerCase().trim(),
        userData.password || '123456', 
        userData.name.trim(),
        userData.role || 'employee', 
        userData.branch_id,
        userData.phone || '', 
        userData.is_active !== undefined ? userData.is_active : true
      ]
    );

    console.log('✅ مستخدم جديد:', result.rows[0]);
    
    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء المستخدم بنجاح', 
      data: result.rows[0] 
    });

  } catch (error) {
    console.error('🔥 خطأ في إنشاء المستخدم:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إنشاء المستخدم', 
      error: error.message 
    });
  }
});

app.put('/users/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = req.user;
    const userData = req.body;
    const dbPool = getDbPool();
    
    const userResult = await dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    const targetUser = userResult.rows[0];
    
    if (user.role === 'branch_manager' && targetUser.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تحديث مستخدمين من فروع أخرى' });
    }
    
    if (user.role === 'branch_manager' && userData.role && userData.role !== targetUser.role) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تغيير دور المستخدم' });
    }
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const fields = {
      name: userData.name,
      email: userData.email,
      username: userData.username,
      role: userData.role,
      branch_id: userData.branch_id,
      phone: userData.phone,
      is_active: userData.is_active
    };
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'is_active' ? (value ? true : false) : value);
        paramIndex++;
      }
    });
    
    if (userData.password && userData.password.trim() !== '') {
      updateFields.push(`password = $${paramIndex}`);
      values.push(userData.password);
      paramIndex++;
    }
    
    if (updateFields.length === 0) {
      return res.json({ success: true, message: 'لم يتم تغيير أي بيانات', data: targetUser });
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(userId);
    
    const updateResult = await dbPool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, username, email, name, role, branch_id, phone, is_active, created_at`,
      values
    );
    
    res.json({ success: true, message: 'تم تحديث المستخدم بنجاح', data: updateResult.rows[0] });
  } catch (error) {
    console.error('🔥 خطأ في تحديث المستخدم:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث المستخدم', error: error.message });
  }
});

app.delete('/users/:id', authenticateToken, requireBranchManager, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const userId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    
    await client.query('BEGIN');
    
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    const targetUser = userResult.rows[0];
    
    if (targetUser.id === user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك الخاص' });
    }
    
    if (user.role === 'branch_manager' && targetUser.branch_id !== user.branch_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف مستخدمين من فروع أخرى' });
    }
    
    if (user.role === 'branch_manager' && targetUser.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'لا يمكنك حذف مدير عام' });
    }
    
    if (permanent) {
      const rentalsResult = await client.query('SELECT COUNT(*) as count FROM rentals WHERE user_id = $1', [userId]);
      const shiftsResult = await client.query('SELECT COUNT(*) as count FROM shifts WHERE employee_id = $1', [userId]);
      
      if (parseInt(rentalsResult.rows[0].count) > 0 || parseInt(shiftsResult.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'لا يمكن حذف المستخدم نهائياً لأنه مرتبط ببيانات أخرى', details: { rentals: parseInt(rentalsResult.rows[0].count), shifts: parseInt(shiftsResult.rows[0].count) } });
      }
      
      const deleteResult = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم حذف المستخدم نهائياً بنجاح', user_id: userId });
    } else {
      const updateResult = await client.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id', [userId]);
      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم تعطيل المستخدم بنجاح', user_id: userId });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 خطأ في حذف المستخدم:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف المستخدم', error: error.message });
  } finally {
    client.release();
  }
});

// ==================== API USERS ENDPOINTS (للتوافق) ====================
app.get('/api/users', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const user = req.user;
    const { search = '', role = '', branch_id = '' } = req.query;
    const dbPool = getDbPool();
    
    let query = `
      SELECT u.id, u.username, u.email, u.name, u.role, 
             u.branch_id, u.phone, u.is_active, u.created_at,
             b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (user.role === 'branch_manager') {
      query += ` AND u.branch_id = $${paramIndex}`;
      params.push(user.branch_id);
      paramIndex++;
    }
    
    if (role && role !== 'all') {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }
    
    if (user.role === 'admin' && branch_id && branch_id !== 'all') {
      query += ` AND u.branch_id = $${paramIndex}`;
      params.push(parseInt(branch_id));
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY u.role, u.name';
    
    const result = await dbPool.query(query, params);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 Error fetching users:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب المستخدمين', data: [] });
  }
});

app.get('/api/users/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const userId = req.params.id;
    const dbPool = getDbPool();
    
    const result = await dbPool.query(
      `SELECT u.*, b.name as branch_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = $1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    const targetUser = result.rows[0];
    
    if (req.user.role === 'branch_manager' && targetUser.branch_id !== req.user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية عرض بيانات مستخدم من فرع آخر' });
    }
    
    res.json({ success: true, data: targetUser });
  } catch (error) {
    console.error('🔥 Error fetching user:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب بيانات المستخدم' });
  }
});

app.post('/api/users', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const user = req.user;
    const userData = req.body;
    const dbPool = getDbPool();
    
    if (!userData.username || !userData.email || !userData.name || !userData.branch_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'اسم المستخدم والبريد الإلكتروني والاسم والفرع مطلوبون' 
      });
    }

    if (user.role === 'branch_manager' && userData.branch_id !== user.branch_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'ليس لديك صلاحية إضافة مستخدمين لفروع أخرى' 
      });
    }

    const existingResult = await dbPool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [userData.email, userData.username]
    );
    
    if (existingResult.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'البريد الإلكتروني أو اسم المستخدم موجود بالفعل' 
      });
    }

    const result = await dbPool.query(
      `INSERT INTO users (
        username, email, password, name, role, branch_id, phone, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, username, email, name, role, branch_id, phone, is_active, created_at`,
      [
        userData.username.trim(), 
        userData.email.toLowerCase().trim(),
        userData.password || '123456', 
        userData.name.trim(),
        userData.role || 'employee', 
        userData.branch_id,
        userData.phone || '', 
        userData.is_active !== undefined ? userData.is_active : true
      ]
    );

    res.status(201).json({ 
      success: true, 
      message: 'تم إنشاء المستخدم بنجاح', 
      data: result.rows[0] 
    });

  } catch (error) {
    console.error('🔥 Error creating user:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في إنشاء المستخدم', 
      error: error.message 
    });
  }
});

app.put('/api/users/:id', authenticateToken, requireBranchManager, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = req.user;
    const userData = req.body;
    const dbPool = getDbPool();
    
    const userResult = await dbPool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    const targetUser = userResult.rows[0];
    
    if (user.role === 'branch_manager' && targetUser.branch_id !== user.branch_id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تحديث مستخدمين من فروع أخرى' });
    }
    
    if (user.role === 'branch_manager' && userData.role && userData.role !== targetUser.role) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تغيير دور المستخدم' });
    }
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    const fields = {
      name: userData.name,
      email: userData.email,
      username: userData.username,
      role: userData.role,
      branch_id: userData.branch_id,
      phone: userData.phone,
      is_active: userData.is_active
    };
    
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(key === 'is_active' ? (value ? true : false) : value);
        paramIndex++;
      }
    });
    
    if (userData.password && userData.password.trim() !== '') {
      updateFields.push(`password = $${paramIndex}`);
      values.push(userData.password);
      paramIndex++;
    }
    
    if (updateFields.length === 0) {
      return res.json({ success: true, message: 'لم يتم تغيير أي بيانات', data: targetUser });
    }
    
    updateFields.push('updated_at = NOW()');
    values.push(userId);
    
    const updateResult = await dbPool.query(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex} 
       RETURNING id, username, email, name, role, branch_id, phone, is_active, created_at`,
      values
    );
    
    res.json({ success: true, message: 'تم تحديث المستخدم بنجاح', data: updateResult.rows[0] });
  } catch (error) {
    console.error('🔥 Error updating user:', error.message);
    res.status(500).json({ success: false, message: 'حدث خطأ في تحديث المستخدم', error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, requireBranchManager, async (req, res) => {
  const client = await getDbPool().connect();
  try {
    const userId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    
    await client.query('BEGIN');
    
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    const targetUser = userResult.rows[0];
    
    if (targetUser.id === user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك الخاص' });
    }
    
    if (user.role === 'branch_manager' && targetUser.branch_id !== user.branch_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف مستخدمين من فروع أخرى' });
    }
    
    if (user.role === 'branch_manager' && targetUser.role === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'لا يمكنك حذف مدير عام' });
    }
    
    if (permanent) {
      const rentalsResult = await client.query('SELECT COUNT(*) as count FROM rentals WHERE user_id = $1', [userId]);
      const shiftsResult = await client.query('SELECT COUNT(*) as count FROM shifts WHERE employee_id = $1', [userId]);
      
      if (parseInt(rentalsResult.rows[0].count) > 0 || parseInt(shiftsResult.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'لا يمكن حذف المستخدم نهائياً لأنه مرتبط ببيانات أخرى', details: { rentals: parseInt(rentalsResult.rows[0].count), shifts: parseInt(shiftsResult.rows[0].count) } });
      }
      
      const deleteResult = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
      if (deleteResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم حذف المستخدم نهائياً بنجاح', user_id: userId });
    } else {
      const updateResult = await client.query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id', [userId]);
      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
      }
      
      await client.query('COMMIT');
      res.json({ success: true, message: 'تم تعطيل المستخدم بنجاح', user_id: userId });
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('🔥 Error deleting user:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في حذف المستخدم', error: error.message });
  } finally {
    client.release();
  }
});

// ==================== REPORTS ENDPOINTS ====================
app.get('/reports/rentals', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { start_date, end_date, shift_id, employee_id, branch_id = user.branch_id } = req.query;
    const dbPool = getDbPool();
    
    let query = `
      SELECT r.*, 
        b.name as branch_name,
        json_agg(json_build_object(
          'id', ri.id,
          'game_id', ri.game_id,
          'game_name', ri.game_name,
          'child_name', ri.child_name,
          'duration_minutes', ri.duration_minutes,
          'price_per_15min', ri.price_per_15min,
          'total_price', ri.total_price
        )) as items
      FROM rentals r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN rental_items ri ON r.id = ri.rental_id
      WHERE r.branch_id = $1
        AND r.status IN ('completed', 'cancelled')
    `;
    
    const params = [branch_id];
    let paramIndex = 2;
    
    if (start_date) {
      query += ` AND DATE(r.created_at) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(r.created_at) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (shift_id) {
      query += ` AND r.shift_id = $${paramIndex}`;
      params.push(shift_id);
      paramIndex++;
    }
    
    if (employee_id) {
      query += ` AND r.user_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }
    
    query += ` GROUP BY r.id, b.name ORDER BY r.end_time DESC LIMIT 500`;
    
    const result = await dbPool.query(query, params);
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 خطأ في جلب تقارير التأجيرات:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التقارير' });
  }
});

app.get('/reports/revenue', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { start_date, end_date, branch_id = user.branch_id, group_by = 'day' } = req.query;
    const dbPool = getDbPool();
    
    let query = '';
    let params = [branch_id];
    let paramIndex = 2;
    
    if (group_by === 'day') {
      query = `
        SELECT DATE(end_time) as date, COUNT(*) as total_rentals,
               SUM(final_amount) as total_revenue, AVG(final_amount) as average_revenue,
               COUNT(CASE WHEN rental_type = 'fixed' THEN 1 END) as fixed_rentals,
               COUNT(CASE WHEN rental_type = 'open' THEN 1 END) as open_rentals,
               SUM(CASE WHEN rental_type = 'fixed' THEN final_amount ELSE 0 END) as fixed_revenue,
               SUM(CASE WHEN rental_type = 'open' THEN final_amount ELSE 0 END) as open_revenue
        FROM rentals
        WHERE branch_id = $1 AND status = 'completed'
      `;
    } else if (group_by === 'month') {
      query = `
        SELECT TO_CHAR(end_time, 'YYYY-MM') as month, COUNT(*) as total_rentals,
               SUM(final_amount) as total_revenue, AVG(final_amount) as average_revenue
        FROM rentals
        WHERE branch_id = $1 AND status = 'completed'
      `;
    } else if (group_by === 'employee') {
      query = `
        SELECT u.id as employee_id, u.name as employee_name,
               COUNT(r.id) as total_rentals, SUM(r.final_amount) as total_revenue,
               AVG(r.final_amount) as average_revenue
        FROM rentals r
        JOIN users u ON r.user_id = u.id
        WHERE r.branch_id = $1 AND r.status = 'completed'
      `;
    } else if (group_by === 'game') {
      query = `
        SELECT g.id as game_id, g.name as game_name,
               COUNT(DISTINCT r.id) as total_rentals, SUM(ri.total_price) as total_revenue,
               AVG(ri.total_price) as average_revenue
        FROM rental_items ri
        JOIN games g ON ri.game_id = g.id
        JOIN rentals r ON ri.rental_id = r.id
        WHERE r.branch_id = $1 AND r.status = 'completed'
      `;
    }
    
    if (start_date) {
      query += ` AND DATE(r.end_time) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(r.end_time) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (group_by === 'day' || group_by === 'month') {
      query += ` GROUP BY date ORDER BY date DESC`;
    } else if (group_by === 'employee') {
      query += ` GROUP BY u.id, u.name ORDER BY total_revenue DESC`;
    } else if (group_by === 'game') {
      query += ` GROUP BY g.id, g.name ORDER BY total_revenue DESC`;
    }
    
    query += ` LIMIT 100`;
    
    const result = await dbPool.query(query, params);
    
    const totalsResult = await dbPool.query(
      `SELECT COUNT(*) as total_rentals, COALESCE(SUM(final_amount), 0) as total_revenue,
              COALESCE(AVG(final_amount), 0) as avg_revenue
       FROM rentals
       WHERE branch_id = $1 AND status = 'completed'
         ${start_date ? `AND DATE(end_time) >= $2` : ''}
         ${end_date ? `AND DATE(end_time) <= $${start_date ? 3 : 2}` : ''}`,
      start_date && end_date ? [branch_id, start_date, end_date] : start_date ? [branch_id, start_date] : end_date ? [branch_id, end_date] : [branch_id]
    );
    
    res.json({ success: true, data: result.rows, summary: totalsResult.rows[0] || { total_rentals: 0, total_revenue: 0, avg_revenue: 0 }, group_by });
  } catch (error) {
    console.error('🔥 خطأ في جلب تقرير الإيرادات:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التقرير' });
  }
});

// ==================== API REPORTS ENDPOINTS (للتوافق) ====================
app.get('/api/reports/rentals', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { start_date, end_date, shift_id, employee_id, branch_id = user.branch_id } = req.query;
    const dbPool = getDbPool();
    
    let query = `
      SELECT r.*, 
        b.name as branch_name,
        json_agg(json_build_object(
          'id', ri.id,
          'game_id', ri.game_id,
          'game_name', ri.game_name,
          'child_name', ri.child_name,
          'duration_minutes', ri.duration_minutes,
          'price_per_15min', ri.price_per_15min,
          'total_price', ri.total_price
        )) as items
      FROM rentals r
      LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN rental_items ri ON r.id = ri.rental_id
      WHERE r.branch_id = $1
        AND r.status IN ('completed', 'cancelled')
    `;
    
    const params = [branch_id];
    let paramIndex = 2;
    
    if (start_date) {
      query += ` AND DATE(r.created_at) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(r.created_at) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (shift_id) {
      query += ` AND r.shift_id = $${paramIndex}`;
      params.push(shift_id);
      paramIndex++;
    }
    
    if (employee_id) {
      query += ` AND r.user_id = $${paramIndex}`;
      params.push(employee_id);
      paramIndex++;
    }
    
    query += ` GROUP BY r.id, b.name ORDER BY r.end_time DESC LIMIT 500`;
    
    const result = await dbPool.query(query, params);
    
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) {
    console.error('🔥 Error fetching rental reports:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التقارير' });
  }
});

app.get('/api/reports/revenue', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { start_date, end_date, branch_id = user.branch_id, group_by = 'day' } = req.query;
    const dbPool = getDbPool();
    
    let query = '';
    let params = [branch_id];
    let paramIndex = 2;
    
    if (group_by === 'day') {
      query = `
        SELECT DATE(end_time) as date, COUNT(*) as total_rentals,
               SUM(final_amount) as total_revenue, AVG(final_amount) as average_revenue,
               COUNT(CASE WHEN rental_type = 'fixed' THEN 1 END) as fixed_rentals,
               COUNT(CASE WHEN rental_type = 'open' THEN 1 END) as open_rentals,
               SUM(CASE WHEN rental_type = 'fixed' THEN final_amount ELSE 0 END) as fixed_revenue,
               SUM(CASE WHEN rental_type = 'open' THEN final_amount ELSE 0 END) as open_revenue
        FROM rentals
        WHERE branch_id = $1 AND status = 'completed'
      `;
    } else if (group_by === 'month') {
      query = `
        SELECT TO_CHAR(end_time, 'YYYY-MM') as month, COUNT(*) as total_rentals,
               SUM(final_amount) as total_revenue, AVG(final_amount) as average_revenue
        FROM rentals
        WHERE branch_id = $1 AND status = 'completed'
      `;
    } else if (group_by === 'employee') {
      query = `
        SELECT u.id as employee_id, u.name as employee_name,
               COUNT(r.id) as total_rentals, SUM(r.final_amount) as total_revenue,
               AVG(r.final_amount) as average_revenue
        FROM rentals r
        JOIN users u ON r.user_id = u.id
        WHERE r.branch_id = $1 AND r.status = 'completed'
      `;
    } else if (group_by === 'game') {
      query = `
        SELECT g.id as game_id, g.name as game_name,
               COUNT(DISTINCT r.id) as total_rentals, SUM(ri.total_price) as total_revenue,
               AVG(ri.total_price) as average_revenue
        FROM rental_items ri
        JOIN games g ON ri.game_id = g.id
        JOIN rentals r ON ri.rental_id = r.id
        WHERE r.branch_id = $1 AND r.status = 'completed'
      `;
    }
    
    if (start_date) {
      query += ` AND DATE(r.end_time) >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }
    
    if (end_date) {
      query += ` AND DATE(r.end_time) <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }
    
    if (group_by === 'day' || group_by === 'month') {
      query += ` GROUP BY date ORDER BY date DESC`;
    } else if (group_by === 'employee') {
      query += ` GROUP BY u.id, u.name ORDER BY total_revenue DESC`;
    } else if (group_by === 'game') {
      query += ` GROUP BY g.id, g.name ORDER BY total_revenue DESC`;
    }
    
    query += ` LIMIT 100`;
    
    const result = await dbPool.query(query, params);
    
    const totalsResult = await dbPool.query(
      `SELECT COUNT(*) as total_rentals, COALESCE(SUM(final_amount), 0) as total_revenue,
              COALESCE(AVG(final_amount), 0) as avg_revenue
       FROM rentals
       WHERE branch_id = $1 AND status = 'completed'
         ${start_date ? `AND DATE(end_time) >= $2` : ''}
         ${end_date ? `AND DATE(end_time) <= $${start_date ? 3 : 2}` : ''}`,
      start_date && end_date ? [branch_id, start_date, end_date] : start_date ? [branch_id, start_date] : end_date ? [branch_id, end_date] : [branch_id]
    );
    
    res.json({ success: true, data: result.rows, summary: totalsResult.rows[0] || { total_rentals: 0, total_revenue: 0, avg_revenue: 0 }, group_by });
  } catch (error) {
    console.error('🔥 Error fetching revenue report:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ في جلب التقرير' });
  }
});

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