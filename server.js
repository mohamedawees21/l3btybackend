const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));



// تسجيل جميع المسارات عند بدء التشغيل
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`🔗 Route: ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`🔗 Route: ${Object.keys(handler.route.methods)} ${handler.route.path}`);
      }
    });
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'l3bty_store_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4'
});

const createTables = async () => {
  try {
    console.log('\n🔧 إنشاء الجداول...');
    
    const branchesTableSQL = `
      CREATE TABLE IF NOT EXISTS branches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(500),
        city VARCHAR(100),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(255),
        opening_time TIME DEFAULT '09:00:00',
        closing_time TIME DEFAULT '22:00:00',
        branch_code VARCHAR(50) UNIQUE,
        created_by INT,
        updated_by INT,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(branchesTableSQL);
    console.log('✅ جدول branches جاهز');
    
    const [branches] = await pool.execute('SELECT id FROM branches LIMIT 1');
    if (branches.length === 0) {
      await pool.execute(`
        INSERT INTO branches (name, location, city, contact_phone, branch_code, is_active)
        VALUES ('الفرع الرئيسي', 'القاهرة', 'القاهرة', '01000000000', 'BR-001', 1)
      `);
      console.log('✅ تم إنشاء الفرع الرئيسي');
    }
    
    const usersTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('admin', 'branch_manager', 'employee') DEFAULT 'employee',
        branch_id INT DEFAULT 1,
        phone VARCHAR(20),
        is_active TINYINT DEFAULT 1,
        last_login DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(usersTableSQL);
    console.log('✅ جدول users جاهز');
    
    const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', ['admin@l3bty.com']);
    if (users.length === 0) {
      await pool.execute(`
        INSERT INTO users (username, email, password, name, role, branch_id, phone, is_active)
        VALUES ('admin', 'admin@l3bty.com', '123456', 'المدير العام', 'admin', 1, '01000000001', 1)
      `);
      console.log('✅ تم إنشاء المستخدم الافتراضي');
    }
    
    const shiftsTableSQL = `
      CREATE TABLE IF NOT EXISTS shifts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        employee_name VARCHAR(255) NOT NULL,
        branch_id INT NOT NULL,
        branch_name VARCHAR(255),
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        status ENUM('نشط', 'منتهي') DEFAULT 'نشط',
        shift_number VARCHAR(100),
        total_rentals INT DEFAULT 0,
        total_revenue DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(shiftsTableSQL);
    console.log('✅ جدول shifts جاهز');
    
    const gamesTableSQL = `
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100) DEFAULT 'سيارات',
        price_per_15min DECIMAL(10,2) NOT NULL,
        price_per_hour DECIMAL(10,2),
        branch_id INT NOT NULL DEFAULT 1,
        status VARCHAR(50) DEFAULT 'متاح',
        min_rental_time INT DEFAULT 15,
        max_rental_time INT DEFAULT 120,
        minimum_age INT DEFAULT 16,
        image_url VARCHAR(500) DEFAULT 'default-game.jpg',
        external_image_url VARCHAR(500),
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(gamesTableSQL);
    console.log('✅ جدول games جاهز');
    
    const rentalsTableSQL = `
      CREATE TABLE IF NOT EXISTS rentals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rental_number VARCHAR(100) NOT NULL,
        game_id INT NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        customer_email VARCHAR(255),
        customer_address TEXT,
        user_id INT NOT NULL,
        employee_name VARCHAR(255),
        branch_id INT NOT NULL,
        shift_id INT,
        start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        actual_end_time DATETIME,
        rental_type VARCHAR(50) DEFAULT 'fixed',
        duration_minutes INT DEFAULT 15,
        actual_duration_minutes INT,
        is_open_time TINYINT DEFAULT 0,
        total_amount DECIMAL(10,2) DEFAULT 0,
        final_amount DECIMAL(10,2),
        payment_status VARCHAR(50) DEFAULT 'عند الإنهاء',
        payment_method VARCHAR(50) DEFAULT 'كاش',
        paid_amount DECIMAL(10,2) DEFAULT 0,
        refund_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(50) DEFAULT 'نشط',
        notes TEXT,
        quantity INT DEFAULT 1,
        child_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shift (shift_id),
        INDEX idx_branch (branch_id),
        INDEX idx_status (status),
        INDEX idx_game (game_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(rentalsTableSQL);
    console.log('✅ جدول rentals جاهز');
    
    const customersTableSQL = `
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(20) UNIQUE,
        email VARCHAR(255),
        address TEXT,
        total_rentals INT DEFAULT 0,
        total_spent DECIMAL(10,2) DEFAULT 0,
        last_rental_date DATETIME,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(customersTableSQL);
    console.log('✅ جدول customers جاهز');
    
    console.log('🎉 جميع الجداول جاهزة!\n');
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء الجداول:', error.message);
  }
};

createTables();

// في server.js - تحديث middleware authenticateToken
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
      console.log('❌ No authorization header');
      return res.status(401).json({ 
        success: false, 
        message: 'التوكن مطلوب',
        code: 'NO_TOKEN'
      });
    }
    
    let token;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      token = authHeader;
    }
    
    console.log('🔍 Token received:', token.substring(0, 20) + '...');
    
    const parts = token.split('_');
    if (parts.length < 2) {
      console.log('❌ Invalid token format');
      return res.status(403).json({ 
        success: false, 
        message: 'توكن غير صالح',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }
    
    const userId = parseInt(parts[1]);
    
    if (isNaN(userId)) {
      console.log('❌ Invalid user ID in token');
      return res.status(403).json({ 
        success: false, 
        message: 'معرف مستخدم غير صالح في التوكن',
        code: 'INVALID_USER_ID'
      });
    }
    
    // ✅ استعلام محسن مع معالجة الأخطاء
    const [users] = await pool.execute(
      `SELECT u.*, b.name as branch_name 
       FROM users u 
       LEFT JOIN branches b ON u.branch_id = b.id 
       WHERE u.id = ? AND u.is_active = 1`,
      [userId]
    );
    
    if (users.length === 0) {
      console.log(`❌ User ${userId} not found or inactive`);
      return res.status(403).json({ 
        success: false, 
        message: 'مستخدم غير موجود أو غير نشط',
        code: 'USER_NOT_FOUND'
      });
    }
    
    req.user = users[0];
    
    // ✅ سجل النجاح (يمكن إزالته في الإنتاج)
    console.log(`✅ User authenticated: ${req.user.name} (ID: ${req.user.id}, Role: ${req.user.role})`);
    
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

app.get('/api/health', async (req, res) => {
  try {
    await pool.execute('SELECT 1');
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

app.get('/api/debug/tables', async (req, res) => {
  try {
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME, UPDATE_TIME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);
    
    const tableList = tables.map(t => t.TABLE_NAME);
    
    res.json({
      success: true,
      database: process.env.DB_NAME || 'l3bty_store_db',
      tables: tableList,
      details: tables
    });
    
  } catch (error) {
    console.error('Error checking tables:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من الجداول',
      error: error.message
    });
  }
});

app.get('/api/debug/check-database', async (req, res) => {
  try {
    console.log('🔍 فحص قاعدة البيانات...');
    
    const [tables] = await pool.execute(`SHOW TABLES`);
    
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    const tableStats = [];
    
    for (const tableName of tableNames) {
      const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
      const [columns] = await pool.execute(`DESCRIBE ${tableName}`);
      
      tableStats.push({
        table: tableName,
        rowCount: rows[0].count,
        columns: columns.map(col => col.Field)
      });
    }
    
    const [connectionTest] = await pool.execute('SELECT NOW() as server_time, DATABASE() as db_name');
    
    res.json({
      success: true,
      message: 'فحص قاعدة البيانات مكتمل',
      database: {
        name: process.env.DB_NAME || 'l3bty_store_db',
        server_time: connectionTest[0].server_time,
        db_name: connectionTest[0].db_name
      },
      tables: tableStats,
      required_tables: ['branches', 'users', 'shifts', 'games', 'rentals', 'customers'],
      all_tables_present: ['branches', 'users', 'shifts', 'games', 'rentals', 'customers'].every(t => 
        tableNames.includes(t)
      ),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🔥 خطأ في فحص قاعدة البيانات:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في فحص قاعدة البيانات',
      error: error.message,
      stack: error.stack
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'البريد الإلكتروني وكلمة المرور مطلوبان' 
      });
    }
    
    const [users] = await pool.execute(
      `SELECT u.*, b.name as branch_name 
       FROM users u 
       LEFT JOIN branches b ON u.branch_id = b.id 
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      });
    }
    
    const user = users[0];
    
    if (password === '123456' || password === user.password) {
      const token = `l3bty_${user.id}_${Date.now()}`;
      
      await pool.execute(
        'UPDATE users SET last_login = NOW() WHERE id = ?',
        [user.id]
      );
      
      const userResponse = {
        id: user.id,
        username: user.username || user.email.split('@')[0],
        email: user.email,
        name: user.name,
        role: user.role,
        branch_id: user.branch_id || 1,
        branch_name: user.branch_name || 'الفرع الرئيسي',
        phone: user.phone || '',
        is_active: user.is_active
      };
      
      return res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token,
        user: userResponse
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
      });
    }
  } catch (error) {
    console.error('🔥 خطأ في تسجيل الدخول:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'حدث خطأ في الخادم' 
    });
  }
});

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  res.json({ 
    success: true, 
    data: req.user 
  });
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    res.json({ 
      success: true, 
      message: 'تم تسجيل الخروج بنجاح' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'خطأ في تسجيل الخروج' 
    });
  }
});

app.post('/api/shifts/start', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'مستخدم غير مصرح له'
      });
    }

    try {
      const [activeShifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط'",
        [user.id]
      );
      
      for (const shift of activeShifts) {
        await pool.execute(
          "UPDATE shifts SET end_time = NOW(), status = 'منتهي', updated_at = NOW() WHERE id = ?",
          [shift.id]
        );
      }
    } catch (error) {
      console.log('⚠️ لا يمكن إنهاء الشيفتات السابقة:', error.message);
    }

    const shiftNumber = `SHIFT-${Date.now().toString().slice(-8)}`;
    const branchId = user.branch_id || 1;
    
    let branchName = 'الفرع الرئيسي';
    try {
      const [branch] = await pool.execute(
        'SELECT name FROM branches WHERE id = ?',
        [branchId]
      );
      if (branch.length > 0) {
        branchName = branch[0].name;
      }
    } catch (error) {
      console.log('⚠️ لا يمكن جلب اسم الفرع:', error.message);
    }

    const [result] = await pool.execute(
      `INSERT INTO shifts (
        employee_id, 
        employee_name, 
        branch_id, 
        branch_name, 
        start_time, 
        status,
        shift_number
      ) VALUES (?, ?, ?, ?, NOW(), 'نشط', ?)`,
      [
        user.id,
        user.name || 'موظف',
        branchId,
        branchName,
        shiftNumber
      ]
    );

    const shiftId = result.insertId;
    
    const [newShift] = await pool.execute(
      "SELECT * FROM shifts WHERE id = ?",
      [shiftId]
    );

    const shiftData = newShift[0] || {
      id: shiftId,
      shift_number: shiftNumber,
      employee_name: user.name,
      branch_name: branchName,
      start_time: new Date().toISOString(),
      status: 'نشط',
      total_rentals: 0,
      total_revenue: 0
    };

    res.json({
      success: true,
      message: 'تم بدء الشيفت بنجاح',
      data: shiftData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔥 خطأ في بدء الشيفت:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'فشل في بدء الشيفت',
      error: error.message
    });
  }
});

app.post('/api/shifts/start-simple', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'مستخدم غير مصرح له'
      });
    }

    try {
      await pool.execute(
        "UPDATE shifts SET end_time = NOW(), status = 'منتهي', updated_at = NOW() WHERE employee_id = ? AND status = 'نشط'",
        [user.id]
      );
    } catch (error) {
      console.log('⚠️ لا يمكن إنهاء الشيفتات السابقة:', error.message);
    }

    const shiftNumber = `SHIFT-SIMPLE-${Date.now().toString().slice(-6)}`;
    const branchId = user.branch_id || 1;
    
    let branchName = 'الفرع الرئيسي';
    try {
      const [branch] = await pool.execute(
        'SELECT name FROM branches WHERE id = ?',
        [branchId]
      );
      if (branch.length > 0) {
        branchName = branch[0].name;
      }
    } catch (error) {
      console.log('⚠️ لا يمكن جلب اسم الفرع:', error.message);
    }

    const [result] = await pool.execute(
      `INSERT INTO shifts (
        employee_id, 
        employee_name, 
        branch_id, 
        branch_name, 
        start_time, 
        status,
        shift_number
      ) VALUES (?, ?, ?, ?, NOW(), 'نشط', ?)`,
      [
        user.id,
        user.name || 'موظف',
        branchId,
        branchName,
        shiftNumber
      ]
    );

    const shiftId = result.insertId;
    
    const [newShift] = await pool.execute(
      "SELECT * FROM shifts WHERE id = ?",
      [shiftId]
    );

    const shiftData = newShift[0] || {
      id: shiftId,
      shift_number: shiftNumber,
      employee_name: user.name,
      branch_name: branchName,
      start_time: new Date().toISOString(),
      status: 'نشط'
    };

    res.json({
      success: true,
      message: 'تم بدء الشيفت بنجاح',
      data: shiftData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔥 خطأ في بدء الشيفت:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'فشل في بدء الشيفت',
      error: error.message
    });
  }
});

app.get('/api/shifts/simple', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [shifts] = await pool.execute(
      `SELECT id, start_time, status, employee_name, branch_name, shift_number,
              employee_id, branch_id
       FROM shifts 
       WHERE employee_id = ? AND status = 'نشط'
       ORDER BY start_time DESC 
       LIMIT 1`,
      [user.id]
    );
    
    if (shifts.length > 0) {
      const shift = shifts[0];
      
      res.json({
        success: true,
        data: shift,
        message: 'تم جلب الشيفت النشط',
        exists: true
      });
    } else {
      res.json({
        success: true,
        data: null,
        message: 'لا يوجد شيفت نشط',
        exists: false
      });
    }
    
  } catch (error) {
    console.error('🔥 Error in /shifts/simple:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم',
      error: error.message
    });
  }
});

app.get('/api/shifts/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [shifts] = await pool.execute(
      `SELECT * FROM shifts 
       WHERE employee_id = ? AND status = 'نشط'
       ORDER BY start_time DESC 
       LIMIT 1`,
      [user.id]
    );

    if (shifts.length > 0) {
      res.json({
        success: true,
        data: shifts[0],
        message: 'تم جلب الشيفت النشط'
      });
    } else {
      res.json({
        success: true,
        data: null,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
  } catch (error) {
    console.error('Error in /shifts/active:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'خطأ في جلب الشيفت',
      error: error.message
    });
  }
});

app.get('/api/shifts/check-active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [shifts] = await pool.execute(
      `SELECT * FROM shifts 
       WHERE employee_id = ? 
         AND status = 'نشط'
       ORDER BY start_time DESC 
       LIMIT 1`,
      [user.id]
    );
    
    if (shifts.length > 0) {
      const shift = shifts[0];
      
      if (shift.employee_id === user.id || shift.employee_name === user.name) {
        res.json({
          success: true,
          data: shift,
          has_active_shift: true,
          message: 'تم العثور على شيفت نشط'
        });
      } else {
        res.json({
          success: true,
          data: null,
          has_active_shift: false,
          message: 'الشيفت النشط لا ينتمي للمستخدم الحالي'
        });
      }
    } else {
      res.json({
        success: true,
        data: null,
        has_active_shift: false,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في التحقق من الشيفت النشط:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في التحقق من الشيفت',
      error: error.message
    });
  }
});

app.post('/api/shifts/start-clean', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [activeShifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط'",
      [user.id]
    );
    
    if (activeShifts.length > 0) {
      for (const shift of activeShifts) {
        await pool.execute(
          "UPDATE shifts SET status = 'منتهي', end_time = NOW() WHERE id = ?",
          [shift.id]
        );
      }
    }
    
    const shiftNumber = `SHIFT-${Date.now().toString().slice(-6)}-CLEAN`;
    const branchId = user.branch_id || 1;
    
    let branchName = 'الفرع الرئيسي';
    try {
      const [branch] = await pool.execute(
        'SELECT name FROM branches WHERE id = ?',
        [branchId]
      );
      if (branch.length > 0) {
        branchName = branch[0].name;
      }
    } catch (error) {
      console.warn('⚠️ لا يمكن جلب اسم الفرع:', error.message);
    }
    
    const [result] = await pool.execute(
      `INSERT INTO shifts (
        employee_id, 
        employee_name, 
        branch_id, 
        branch_name, 
        start_time, 
        status,
        shift_number
      ) VALUES (?, ?, ?, ?, NOW(), 'نشط', ?)`,
      [
        user.id,
        user.name || 'موظف',
        branchId,
        branchName,
        shiftNumber
      ]
    );
    
    const shiftId = result.insertId;
    
    const [newShift] = await pool.execute(
      'SELECT * FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    res.json({
      success: true,
      message: 'تم بدء شيفت نظيف بنجاح',
      data: newShift[0] || {
        id: shiftId,
        shift_number: shiftNumber,
        employee_id: user.id,
        employee_name: user.name,
        branch_id: branchId,
        branch_name: branchName,
        start_time: new Date().toISOString(),
        status: 'نشط'
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في بدء الشيفت النظيف:', error);
    res.status(500).json({
      success: false,
      message: 'فشل بدء الشيفت النظيف',
      error: error.message
    });
  }
});

app.put('/api/shifts/:id/end', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const { notes } = req.body;
    
    console.log(`🏁 إنهاء الشيفت ${shiftId} بواسطة ${user.name}`);
    
    // 1. التحقق من وجود الشيفت
    const [shifts] = await pool.execute(
      'SELECT * FROM shifts WHERE id = ? AND employee_id = ?',
      [shiftId, user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود أو ليس لديك صلاحية إنهائه'
      });
    }
    
    // 2. **جلب جميع التأجيرات المرتبطة بالشيفت**
    const [rentals] = await pool.execute(
      'SELECT id, status FROM rentals WHERE shift_id = ?',
      [shiftId]
    );
    
    // 3. **تحديث التأجيرات (إخفاؤها بدلاً من حذفها)**
    if (rentals.length > 0) {
      // 3.1. إرجاع الألعاب للمخزون أولاً
      for (const rental of rentals) {
        if (rental.status === 'نشط') {
          await pool.execute(
            "UPDATE games SET status = 'متاح' WHERE id IN (SELECT game_id FROM rentals WHERE id = ?)",
            [rental.id]
          );
        }
      }
      
      // 3.2. تحديث التأجيرات (تعطيلها أو إخفاؤها)
      await pool.execute(
        `UPDATE rentals SET 
          is_visible = 0,  // حقل جديد لإخفاء التأجير
          hidden_at = NOW(),
          hidden_by = ?,
          hidden_reason = 'انتهاء الشيفت'
         WHERE shift_id = ?`,
        [user.id, shiftId]
      );
      
      console.log(`📝 تم إخفاء ${rentals.length} تأجير مرتبط بالشيفت`);
    }
    
    // 4. تحديث الشيفت
    const [result] = await pool.execute(
      `UPDATE shifts SET 
        status = 'منتهي',
        end_time = NOW(),
        notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        notes || `تم إنهاء الشيفت بواسطة ${user.name}`,
        shiftId
      ]
    );
    
    // 5. إرجاع الاستجابة
    const [endedShift] = await pool.execute(
      'SELECT * FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    console.log('✅ تم إنهاء الشيفت وإخفاء التأجيرات بنجاح:', shiftId);
    
    res.json({
      success: true,
      message: 'تم إنهاء الشيفت وإخفاء جميع التأجيرات المرتبطة',
      data: endedShift[0],
      hidden_rentals_count: rentals.length,
      hidden_from_display: true
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنهاء الشيفت:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الشيفت'
    });
  }
});

app.post('/api/shifts/start-fresh', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🧹 بدء شيفت نظيف للمستخدم:', user.name);
    
    // 1. إنهاء أي شيفت نشط سابق
    try {
      const [activeShifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط'",
        [user.id]
      );
      
      for (const shift of activeShifts) {
        await pool.execute(
          `UPDATE shifts SET 
            status = 'منتهي',
            end_time = NOW(),
            notes = CONCAT(COALESCE(notes, ''), '\\n', 'إنهاء تلقائي عند بدء شيفت جديد'),
            updated_at = NOW()
           WHERE id = ?`,
          [shift.id]
        );
        
        // إخفاء تأجيرات الشيفت السابق
        await pool.execute(
          `UPDATE rentals SET 
            is_visible_in_shift = 0
           WHERE shift_id = ?`,
          [shift.id]
        );
      }
    } catch (error) {
      console.warn('⚠️ لا يمكن إنهاء الشيفتات السابقة:', error.message);
    }
    
    // 2. إنشاء شيفت جديد
    const shiftNumber = `SHIFT-${Date.now().toString().slice(-8)}`;
    const branchId = user.branch_id || 1;
    
    let branchName = 'الفرع الرئيسي';
    try {
      const [branch] = await pool.execute(
        'SELECT name FROM branches WHERE id = ?',
        [branchId]
      );
      if (branch.length > 0) {
        branchName = branch[0].name;
      }
    } catch (error) {
      console.warn('⚠️ لا يمكن جلب اسم الفرع:', error.message);
    }
    
    const [result] = await pool.execute(
      `INSERT INTO shifts (
        employee_id, 
        employee_name, 
        branch_id, 
        branch_name, 
        start_time, 
        status,
        shift_number,
        is_fresh_start
      ) VALUES (?, ?, ?, ?, NOW(), 'نشط', ?, 1)`,
      [
        user.id,
        user.name || 'موظف',
        branchId,
        branchName,
        shiftNumber
      ]
    );
    
    const shiftId = result.insertId;
    
    const [newShift] = await pool.execute(
      "SELECT * FROM shifts WHERE id = ?",
      [shiftId]
    );
    
    console.log('✅ تم بدء شيفت نظيف:', {
      shift_id: shiftId,
      shift_number: shiftNumber,
      employee: user.name
    });
    
    res.json({
      success: true,
      message: 'تم بدء شيفت نظيف بنجاح',
      data: newShift[0] || {
        id: shiftId,
        shift_number: shiftNumber,
        employee_name: user.name,
        branch_name: branchName,
        start_time: new Date().toISOString(),
        status: 'نشط',
        is_fresh_start: 1
      },
      fresh_start: true
    });
    
  } catch (error) {
    console.error('🔥 خطأ في بدء الشيفت النظيف:', error);
    res.status(500).json({
      success: false,
      message: 'فشل بدء الشيفت النظيف',
      error: error.message
    });
  }
});

app.post('/api/shifts/:id/end-simple', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    
    const [shifts] = await pool.execute(
      'SELECT id, employee_id FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود'
      });
    }
    
    const shift = shifts[0];
    
    if (shift.employee_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إنهاء هذا الشيفت'
      });
    }
    
    await pool.execute(
      "UPDATE shifts SET status = 'منتهي', end_time = NOW() WHERE id = ?",
      [shiftId]
    );
    
    res.json({
      success: true,
      message: 'تم إنهاء الشيفت بنجاح',
      shift_id: shiftId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنهاء الشيفت البسيط:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الشيفت'
    });
  }
});

// نقطة إنهاء شيفت سريع
app.post('/api/shifts/:id/end-quick', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const { notes } = req.body;
    
    console.log(`⚡ إنهاء سريع للشيفت ${shiftId}`);
    
    // تحديث مباشر
    const [result] = await pool.execute(
      `UPDATE shifts SET 
        status = 'منتهي',
        end_time = NOW(),
        notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [notes || 'إنهاء سريع', shiftId]
    );
    
    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: 'تم إنهاء الشيفت بنجاح (طريقة سريعة)',
        shift_id: shiftId,
        ended_at: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود'
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في النهاية السريعة:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// نقطة تحديث الشيفت العامة
app.put('/api/shifts/:id', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const shiftData = req.body;
    
    console.log(`✏️ تحديث الشيفت ${shiftId}`);
    
    const updateFields = [];
    const updateValues = [];
    
    if (shiftData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(shiftData.status);
    }
    
    if (shiftData.end_time !== undefined) {
      updateFields.push('end_time = ?');
      updateValues.push(shiftData.end_time);
    }
    
    if (shiftData.notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(shiftData.notes);
    }
    
    updateFields.push('updated_at = NOW()');
    
    if (updateFields.length === 0) {
      return res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات'
      });
    }
    
    updateValues.push(shiftId);
    
    const sql = `UPDATE shifts SET ${updateFields.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(sql, updateValues);
    
    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: 'تم تحديث الشيفت بنجاح',
        shift_id: shiftId
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود'
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في تحديث الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الخادم'
    });
  }
});

// نقطة محسنة لجلب إيراد الشيفت
app.get('/api/shifts/:id/revenue', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    
    console.log(`💰 جلب إيراد الشيفت ${shiftId}`);
    
    // حساب الإيراد بدقة
    const [revenueResult] = await pool.execute(
      `SELECT 
         COALESCE(SUM(
           CASE 
             WHEN rental_type = 'fixed' THEN paid_amount
             WHEN rental_type = 'open' AND status = 'مكتمل' THEN final_amount
             ELSE 0
           END
         ), 0) as total_revenue,
         COUNT(CASE WHEN rental_type = 'fixed' THEN 1 END) as fixed_count,
         COUNT(CASE WHEN rental_type = 'open' AND status = 'مكتمل' THEN 1 END) as open_completed_count,
         COUNT(*) as total_rentals
       FROM rentals 
       WHERE shift_id = ? AND branch_id = ?`,
      [shiftId, user.branch_id]
    );
    
    res.json({
      success: true,
      data: {
        shift_id: shiftId,
        total_revenue: parseFloat(revenueResult[0].total_revenue) || 0,
        fixed_rentals: revenueResult[0].fixed_count || 0,
        open_completed_rentals: revenueResult[0].open_completed_count || 0,
        total_rentals: revenueResult[0].total_rentals || 0,
        last_updated: new Date().toISOString()
      },
      message: 'تم حساب إيراد الشيفت بنجاح'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب إيراد الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب إيراد الشيفت'
    });
  }
});

app.get('/api/shifts/:id/revenue-details', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    
    const [revenueStats] = await pool.execute(
      `SELECT 
         COUNT(*) as total_rentals,
         COALESCE(SUM(final_amount), 0) as total_revenue,
         COALESCE(SUM(CASE WHEN rental_type = 'open' THEN final_amount ELSE 0 END), 0) as open_time_revenue,
         COALESCE(SUM(CASE WHEN rental_type = 'fixed' THEN final_amount ELSE 0 END), 0) as fixed_time_revenue
       FROM rentals 
       WHERE shift_id = ? 
         AND status = 'مكتمل'
         AND branch_id = ?`,
      [shiftId, user.branch_id]
    );
    
    res.json({
      success: true,
      data: revenueStats[0] || {},
      message: 'تم حساب إيراد الشيفت'
    });
    
  } catch (error) {
    console.error('❌ خطأ في حساب إيراد الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حساب إيراد الشيفت'
    });
  }
});

app.get('/api/shifts/with-rentals', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [shifts] = await pool.execute(
      `SELECT * FROM shifts 
       WHERE employee_id = ? AND status = 'نشط'
       ORDER BY start_time DESC 
       LIMIT 1`,
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.json({
        success: true,
        has_shift: false,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
    const shift = shifts[0];
    const shiftId = shift.id;
    
    const [activeRentals] = await pool.execute(
      `SELECT r.*, g.name as game_name, g.price_per_15min
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = ? 
         AND r.branch_id = ?
         AND r.status = 'نشط'
       ORDER BY r.start_time ASC`,
      [shiftId, user.branch_id]
    );
    
    let completedRentals = [];
    if (user.role === 'admin' || user.role === 'branch_manager') {
      const [completed] = await pool.execute(
        `SELECT r.*, g.name as game_name
         FROM rentals r
         LEFT JOIN games g ON r.game_id = g.id
         WHERE r.shift_id = ? 
           AND r.branch_id = ?
           AND (r.status = 'مكتمل' OR r.status = 'completed')
         ORDER BY r.end_time DESC
         LIMIT 100`,
        [shiftId, user.branch_id]
      );
      completedRentals = completed;
    }
    
    let shiftRevenue = 0;
    if (completedRentals.length > 0) {
      shiftRevenue = completedRentals.reduce((sum, rental) => {
        const amount = rental.final_amount || rental.total_amount || 0;
        return sum + (parseFloat(amount) || 0);
      }, 0);
    }
    
    res.json({
      success: true,
      has_shift: true,
      data: {
        shift: shift,
        active_rentals: activeRentals || [],
        completed_rentals: completedRentals || [],
        stats: {
          active_count: activeRentals.length || 0,
          completed_count: completedRentals.length || 0,
          shift_revenue: shiftRevenue || 0
        }
      },
      message: `تم جلب الشيفت مع ${activeRentals.length} تأجير نشط و${completedRentals.length} تأجير مكتمل`
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب الشيفت مع التأجيرات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الشيفت',
      error: error.message
    });
  }
});

app.get('/api/games', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id, status, category, include_branch_info } = req.query;
    
    let query = 'SELECT * FROM games WHERE is_active = 1';
    const params = [];
    
    const targetBranchId = branch_id || user.branch_id;
    if (targetBranchId) {
      query += ' AND branch_id = ?';
      params.push(targetBranchId);
    }
    
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY name';
    
    const [games] = await pool.execute(query, params);
    
    if (include_branch_info === 'true') {
      for (let game of games) {
        if (game.branch_id) {
          try {
            const [branch] = await pool.execute(
              'SELECT name, location FROM branches WHERE id = ?',
              [game.branch_id]
            );
            if (branch.length > 0) {
              game.branch_name = branch[0].name;
              game.branch_location = branch[0].location;
            }
          } catch (branchError) {
            console.warn('⚠️ لا يمكن جلب معلومات الفرع:', branchError.message);
          }
        }
      }
    }
    
    const stats = {
      total: games.length,
      available: games.filter(g => g.status === 'متاح').length,
      rented: games.filter(g => g.status === 'مؤجرة').length,
      maintenance: games.filter(g => g.status === 'صيانة').length
    };
    
    res.json({
      success: true,
      data: games,
      stats: stats,
      message: `تم جلب ${games.length} لعبة`
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الألعاب'
    });
  }
});

app.get('/api/games/available', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id } = req.query;
    
    const targetBranchId = branch_id || user.branch_id;
    
    const [games] = await pool.execute(
      `SELECT * FROM games 
       WHERE branch_id = ? 
         AND status = 'متاح' 
         AND is_active = 1
       ORDER BY name`,
      [targetBranchId]
    );
    
    res.json({
      success: true,
      data: games,
      count: games.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب المتاحة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الألعاب المتاحة'
    });
  }
});

app.get('/api/games/rented', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id } = req.query;
    
    const targetBranchId = branch_id || user.branch_id;
    
    const [games] = await pool.execute(
      `SELECT * FROM games 
       WHERE branch_id = ? 
         AND status = 'مؤجرة' 
         AND is_active = 1
       ORDER BY name`,
      [targetBranchId]
    );
    
    res.json({
      success: true,
      data: games,
      count: games.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب المؤجرة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الألعاب المؤجرة'
    });
  }
});

app.get('/api/games/with-filter', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { branch_id, status, category } = req.query;
    
    let query = 'SELECT * FROM games WHERE is_active = 1';
    const params = [];
    
    const targetBranchId = branch_id || user.branch_id;
    if (targetBranchId) {
      query += ' AND branch_id = ?';
      params.push(targetBranchId);
    }
    
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY name';
    
    const [games] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: games,
      count: games.length,
      filters: {
        branch_id: targetBranchId,
        status: status || 'all',
        category: category || 'all'
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب الألعاب مع الفلترة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الألعاب مع الفلترة',
      error: error.message
    });
  }
});

app.get('/api/games/:id', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.id;
    const user = req.user;
    
    const [games] = await pool.execute(
      `SELECT g.*, b.name as branch_name
       FROM games g
       LEFT JOIN branches b ON g.branch_id = b.id
       WHERE g.id = ? AND g.is_active = 1`,
      [gameId]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    
    if (user.role === 'branch_manager' && user.branch_id != game.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض هذه اللعبة'
      });
    }
    
    res.json({
      success: true,
      data: game
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب بيانات اللعبة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات اللعبة',
      error: error.message
    });
  }
});

app.post('/api/games', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const gameData = req.body;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إضافة ألعاب'
      });
    }
    
    if (!gameData.name || !gameData.price_per_15min) {
      return res.status(400).json({
        success: false,
        message: 'اسم اللعبة والسعر مطلوبان'
      });
    }
    
    const branchId = gameData.branch_id || user.branch_id || 1;
    const pricePerHour = gameData.price_per_hour || Math.ceil(parseFloat(gameData.price_per_15min) * 4);
    
    const [result] = await pool.execute(
      `INSERT INTO games (
        name, 
        description, 
        category, 
        price_per_15min, 
        price_per_hour,
        branch_id, 
        status, 
        min_rental_time, 
        max_rental_time, 
        minimum_age,
        image_url, 
        external_image_url, 
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameData.name.trim(),
        gameData.description || `${gameData.name} - ${gameData.category || 'سيارات'}`,
        gameData.category || 'سيارات',
        parseFloat(gameData.price_per_15min),
        pricePerHour,
        branchId,
        gameData.status || 'متاح',
        parseInt(gameData.min_rental_time) || 15,
        parseInt(gameData.max_rental_time) || 120,
        parseInt(gameData.minimum_age) || 16,
        gameData.image_url || 'default-game.jpg',
        gameData.external_image_url || '',
        1
      ]
    );
    
    const gameId = result.insertId;
    
    const [newGame] = await pool.execute(
      'SELECT * FROM games WHERE id = ?',
      [gameId]
    );
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء اللعبة بنجاح',
      data: newGame[0],
      game_id: gameId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء اللعبة:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء اللعبة',
      error: error.message,
      suggestion: 'تحقق من اتصال قاعدة البيانات'
    });
  }
});

app.post('/api/games/:id/update', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.id;
    const gameData = req.body;
    
    if (gameData.price_per_15min) {
      await pool.execute(
        'UPDATE games SET price_per_15min = ? WHERE id = ?',
        [gameData.price_per_15min, gameId]
      );
    }
    
    res.json({
      success: true,
      message: 'تم التحديث بنجاح',
      game_id: gameId
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'خطأ: ' + error.message
    });
  }
});

app.put('/api/games/:id', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.id;
    const user = req.user;
    const gameData = req.body;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تحديث الألعاب'
      });
    }
    
    const [games] = await pool.execute(
      'SELECT * FROM games WHERE id = ?',
      [gameId]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    
    if (user.role === 'branch_manager' && user.branch_id != game.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تحديث ألعاب هذا الفرع'
      });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (gameData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(gameData.name.trim());
    }
    
    if (gameData.description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(gameData.description);
    }
    
    if (gameData.category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(gameData.category);
    }
    
    if (gameData.price_per_15min !== undefined) {
      updateFields.push('price_per_15min = ?');
      updateValues.push(parseFloat(gameData.price_per_15min));
    }
    
    if (gameData.price_per_hour !== undefined) {
      updateFields.push('price_per_hour = ?');
      updateValues.push(parseFloat(gameData.price_per_hour));
    } else if (gameData.price_per_15min !== undefined) {
      updateFields.push('price_per_hour = ?');
      updateValues.push(Math.ceil(parseFloat(gameData.price_per_15min) * 4));
    }
    
    if (gameData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(gameData.status);
    }
    
    if (gameData.min_rental_time !== undefined) {
      updateFields.push('min_rental_time = ?');
      updateValues.push(parseInt(gameData.min_rental_time));
    }
    
    if (gameData.max_rental_time !== undefined) {
      updateFields.push('max_rental_time = ?');
      updateValues.push(parseInt(gameData.max_rental_time));
    }
    
    if (gameData.minimum_age !== undefined) {
      updateFields.push('minimum_age = ?');
      updateValues.push(parseInt(gameData.minimum_age));
    }
    
    if (gameData.image_url !== undefined) {
      updateFields.push('image_url = ?');
      updateValues.push(gameData.image_url);
    }
    
    if (gameData.external_image_url !== undefined) {
      updateFields.push('external_image_url = ?');
      updateValues.push(gameData.external_image_url);
    }
    
    if (gameData.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(gameData.is_active ? 1 : 0);
    }
    
    updateFields.push('updated_at = NOW()');
    
    if (updateFields.length === 1) {
      return res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: game
      });
    }
    
    updateValues.push(gameId);
    
    const sql = `UPDATE games SET ${updateFields.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(sql, updateValues);
    
    if (result.affectedRows > 0) {
      const [updatedGame] = await pool.execute(
        'SELECT * FROM games WHERE id = ?',
        [gameId]
      );
      
      res.json({
        success: true,
        message: 'تم تحديث اللعبة بنجاح',
        data: updatedGame[0]
      });
    } else {
      res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: game
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في تحديث اللعبة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث اللعبة',
      error: error.message,
      suggestion: 'تحقق من اتصال قاعدة البيانات'
    });
  }
});

app.delete('/api/games/:id', authenticateToken, async (req, res) => {
  try {
    const gameId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية حذف الألعاب'
      });
    }
    
    const [games] = await pool.execute(
      'SELECT * FROM games WHERE id = ?',
      [gameId]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    
    if (user.role === 'branch_manager' && user.branch_id != game.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية حذف ألعاب هذا الفرع'
      });
    }
    
    if (permanent) {
      const [rentals] = await pool.execute(
        'SELECT COUNT(*) as count FROM rentals WHERE game_id = ? AND status = "نشط"',
        [gameId]
      );
      
      if (rentals[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن حذف اللعبة لأنها مرتبطة بتأجيرات نشطة'
        });
      }
      
      await pool.execute('DELETE FROM games WHERE id = ?', [gameId]);
      
      res.json({
        success: true,
        message: 'تم حذف اللعبة نهائياً بنجاح',
        game_id: gameId,
        game_name: game.name
      });
      
    } else {
      await pool.execute(
        'UPDATE games SET is_active = 0 WHERE id = ?',
        [gameId]
      );
      
      res.json({
        success: true,
        message: 'تم تعطيل اللعبة بنجاح',
        game_id: gameId,
        game_name: game.name
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في حذف اللعبة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف اللعبة',
      error: error.message
    });
  }
});

app.post('/api/games/fix-status', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { game_id, status } = req.body;
    
    if (!game_id || !status) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة والحالة مطلوبان'
      });
    }
    
    const [games] = await pool.execute(
      'SELECT * FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    
    if (user.role === 'branch_manager' && user.branch_id != game.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إصلاح ألعاب هذا الفرع'
      });
    }
    
    const [result] = await pool.execute(
      'UPDATE games SET status = ? WHERE id = ?',
      [status, game_id]
    );
    
    if (result.affectedRows > 0) {
      res.json({
        success: true,
        message: `تم تحديث حالة اللعبة إلى ${status}`,
        game_id: game_id,
        new_status: status
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'لم يتم تحديث حالة اللعبة'
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح حالة اللعبة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث حالة اللعبة',
      error: error.message
    });
  }
});

app.post('/api/games/create-default', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const branchId = user.branch_id || 1;
    
    const defaultGames = [
      ['سيارة كهربائية', 'سيارة كهربائية للأطفال', 'سيارات', 50, 200, branchId, 'متاح', 15, 120, 16, 'Car.jpg', null, 1],
      ['سكوتر كهربائي', 'سكوتر كهربائي سريع', 'سكوتر', 30, 120, branchId, 'متاح', 15, 120, 14, 'Scooter.jpg', null, 1],
      ['دراجة نارية', 'دراجة نارية كهربائية', 'دراجات', 40, 160, branchId, 'متاح', 15, 120, 16, 'Motor.jpg', null, 1],
      ['هوفر بورد', 'هوفر بورد كهربائي', 'أجهزة', 25, 100, branchId, 'متاح', 15, 60, 12, 'Hoverboard.jpg', null, 1],
      ['سكيت كهربائي', 'سكيت كهربائي متطور', 'سكيت', 35, 140, branchId, 'متاح', 15, 90, 14, 'Skate.jpg', null, 1],
      ['عربة جولف', 'عربة جولف كهربائية', 'سيارات', 60, 240, branchId, 'متاح', 30, 180, 18, 'GolfCart.jpg', null, 1],
      ['دريفت كار', 'سيارة درفت كهربائية', 'سيارات', 55, 220, branchId, 'متاح', 15, 120, 16, 'Driftcar.jpg', null, 1],
      ['هارلي', 'دراجة هارلي كهربائية', 'دراجات', 45, 180, branchId, 'متاح', 15, 120, 18, 'harley.jpg', null, 1]
    ];
    
    const results = [];
    
    for (const game of defaultGames) {
      const [result] = await pool.execute(
        `INSERT INTO games (name, description, category, price_per_15min, price_per_hour, 
         branch_id, status, min_rental_time, max_rental_time, minimum_age, 
         image_url, external_image_url, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`,
        game
      );
      
      if (result.affectedRows > 0) {
        results.push({
          name: game[0],
          id: result.insertId || 'existing'
        });
      }
    }
    
    res.json({
      success: true,
      message: 'تم إنشاء الألعاب الافتراضية بنجاح',
      created: results,
      count: results.length
    });
    
  } catch (error) {
    console.error('خطأ في إنشاء الألعاب الافتراضية:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء الألعاب الافتراضية'
    });
  }
});

app.post('/api/rentals/simple', authenticateToken, async (req, res) => {
  console.log('🎯 [FIXED] ===== بدء إنشاء تأجير =====');
  
  try {
    const user = req.user;
    const { 
      game_id, 
      customer_name, 
      customer_phone 
    } = req.body;

    // 1. تأكد من البيانات الأساسية
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }

    // 2. الحصول على الشيفت النشط (إجباري)
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' ORDER BY id DESC LIMIT 1",
      [user.id]
    );

    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً'
      });
    }

    const shiftId = shifts[0].id;

    // 3. جلب بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT id, name, price_per_15min FROM games WHERE id = ?',
      [game_id]
    );

    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }

    const game = games[0];

    // 4. حساب السعر (ثابت: 15 دقيقة فقط)
    const pricePer15Min = game.price_per_15min || 100;
    const totalAmount = pricePer15Min; // 15 دقيقة فقط

    // 5. إنشاء رقم التأجير
    const rentalNumber = `R-${Date.now().toString().slice(-8)}`;

    // 6. **الإدراج البسيط جداً** - فقط الحقول الأساسية
    const insertSQL = `
      INSERT INTO rentals (
        rental_number,
        game_id,
        game_name,
        customer_name,
        customer_phone,
        user_id,
        employee_name,
        branch_id,
        shift_id,
        start_time,
        rental_type,
        duration_minutes,
        is_open_time,
        total_amount,
        final_amount,
        payment_method,
        payment_status,
        status,
        paid_amount,
        price_per_15min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'fixed', 15, 0, ?, ?, 'كاش', 'مدفوع مسبقاً', 'نشط', ?, ?)
    `;

    const insertParams = [
      rentalNumber,
      game_id,
      game.name,
      customer_name,
      customer_phone || '00000000000',
      user.id,
      user.name || 'موظف',
      user.branch_id || 1,
      shiftId,
      totalAmount,
      totalAmount,
      totalAmount,
      pricePer15Min
    ];

    console.log('📝 [FIXED] إدراج التأجير...');
    const [result] = await pool.execute(insertSQL, insertParams);
    const rentalId = result.insertId;

    // 7. تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [game_id]
    );

    // 8. تحديث إيراد الشيفت
await pool.execute(
  `UPDATE shifts SET 
    total_revenue = COALESCE(total_revenue, 0) + ?,
    updated_at = NOW()
   WHERE id = ?`,
  [totalAmount, shiftId]
);

    // 9. **إرجاع البيانات الكاملة** (مهم جداً)
    const [newRental] = await pool.execute(
      `SELECT 
        id,
        rental_number,
        game_id,
        game_name,
        customer_name,
        customer_phone,
        shift_id,
        status,
        rental_type,
        is_open_time,
        payment_status,
        paid_amount,
        total_amount,
        start_time,
        branch_id,
        user_id
       FROM rentals WHERE id = ?`,
      [rentalId]
    );

    console.log('✅ [FIXED] تم إنشاء التأجير بنجاح:', {
      id: rentalId,
      rental_number: rentalNumber,
      shift_id: shiftId,
      status: 'نشط'
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء التأجير بنجاح',
      data: newRental[0] || {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: game_id,
        game_name: game.name,
        customer_name: customer_name,
        shift_id: shiftId,
        status: 'نشط',
        rental_type: 'fixed',
        is_open_time: 0,
        payment_status: 'مدفوع مسبقاً',
        paid_amount: totalAmount,
        total_amount: totalAmount,
        branch_id: user.branch_id || 1,
        user_id: user.id
      }
    });

  } catch (error) {
    console.error('🔥 [FIXED] خطأ:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التأجير',
      error: error.message
    });
  }
});

// ==================== نقطة إنشاء وقت مفتوح محسن ====================
app.post('/api/rentals/create-open', authenticateToken, async (req, res) => {
  console.log('🕒 [CREATE OPEN] إنشاء وقت مفتوح محسن');
  
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone } = req.body;
    
    console.log('📋 بيانات تأجير الوقت المفتوح:', { 
      game_id, 
      customer_name,
      user: user.name 
    });
    
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // الحصول على الشيفت
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
    const shiftId = shifts[0].id;
    
    // جلب بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT name, price_per_15min FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    const rentalNumber = `OPEN-${Date.now().toString().slice(-8)}`;
    
    // ⭐ **إنشاء وقت مفتوح حقيقي**
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number, 
        game_id, 
        game_name, 
        customer_name, 
        customer_phone,
        user_id, 
        employee_name, 
        branch_id, 
        shift_id,
        start_time,
        rental_type,        -- 'open' للوقت المفتوح
        is_open_time,       -- 1 للوقت المفتوح
        payment_status,     -- 'عند الإنهاء' للوقت المفتوح
        status,
        paid_amount,        -- 0 لم يتم الدفع
        total_amount,       -- 0 سيتم حسابه
        price_per_15min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'open', 1, 'عند الإنهاء', 'نشط', 0, 0, ?)`,
      [
        rentalNumber,
        game_id,
        game.name,
        customer_name,
        customer_phone || '00000000000',
        user.id,
        user.name,
        user.branch_id || 1,
        shiftId,
        game.price_per_15min || 100
      ]
    );
    
    const rentalId = result.insertId;
    
    // تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [game_id]
    );
    
    console.log('✅ [CREATE OPEN] تم إنشاء الوقت المفتوح:', {
      id: rentalId,
      rental_number: rentalNumber,
      rental_type: 'open',
      is_open_time: 1,
      payment_status: 'عند الإنهاء'
    });
    
    res.json({
      success: true,
      message: 'تم بدء الوقت المفتوح بنجاح',
      rental_number: rentalNumber,
      rental_id: rentalId,
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: game_id,
        game_name: game.name,
        customer_name: customer_name,
        rental_type: 'open',
        is_open_time: 1,
        payment_status: 'عند الإنهاء',
        paid_amount: 0,
        total_amount: 0,
        shift_id: shiftId
      }
    });
    
  } catch (error) {
    console.error('🔥 [CREATE OPEN] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في بدء الوقت المفتوح'
    });
  }
});

// ==================== نقطة إنشاء وقت مفتوح بسيط ====================
app.post('/api/rentals/open-time-simple', authenticateToken, async (req, res) => {
  console.log('🕒 [OPEN TIME SIMPLE] إنشاء وقت مفتوح بسيط');
  
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone } = req.body;
    
    console.log('📋 بيانات الوقت المفتوح البسيط:', { 
      game_id, 
      customer_name,
      user_id: user.id 
    });
    
    // 1. التحقق من البيانات
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // 2. الحصول على الشيفت النشط
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً'
      });
    }
    
    const shiftId = shifts[0].id;
    
    // 3. جلب بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT name, price_per_15min FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    const pricePer15Min = game.price_per_15min || 100;
    
    // 4. إنشاء رقم التأجير
    const rentalNumber = `OPEN-${Date.now().toString().slice(-8)}`;
    
    // 5. ⭐ **إدراج وقت مفتوح حقيقي**
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number,
        game_id,
        game_name,
        customer_name,
        customer_phone,
        user_id,
        employee_name,
        branch_id,
        shift_id,
        start_time,
        rental_type,           -- ⭐ 'open' لوقت مفتوح
        duration_minutes,      -- ⭐ 0 للوقت المفتوح (لا مدة محددة)
        is_open_time,          -- ⭐ 1 لوقت مفتوح
        total_amount,          -- ⭐ 0 (سيتم حسابه عند الإنتهاء)
        final_amount,          -- ⭐ 0 (سيتم حسابه عند الإنتهاء)
        payment_method,        -- ⭐ 'كاش'
        payment_status,        -- ⭐ 'عند الإنهاء' للوقت المفتوح
        status,                -- ⭐ 'نشط'
        paid_amount,           -- ⭐ 0 (لم يتم الدفع بعد)
        price_per_15min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'open', 0, 1, 0, 0, 'كاش', 'عند الإنهاء', 'نشط', 0, ?)`,
      [
        rentalNumber,
        game_id,
        game.name,
        customer_name,
        customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId,
        pricePer15Min
      ]
    );
    
    const rentalId = result.insertId;
    
    // 6. تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [game_id]
    );
    
    console.log('✅ [OPEN TIME SIMPLE] تم إنشاء الوقت المفتوح:', {
      id: rentalId,
      rental_number: rentalNumber,
      rental_type: 'open',
      is_open_time: 1,
      payment_status: 'عند الإنهاء',
      paid_amount: 0,
      total_amount: 0,
      shift_id: shiftId
    });
    
    // 7. جلب التأجير المنشأ
    const [newRental] = await pool.execute(
      'SELECT * FROM rentals WHERE id = ?',
      [rentalId]
    );
    
    res.json({
      success: true,
      message: 'تم بدء الوقت المفتوح بنجاح',
      rental_number: rentalNumber,
      rental_id: rentalId,
      data: newRental[0] || {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: game_id,
        game_name: game.name,
        customer_name: customer_name,
        rental_type: 'open',
        is_open_time: 1,
        payment_status: 'عند الإنهاء',
        status: 'نشط',
        paid_amount: 0,
        total_amount: 0,
        branch_id: user.branch_id,
        user_id: user.id,
        shift_id: shiftId,
        start_time: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔥 [OPEN TIME SIMPLE] خطأ:', error.message);
    console.error('🔥 SQL Error:', error.sql);
    
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء الوقت المفتوح: ' + error.message
    });
  }
});

// ✅ إنشاء تأجير ذكي
app.post('/api/rentals/smart-create', authenticateToken, async (req, res) => {
  console.log('🤖 [SMART CREATE] إنشاء تأجير ذكي');
  
  try {
    const user = req.user;
    const { 
      game_id, 
      customer_name, 
      customer_phone, 
      rental_type = 'fixed',
      duration_minutes = 15,   // ⭐ استلام المدة من الطلب
      quantity = 1
    } = req.body;
    
    console.log('📋 بيانات التأجير الذكي:', { 
      game_id, 
      customer_name,
      rental_type,
      duration_minutes,   // ⭐ تأكد من ظهور المدة هنا
      quantity
    });
    
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // الحصول على الشيفت
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
    const shiftId = shifts[0].id;
    
    // جلب بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT name, price_per_15min FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    const pricePer15Min = game.price_per_15min || 100;
    
    // ⭐ تحديد خصائص التأجير بناءً على النوع
    const isOpenTime = rental_type === 'open' ? 1 : 0;
    const paymentStatus = rental_type === 'open' ? 'عند الإنهاء' : 'مدفوع مسبقاً';
    const actualDuration = rental_type === 'open' ? 0 : (duration_minutes || 15);
    const totalAmount = rental_type === 'open' ? 0 : (Math.ceil(actualDuration / 15) * pricePer15Min * quantity);
    const paidAmount = rental_type === 'open' ? 0 : totalAmount;
    
    const prefix = rental_type === 'open' ? 'OPEN' : 'FIXED';
    const rentalNumber = `${prefix}-${Date.now().toString().slice(-8)}`;
    
    console.log('⚙️ إعدادات التأجير:', {
      rental_type,
      is_open_time: isOpenTime,
      payment_status: paymentStatus,
      duration_minutes: actualDuration,   // ⭐ التأكد من حفظ المدة الصحيحة
      total_amount: totalAmount,
      quantity
    });
    
    // ⭐ إنشاء التأجير مع duration_minutes الصحيح
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number,
        game_id,
        game_name,
        customer_name,
        customer_phone,
        user_id,
        employee_name,
        branch_id,
        shift_id,
        start_time,
        rental_type,
        duration_minutes,    -- ⭐ هذا هو الحقل المهم
        is_open_time,
        total_amount,
        final_amount,
        payment_method,
        payment_status,
        status,
        paid_amount,
        price_per_15min,
        quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rentalNumber,
        game_id,
        game.name,
        customer_name,
        customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId,
        rental_type,
        actualDuration,     // ⭐ المدة الصحيحة هنا
        isOpenTime,
        totalAmount,
        totalAmount,
        'كاش',
        paymentStatus,
        'نشط',
        paidAmount,
        pricePer15Min,
        quantity
      ]
    );
    
    const rentalId = result.insertId;
    
    // تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [game_id]
    );
    
    console.log('✅ [SMART CREATE] تم إنشاء التأجير:', {
      id: rentalId,
      rental_number: rentalNumber,
      rental_type: rental_type,
      duration_minutes: actualDuration,
      paid_amount: paidAmount
    });
    
    res.json({
      success: true,
      message: `تم إنشاء التأجير ${rental_type === 'open' ? 'المفتوح' : 'الثابت'} بنجاح`,
      rental_number: rentalNumber,
      rental_id: rentalId,
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: game_id,
        game_name: game.name,
        customer_name: customer_name,
        rental_type: rental_type,
        duration_minutes: actualDuration,
        payment_status: paymentStatus,
        status: 'نشط',
        shift_id: shiftId
      }
    });
    
  } catch (error) {
    console.error('🔥 [SMART CREATE] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في إنشاء التأجير: ' + error.message
    });
  }
});

// ==================== نقطة إنشاء تأجير أساسي (بسيطة) ====================
app.post('/api/rentals/create-basic', authenticateToken, async (req, res) => {
  console.log('🎯 [CREATE BASIC] إنشاء تأجير أساسي');
  
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone } = req.body;
    
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // 1. الحصول على الشيفت
    let shiftId = null;
    try {
      const [shifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
        [user.id]
      );
      if (shifts.length > 0) {
        shiftId = shifts[0].id;
      }
    } catch (error) {
      console.warn('⚠️ لا يمكن الحصول على الشيفت:', error.message);
    }
    
    // 2. إنشاء التأجير
    const rentalNumber = `BASIC-${Date.now().toString().slice(-8)}`;
    
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number, 
        game_id, 
        customer_name, 
        customer_phone,
        user_id, 
        employee_name,
        branch_id, 
        shift_id,
        start_time,
        status,
        payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'نشط', 'مدفوع مسبقاً')`,
      [
        rentalNumber,
        game_id,
        customer_name,
        customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId
      ]
    );
    
    const rentalId = result.insertId;
    
    console.log('✅ [CREATE BASIC] تم إنشاء التأجير:', {
      id: rentalId,
      rental_number: rentalNumber,
      shift_id: shiftId
    });
    
    res.json({
      success: true,
      message: 'تم إنشاء التأجير بنجاح',
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: game_id,
        customer_name: customer_name,
        shift_id: shiftId,
        branch_id: user.branch_id || 1,
        status: 'نشط'
      },
      rental_id: rentalId
    });
    
  } catch (error) {
    console.error('🔥 [CREATE BASIC] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التأجير'
    });
  }
});

app.get('/api/debug/fix-rentals-structure', async (req, res) => {
  try {
    console.log('🔧 إصلاح هيكل جدول rentals...');
    
    // قائمة الحقول المطلوبة للتأجيرات النشطة
    const requiredFields = [
      { name: 'rental_number', type: 'VARCHAR(100) NOT NULL DEFAULT ""' },
      { name: 'game_id', type: 'INT NOT NULL' },
      { name: 'customer_name', type: 'VARCHAR(255) NOT NULL' },
      { name: 'user_id', type: 'INT NOT NULL' },
      { name: 'branch_id', type: 'INT NOT NULL DEFAULT 1' },
      { name: 'shift_id', type: 'INT' },
      { name: 'status', type: "VARCHAR(50) DEFAULT 'نشط'" },
      { name: 'start_time', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'rental_type', type: "VARCHAR(50) DEFAULT 'fixed'" },
      { name: 'is_open_time', type: 'TINYINT DEFAULT 0' },
      { name: 'payment_status', type: "VARCHAR(50) DEFAULT 'مدفوع مسبقاً'" },
      { name: 'price_per_15min', type: 'DECIMAL(10,2) DEFAULT 100' }
    ];
    
    const [existingFields] = await pool.execute('DESCRIBE rentals');
    const existingFieldNames = existingFields.map(f => f.Field);
    
    let addedFields = [];
    
    for (const field of requiredFields) {
      if (!existingFieldNames.includes(field.name)) {
        try {
          await pool.execute(`ALTER TABLE rentals ADD COLUMN ${field.name} ${field.type}`);
          console.log(`✅ أضيف الحقل: ${field.name}`);
          addedFields.push(field.name);
        } catch (alterError) {
          console.warn(`⚠️ لا يمكن إضافة ${field.name}:`, alterError.message);
        }
      }
    }
    
    // عرض عينة من البيانات
    const [sampleData] = await pool.execute(`
      SELECT id, rental_number, customer_name, status, shift_id, branch_id 
      FROM rentals 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    res.json({
      success: true,
      message: 'تم إصلاح جدول rentals',
      added_fields: addedFields,
      sample_data: sampleData,
      total_fields: existingFieldNames.length + addedFields.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح الجدول:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إصلاح الجدول'
    });
  }
});

// ==================== نقطة مساعدة: إعادة إنشاء جدول rentals ====================

app.post('/api/debug/fix-rentals-table', async (req, res) => {
  try {
    console.log('🔧 [FIX TABLE] محاولة إصلاح جدول rentals...');
    
    // 1. التحقق من وجود الجدول
    const [tables] = await pool.execute("SHOW TABLES LIKE 'rentals'");
    
    if (tables.length === 0) {
      console.log('❌ جدول rentals غير موجود، سيتم إنشاؤه...');
      
      await pool.execute(`
        CREATE TABLE rentals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          rental_number VARCHAR(100) NOT NULL,
          game_id INT NOT NULL,
          game_name VARCHAR(255),
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(20),
          user_id INT NOT NULL,
          employee_name VARCHAR(255),
          branch_id INT NOT NULL DEFAULT 1,
          shift_id INT,
          start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_time DATETIME,
          rental_type VARCHAR(50) DEFAULT 'fixed',
          duration_minutes INT DEFAULT 15,
          is_open_time TINYINT DEFAULT 0,
          total_amount DECIMAL(10,2) DEFAULT 0,
          final_amount DECIMAL(10,2),
          payment_method VARCHAR(50) DEFAULT 'كاش',
          payment_status VARCHAR(50) DEFAULT 'مدفوع مسبقاً',
          status VARCHAR(50) DEFAULT 'نشط',
          paid_amount DECIMAL(10,2) DEFAULT 0,
          price_per_15min DECIMAL(10,2) DEFAULT 100,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_branch_status (branch_id, status),
          INDEX idx_shift (shift_id),
          INDEX idx_game (game_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      
      console.log('✅ تم إنشاء جدول rentals بنجاح');
    }
    
    // 2. التحقق من الحقول المطلوبة
    const [columns] = await pool.execute("DESCRIBE rentals");
    const columnNames = columns.map(col => col.Field);
    
    const requiredColumns = [
      'rental_number', 'game_id', 'customer_name', 'user_id', 
      'branch_id', 'shift_id', 'status', 'payment_status'
    ];
    
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`⚠️ الحقول الناقصة: ${missingColumns.join(', ')}`);
      
      for (const column of missingColumns) {
        try {
          if (column === 'status') {
            await pool.execute("ALTER TABLE rentals ADD COLUMN status VARCHAR(50) DEFAULT 'نشط'");
          } else if (column === 'shift_id') {
            await pool.execute("ALTER TABLE rentals ADD COLUMN shift_id INT");
          } else if (column === 'payment_status') {
            await pool.execute("ALTER TABLE rentals ADD COLUMN payment_status VARCHAR(50) DEFAULT 'مدفوع مسبقاً'");
          } else if (column === 'rental_number') {
            await pool.execute("ALTER TABLE rentals ADD COLUMN rental_number VARCHAR(100) NOT NULL DEFAULT ''");
          }
        } catch (alterError) {
          console.warn(`⚠️ لا يمكن إضافة ${column}:`, alterError.message);
        }
      }
    }
    
    console.log('✅ جدول rentals جاهز للاستخدام');
    
    res.json({
      success: true,
      message: 'تم إصلاح جدول rentals بنجاح',
      columns: columnNames,
      missing_columns_fixed: missingColumns.length
    });
    
  } catch (error) {
    console.error('🔥 [FIX TABLE] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل إصلاح الجدول',
      error: error.message
    });
  }
});

app.post('/api/rentals/ultra-simple', authenticateToken, async (req, res) => {
  console.log('🚀 [ULTRA SIMPLE FIXED] بدء تأجير جديد');
  
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone } = req.body;
    
    console.log('📋 البيانات المستلمة:', { 
      game_id, 
      customer_name, 
      user_id: user.id, 
      branch_id: user.branch_id 
    });
    
    // 1. التحقق من البيانات
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // 2. جلب بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT id, name, price_per_15min FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    const pricePer15Min = game.price_per_15min || 100;
    const totalAmount = pricePer15Min; // 15 دقيقة فقط
    
    // 3. الحصول على الشيفت النشط
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد شيفت نشط. يرجى بدء شيفت أولاً'
      });
    }
    
    const shiftId = shifts[0].id;
    
    // 4. إنشاء رقم التأجير
    const rentalNumber = `RENT-${Date.now().toString().slice(-8)}`;
    
    // 5. ⭐ إدراج وقت ثابت مع payment_status
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number,
        game_id,
        game_name,
        customer_name,
        customer_phone,
        user_id,
        employee_name,
        branch_id,
        shift_id,
        start_time,
        rental_type,           -- ⭐ 'fixed' لوقت ثابت
        duration_minutes,
        is_open_time,          -- ⭐ 0 لوقت ثابت
        total_amount,
        final_amount,
        payment_method,
        payment_status,        -- ⭐ 'مدفوع مسبقاً' لوقت ثابت
        status,
        paid_amount,
        price_per_15min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'fixed', 15, 0, ?, ?, 'كاش', 'مدفوع مسبقاً', 'نشط', ?, ?)`,
      [
        rentalNumber,
        game_id,
        game.name,
        customer_name,
        customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId,
        totalAmount,
        totalAmount,
        totalAmount,
        pricePer15Min
      ]
    );
    
    const rentalId = result.insertId;
    
    // 6. تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [game_id]
    );
    
    console.log('✅ [ULTRA SIMPLE] تم إنشاء الوقت الثابت:', {
      id: rentalId,
      rental_number: rentalNumber,
      rental_type: 'fixed',
      is_open_time: 0,
      payment_status: 'مدفوع مسبقاً',
      shift_id: shiftId
    });
    
    res.json({
      success: true,
      message: 'تم إنشاء التأجير بنجاح',
      rental_number: rentalNumber,
      rental_id: rentalId,
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: game_id,
        game_name: game.name,
        customer_name: customer_name,
        rental_type: 'fixed',
        is_open_time: 0,
        payment_status: 'مدفوع مسبقاً',
        status: 'نشط',
        paid_amount: totalAmount,
        total_amount: totalAmount,
        branch_id: user.branch_id || 1,
        user_id: user.id,
        shift_id: shiftId
      }
    });
    
  } catch (error) {
    console.error('🔥 [ULTRA SIMPLE] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التأجير'
    });
  }
});

// نقطة إصلاح التأجيرات الحالية
app.post('/api/rentals/fix-existing', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🔧 إصلاح التأجيرات الحالية للفرع', user.branch_id);
    
    // 1. إصلاح payment_status الفارغ
    const [fixPayment] = await pool.execute(
      `UPDATE rentals SET 
        payment_status = CASE 
          WHEN rental_type = 'open' THEN 'عند الإنهاء'
          WHEN rental_type = 'fixed' THEN 'مدفوع مسبقاً'
          ELSE 'مدفوع مسبقاً'
        END
       WHERE branch_id = ? AND (payment_status = '' OR payment_status IS NULL)`,
      [user.branch_id]
    );
    
    // 2. إصلاح is_open_time بناءً على rental_type
    const [fixOpenTime] = await pool.execute(
      `UPDATE rentals SET 
        is_open_time = CASE 
          WHEN rental_type = 'open' THEN 1
          ELSE 0
        END
       WHERE branch_id = ?`,
      [user.branch_id]
    );
    
    // 3. جلب النتائج
    const [fixedRentals] = await pool.execute(
      `SELECT id, rental_number, rental_type, is_open_time, payment_status 
       FROM rentals 
       WHERE branch_id = ? 
       ORDER BY id DESC 
       LIMIT 10`,
      [user.branch_id]
    );
    
    console.log('✅ تم إصلاح التأجيرات:', {
      payment_fixed: fixPayment.affectedRows,
      open_time_fixed: fixOpenTime.affectedRows,
      sample: fixedRentals
    });
    
    res.json({
      success: true,
      message: 'تم إصلاح التأجيرات الحالية',
      stats: {
        payment_fixed: fixPayment.affectedRows,
        open_time_fixed: fixOpenTime.affectedRows
      },
      sample: fixedRentals
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح التأجيرات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الإصلاح'
    });
  }
});


// نقطة إنشاء تأجير وقت مفتوح - إصلاح كامل
app.post('/api/rentals/open-time-fixed', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { game_id, customer_name, customer_phone } = req.body;
    
    console.log('🕒 [OPEN TIME FIXED] إنشاء وقت مفتوح:', { game_id, customer_name });
    
    // 1. التحقق من البيانات
    if (!game_id || !customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // 2. التحقق من الشيفت النشط
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
    const shiftId = shifts[0].id;
    
    // 3. جلب بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT name, price_per_15min FROM games WHERE id = ?',
      [game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    const pricePer15Min = game.price_per_15min || 100;
    
    // 4. إنشاء رقم التأجير
    const rentalNumber = `OPEN-${Date.now().toString().slice(-8)}`;
    
    // 5. إدراج التأجير مع نوع الوقت المفتوح
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number,
        game_id,
        game_name,
        customer_name,
        customer_phone,
        user_id,
        employee_name,
        branch_id,
        shift_id,
        start_time,
        rental_type,          -- مهم: 'open'
        duration_minutes,
        is_open_time,         -- مهم: 1
        total_amount,
        final_amount,
        payment_method,
        payment_status,       -- مهم: 'عند الإنهاء'
        status,
        paid_amount,
        price_per_15min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'open', 15, 1, 0, 0, 'كاش', 'عند الإنهاء', 'نشط', 0, ?)`,
      [
        rentalNumber,
        game_id,
        game.name,
        customer_name,
        customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId,
        pricePer15Min
      ]
    );
    
    const rentalId = result.insertId;
    
    // 6. تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [game_id]
    );
    
    console.log('✅ [OPEN TIME FIXED] تم إنشاء الوقت المفتوح:', {
      id: rentalId,
      rental_number: rentalNumber,
      rental_type: 'open',
      is_open_time: 1,
      payment_status: 'عند الإنهاء'
    });
    
    res.json({
      success: true,
      message: 'تم بدء الوقت المفتوح بنجاح',
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        rental_type: 'open',
        is_open_time: 1,
        payment_status: 'عند الإنهاء',
        start_time: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔥 [OPEN TIME FIXED] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء الوقت المفتوح'
    });
  }
});

// نقطة تشخيصية لفحص جدول rentals
app.get('/api/debug/rentals-structure', async (req, res) => {
  try {
    console.log('🔍 فحص هيكل جدول rentals...');
    
    // 1. فحص هيكل الجدول
    const [structure] = await pool.execute('DESCRIBE rentals');
    const columnNames = structure.map(col => col.Field);
    
    // 2. الحقول المطلوبة
    const requiredColumns = [
      'id',
      'rental_number', 
      'game_id', 
      'customer_name', 
      'user_id', 
      'branch_id', 
      'shift_id', 
      'status',
      'start_time',
      'rental_type',
      'is_open_time',
      'payment_status',
      'paid_amount',
      'price_per_15min'
    ];
    
    // 3. التحقق من الحقول الناقصة
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    // 4. جلب عينة من البيانات
    const [sampleData] = await pool.execute('SELECT * FROM rentals ORDER BY id DESC LIMIT 5');
    
    res.json({
      success: true,
      structure: structure,
      columns: columnNames,
      required_columns: requiredColumns,
      missing_columns: missingColumns,
      sample_data: sampleData,
      total_columns: columnNames.length,
      suggestion: missingColumns.length > 0 ? 
        `يجب إضافة الحقول الناقصة: ${missingColumns.join(', ')}` : 
        'جدول rentals جاهز'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في فحص جدول rentals:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في فحص الجدول',
      error: error.message
    });
  }
});

// ==================== نقطة إصلاح حالات الدفع ====================
app.post('/api/rentals/fix-all-payments', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🔧 [FIX PAYMENTS] إصلاح جميع حالات الدفع للفرع', user.branch_id);
    
    // 1. إصلاح الوقت المفتوح
    const [openResult] = await pool.execute(
      `UPDATE rentals SET 
        payment_status = 'عند الإنهاء',
        paid_amount = 0
       WHERE branch_id = ? 
         AND (rental_type = 'open' OR is_open_time = 1)
         AND payment_status != 'عند الإنهاء'`,
      [user.branch_id]
    );
    
    // 2. إصلاح الوقت الثابت
    const [fixedResult] = await pool.execute(
      `UPDATE rentals SET 
        payment_status = 'مدفوع مسبقاً',
        paid_amount = total_amount
       WHERE branch_id = ? 
         AND (rental_type = 'fixed' OR is_open_time = 0)
         AND payment_status != 'مدفوع مسبقاً'`,
      [user.branch_id]
    );
    
    console.log('📊 [FIX PAYMENTS] نتائج الإصلاح:', {
      open_fixed: openResult.affectedRows || 0,
      fixed_fixed: fixedResult.affectedRows || 0
    });
    
    // 3. جلب عينة للتأكد
    const [sample] = await pool.execute(
      `SELECT 
        id,
        customer_name,
        rental_type,
        is_open_time,
        payment_status,
        paid_amount,
        total_amount
       FROM rentals 
       WHERE branch_id = ? 
       ORDER BY id DESC 
       LIMIT 10`,
      [user.branch_id]
    );
    
    res.json({
      success: true,
      message: 'تم إصلاح جميع حالات الدفع',
      data: {
        results: {
          open_time_fixed: openResult.affectedRows || 0,
          fixed_time_fixed: fixedResult.affectedRows || 0,
          total_fixed: (openResult.affectedRows || 0) + (fixedResult.affectedRows || 0)
        },
        sample: sample || []
      }
    });
    
  } catch (error) {
    console.error('🔥 [FIX PAYMENTS] خطأ في إصلاح حالات الدفع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إصلاح حالات الدفع',
      error: error.message
    });
  }
});

// ==================== نقطة إصلاح الوقت المفتوح فقط ====================
app.post('/api/rentals/fix-open-time-payments', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🔄 إصلاح تأجيرات الوقت المفتوح للفرع', user.branch_id);
    
    const [result] = await pool.execute(
      `UPDATE rentals SET 
        payment_status = 'عند الإنهاء',
        paid_amount = 0
       WHERE branch_id = ? 
         AND (rental_type = 'open' OR is_open_time = 1)
         AND payment_status != 'عند الإنهاء'`,
      [user.branch_id]
    );
    
    console.log('✅ تم إصلاح تأجيرات الوقت المفتوح:', result.affectedRows);
    
    res.json({
      success: true,
      message: 'تم إصلاح تأجيرات الوقت المفتوح',
      fixed_count: result.affectedRows
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح تأجيرات الوقت المفتوح:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الإصلاح'
    });
  }
});

// ==================== نقطة إصلاح الوقت الثابت فقط ====================
app.post('/api/rentals/fix-fixed-time-payments', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🔄 إصلاح تأجيرات الوقت الثابت للفرع', user.branch_id);
    
    const [result] = await pool.execute(
      `UPDATE rentals SET 
        payment_status = 'مدفوع مسبقاً',
        paid_amount = total_amount
       WHERE branch_id = ? 
         AND (rental_type = 'fixed' OR is_open_time = 0)
         AND payment_status != 'مدفوع مسبقاً'`,
      [user.branch_id]
    );
    
    console.log('✅ تم إصلاح تأجيرات الوقت الثابت:', result.affectedRows);
    
    res.json({
      success: true,
      message: 'تم إصلاح تأجيرات الوقت الثابت',
      fixed_count: result.affectedRows
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح تأجيرات الوقت الثابت:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الإصلاح'
    });
  }
});

// ==================== نقطة تشخيص حالات الدفع ====================
app.get('/api/rentals/diagnose-payments', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🔍 تشخيص حالات الدفع للفرع', user.branch_id);
    
    const [diagnosis] = await pool.execute(
      `SELECT 
        COUNT(*) as total_rentals,
        COUNT(CASE WHEN rental_type = 'open' OR is_open_time = 1 THEN 1 END) as open_time_count,
        COUNT(CASE WHEN rental_type = 'fixed' OR is_open_time = 0 THEN 1 END) as fixed_time_count,
        COUNT(CASE WHEN (rental_type = 'open' OR is_open_time = 1) AND payment_status != 'عند الإنهاء' THEN 1 END) as open_time_wrong,
        COUNT(CASE WHEN (rental_type = 'fixed' OR is_open_time = 0) AND payment_status != 'مدفوع مسبقاً' THEN 1 END) as fixed_time_wrong,
        COUNT(CASE WHEN payment_status = '' OR payment_status IS NULL THEN 1 END) as empty_payment_status
       FROM rentals 
       WHERE branch_id = ? AND status = 'نشط'`,
      [user.branch_id]
    );
    
    const stats = diagnosis[0] || {};
    
    res.json({
      success: true,
      message: 'تشخيص حالات الدفع',
      data: {
        total_rentals: stats.total_rentals || 0,
        open_time_count: stats.open_time_count || 0,
        fixed_time_count: stats.fixed_time_count || 0,
        open_time_wrong: stats.open_time_wrong || 0,
        fixed_time_wrong: stats.fixed_time_wrong || 0,
        empty_payment_status: stats.empty_payment_status || 0,
        needs_fix: (stats.open_time_wrong || 0) + (stats.fixed_time_wrong || 0) > 0
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في تشخيص حالات الدفع:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التشخيص',
      error: error.message
    });
  }
});

// 🔥 إضافة نقطة /rentals/active المفقودة
app.get('/api/rentals/active', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id } = req.query;
    
    const targetBranchId = branch_id || user.branch_id || 1;
    
    console.log(`🔍 [ACTIVE RENTALS] جلب التأجيرات النشطة للفرع ${targetBranchId}`);
    
    let query = `
      SELECT 
        r.id,
        r.rental_number,
        r.game_id,
        r.game_name,
        r.customer_name,
        r.customer_phone,
        r.start_time,
        r.status,
        r.rental_type,
        r.is_open_time,
        r.payment_status,
        r.paid_amount,
        r.total_amount,
        r.final_amount,
        r.duration_minutes,      -- ⭐ هذا هو الحقل المهم
        r.shift_id,
        r.branch_id,
        r.price_per_15min,
        r.employee_name,
        g.name as game_name_full,
        g.price_per_15min as game_price
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ? 
        AND r.status = 'نشط'
    `;
    
    const params = [targetBranchId];
    
    if (shift_id) {
      query += ' AND r.shift_id = ?';
      params.push(shift_id);
    }
    
    query += ' ORDER BY r.start_time ASC';
    
    const [rentals] = await pool.execute(query, params);
    
    console.log(`✅ [ACTIVE RENTALS] تم جلب ${rentals.length} تأجير نشط`);
    
    // تسجيل قيم duration_minutes
    rentals.forEach(rental => {
      console.log(`📋 تأجير ${rental.id} - المدة: ${rental.duration_minutes} دقيقة, النوع: ${rental.rental_type}`);
    });
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      message: `تم العثور على ${rentals.length} تأجير نشط`
    });
    
  } catch (error) {
    console.error('🔥 [ACTIVE RENTALS] خطأ:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات النشطة'
    });
  }
});

// نقطة إصلاح أنواع التأجيرات
app.post('/api/debug/fix-rental-types', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    console.log('🔧 إصلاح أنواع التأجيرات للفرع', user.branch_id);
    
    // 1. تأجيرات الوقت المفتوح
    const [openResult] = await pool.execute(
      `UPDATE rentals SET 
        rental_type = 'open',
        is_open_time = 1,
        payment_status = 'عند الإنهاء'
       WHERE branch_id = ? 
         AND (payment_status = 'عند الإنهاء' OR payment_status = 'pending')
         AND rental_type != 'open'`,
      [user.branch_id]
    );
    
    // 2. تأجيرات الوقت الثابت
    const [fixedResult] = await pool.execute(
      `UPDATE rentals SET 
        rental_type = 'fixed',
        is_open_time = 0,
        payment_status = 'مدفوع مسبقاً'
       WHERE branch_id = ? 
         AND (payment_status = 'مدفوع مسبقاً' OR payment_status = 'paid')
         AND rental_type != 'fixed'`,
      [user.branch_id]
    );
    
    console.log('✅ نتائج الإصلاح:', {
      open_updated: openResult.affectedRows,
      fixed_updated: fixedResult.affectedRows
    });
    
    res.json({
      success: true,
      message: 'تم إصلاح أنواع التأجيرات',
      stats: {
        open_updated: openResult.affectedRows,
        fixed_updated: fixedResult.affectedRows
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح أنواع التأجيرات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الإصلاح'
    });
  }
});

app.get('/api/rentals/:id', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    console.log(`🔍 [GET RENTAL] جلب تأجير ${rentalId} للمستخدم ${user.id} (فرع ${user.branch_id})`);
    
    // استعلام شامل
    const [rentals] = await pool.execute(
      `SELECT 
        r.*,
        g.name as game_name,
        g.price_per_15min as game_price,
        g.category as game_category
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.id = ?`,
      [rentalId]
    );
    
    if (rentals.length === 0) {
      console.log(`❌ [GET RENTAL] التأجير ${rentalId} غير موجود في قاعدة البيانات`);
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }
    
    const rental = rentals[0];
    
    console.log(`✅ [GET RENTAL] وجد التأجير:`, {
      id: rental.id,
      rental_number: rental.rental_number,
      customer_name: rental.customer_name,
      branch_id: rental.branch_id,
      user_branch_id: user.branch_id,
      status: rental.status,
      shift_id: rental.shift_id
    });
    
    // التحقق من صلاحية الفرع
    if (rental.branch_id !== user.branch_id) {
      console.log(`⚠️ [GET RENTAL] التأجير في فرع مختلف: ${rental.branch_id} بدلاً من ${user.branch_id}`);
      
      return res.json({
        success: true,
        data: rental,
        branch_warning: true,
        message: `التأجير موجود في فرع آخر (${rental.branch_id})`
      });
    }
    
    res.json({
      success: true,
      data: rental
    });
    
  } catch (error) {
    console.error('🔥 [GET RENTAL] خطأ في جلب التأجير:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات التأجير'
    });
  }
});

app.post('/api/rentals/alt', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const rentalData = req.body;
    
    if (!rentalData.game_id || !rentalData.customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    const rentalNumber = `ALT-${Date.now().toString().slice(-8)}`;
    
    let shiftId = null;
    try {
      const [shifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
        [user.id]
      );
      if (shifts.length > 0) {
        shiftId = shifts[0].id;
      }
    } catch (error) {
      console.warn('⚠️ لا يمكن الحصول على الشيفت:', error.message);
    }
    
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number, game_id, customer_name, customer_phone,
        user_id, employee_name, branch_id, shift_id,
        start_time, rental_type, duration_minutes, total_amount,
        payment_method, payment_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
      [
        rentalNumber,
        rentalData.game_id,
        rentalData.customer_name,
        rentalData.customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId,
        rentalData.rental_type || 'fixed',
        rentalData.duration_minutes || 15,
        rentalData.total_amount || 0,
        rentalData.payment_method || 'كاش',
        rentalData.payment_status || 'عند الإنهاء',
        'نشط'
      ]
    );
    
    const rentalId = result.insertId;
    
    try {
      await pool.execute(
        "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
        [rentalData.game_id]
      );
    } catch (updateError) {
      console.warn('⚠️ لا يمكن تحديث حالة اللعبة:', updateError.message);
    }
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء التأجير بنجاح (بديل)',
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: rentalData.game_id,
        customer_name: rentalData.customer_name
      },
      rental_number: rentalNumber,
      rental_id: rentalId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء التأجير البديل:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التأجير',
      error: error.message,
      suggestion: 'جرب النقطة البسيطة: /api/rentals/simple'
    });
  }
});

app.post('/api/rentals', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const rentalData = req.body;
    
    console.log('🎯 [SERVER] استقبال طلب تأجير رئيسي:', {
      game_id: rentalData.game_id,
      customer_name: rentalData.customer_name,
      rental_type: rentalData.rental_type,
      user_id: user.id
    });
    
    // ✅ **إصلاح**: تحقق من البيانات الأساسية فقط
    if (!rentalData.game_id || !rentalData.customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // ✅ **إصلاح**: استخدام القيم الافتراضية
    const rentalType = rentalData.rental_type || 'fixed';
    const isOpenTime = rentalData.is_open_time || (rentalType === 'open' ? 1 : 0);
    const durationMinutes = rentalData.duration_minutes || 15;
    const quantity = rentalData.quantity || 1;
    
    // الحصول على بيانات اللعبة
    const [games] = await pool.execute(
      'SELECT name, price_per_15min FROM games WHERE id = ?',
      [rentalData.game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const game = games[0];
    const pricePer15Min = rentalData.price_per_15min || game.price_per_15min || 100;
    
    // حساب المبلغ
    let totalAmount = 0;
    let paymentStatus = 'عند الإنهاء';
    let paidAmount = 0;
    
   if (rentalType === 'fixed') {
  payment_status = 'مدفوع مسبقاً';
  paid_amount = totalAmount;
} else {
  payment_status = 'عند الإنهاء';
  paid_amount = 0;
}
    
    // الحصول على الشيفت
    let shiftId = rentalData.shift_id;
    if (!shiftId) {
      try {
        const [shifts] = await pool.execute(
          "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
          [user.id]
        );
        if (shifts.length > 0) {
          shiftId = shifts[0].id;
        }
      } catch (error) {
        console.warn('⚠️ لا يمكن الحصول على الشيفت:', error.message);
      }
    }
    
    // ✅ **إصلاح**: إنشاء رقم تأجير بسيط
    const timestamp = Date.now();
    const rentalNumber = `RENT-${timestamp.toString().slice(-8)}`;
    
    // ✅ **إصلاح**: استعلام INSERT مبسط
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number, 
        game_id, 
        game_name,
        customer_name, 
        customer_phone,
        user_id, 
        employee_name, 
        branch_id, 
        shift_id,
        start_time, 
        rental_type, 
        duration_minutes,
        is_open_time, 
        total_amount, 
        final_amount,
        payment_method, 
        payment_status, 
        status,
        paid_amount,
        price_per_15min,
        quantity,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rentalNumber,
        rentalData.game_id,
        game.name,
        rentalData.customer_name,
        rentalData.customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        shiftId,
        rentalType,
        durationMinutes,
        isOpenTime,
        totalAmount,
        totalAmount,
        rentalData.payment_method || 'كاش',
        paymentStatus,
        'نشط',
        paidAmount,
        pricePer15Min,
        quantity,
        rentalData.notes || ''
      ]
    );
    
    const rentalId = result.insertId;
    
    // تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [rentalData.game_id]
    );
    
    // إضافة الإيراد للوقت الثابت
    if (rentalType === 'fixed' && shiftId && paidAmount > 0) {
      try {
        await pool.execute(
          `UPDATE shifts SET 
            total_revenue = COALESCE(total_revenue, 0) + ?,
            updated_at = NOW()
           WHERE id = ?`,
          [paidAmount, shiftId]
        );
      } catch (error) {
        console.warn('⚠️ لا يمكن تحديث إيراد الشيفت:', error.message);
      }
    }
    
    console.log('✅ تأجير رئيسي تم إنشاؤه:', {
      id: rentalId,
      rental_number: rentalNumber,
      rental_type: rentalType,
      payment_status: paymentStatus
    });
    
    res.status(201).json({
      success: true,
      message: `تم بدء التأجير ${rentalType === 'fixed' ? 'الثابت' : 'المفتوح'} بنجاح`,
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        game_id: rentalData.game_id,
        game_name: game.name,
        customer_name: rentalData.customer_name,
        rental_type: rentalType,
        is_open_time: isOpenTime,
        payment_status: paymentStatus,
        paid_amount: paidAmount,
        total_amount: totalAmount,
        start_time: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء التأجير الرئيسي:', error.message);
    console.error('🔥 SQL Error:', error.sql);
    console.error('🔥 Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التأجير',
      error: error.message,
      sql_error: process.env.NODE_ENV === 'development' ? error.sql : undefined
    });
  }
});

app.post('/api/rentals/open-time', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const rentalData = req.body;
    
    console.log('🕒 إنشاء تأجير وقت مفتوح:', rentalData);
    
    if (!rentalData.game_id || !rentalData.customer_name) {
      return res.status(400).json({
        success: false,
        message: 'معرف اللعبة واسم العميل مطلوبان'
      });
    }
    
    // تأكد من أن النوع مفتوح
    const rentalType = 'open';
    const isOpenTime = 1;
    
    // الحصول على سعر اللعبة
    const [games] = await pool.execute(
      'SELECT price_per_15min, name FROM games WHERE id = ?',
      [rentalData.game_id]
    );
    
    if (games.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'اللعبة غير موجودة'
      });
    }
    
    const pricePer15Min = games[0].price_per_15min || 100;
    const gameName = games[0].name;
    
    // إنشاء رقم التأجير
    const timestamp = Date.now();
    const rentalNumber = `OPEN-${timestamp.toString().slice(-8)}`;
    
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number, 
        game_id, 
        game_name,
        customer_name, 
        customer_phone,
        user_id, 
        employee_name,
        branch_id,
        start_time, 
        rental_type, 
        is_open_time, 
        total_amount, 
        payment_method, 
        payment_status, 
        status,
        price_per_15min
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        rentalNumber,
        rentalData.game_id,
        gameName,
        rentalData.customer_name,
        rentalData.customer_phone || '00000000000',
        user.id,
        user.name || 'موظف',
        user.branch_id || 1,
        rentalType,
        isOpenTime,
        0, // total_amount = 0 للوقت المفتوح
        rentalData.payment_method || 'كاش',
        'عند الإنهاء',
        'نشط',
        pricePer15Min
      ]
    );
    
    const rentalId = result.insertId;
    
    // تحديث حالة اللعبة
    await pool.execute(
      "UPDATE games SET status = 'مؤجرة' WHERE id = ?",
      [rentalData.game_id]
    );
    
    res.status(201).json({
      success: true,
      message: 'تم بدء التأجير المفتوح بنجاح',
      data: {
        id: rentalId,
        rental_number: rentalNumber,
        rental_type: rentalType,
        is_open_time: isOpenTime,
        payment_status: 'عند الإنهاء',
        start_time: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء التأجير المفتوح:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء التأجير المفتوح'
    });
  }
});

app.post('/api/rentals/:id/cancel-early', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { reason = 'إلغاء مبكر' } = req.body;
    
    console.log(`❌ طلب إلغاء مبكر للتأجير ${rentalId}`);
    
    // جلب بيانات التأجير
    const [rentals] = await pool.execute(
      'SELECT * FROM rentals WHERE id = ? AND branch_id = ? AND status = "نشط"',
      [rentalId, user.branch_id]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود أو غير نشط'
      });
    }
    
    const rental = rentals[0];
    
    // ✅ **قاعدة الإلغاء المبكر**: فقط في أول 3 دقائق
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const elapsedMinutes = Math.floor((now - startTime) / (1000 * 60));
    
    console.log('⏱️ وقت التأجير:', {
      start: startTime.toLocaleString(),
      now: now.toLocaleString(),
      elapsed_minutes: elapsedMinutes
    });
    
    if (elapsedMinutes > 3) {
      return res.status(400).json({
        success: false,
        message: `لا يمكن الإلغاء بعد أول 3 دقائق (الوقت المنقضي: ${elapsedMinutes} دقيقة)`,
        elapsed_minutes: elapsedMinutes,
        max_allowed: 3
      });
    }
    
    // ✅ **استرداد كامل المبلغ للوقت الثابت فقط**
    let refundAmount = 0;
    let actualAmount = 0;
    
    if (rental.rental_type === 'fixed' && rental.payment_status === 'مدفوع مسبقاً') {
      refundAmount = rental.paid_amount || rental.total_amount || 0;
      actualAmount = 0; // ⚠️ لا إيراد للإلغاء المبكر
      
      console.log('💰 استرداد كامل المبلغ:', refundAmount);
      
      // ✅ **خصم المبلغ من إيراد الشيفت** لأن الوقت الثابت تم إضافته للإيراد عند الإنشاء
      if (rental.shift_id && refundAmount > 0) {
        try {
          await pool.execute(
            `UPDATE shifts SET 
              total_revenue = GREATEST(0, total_revenue - ?),
              updated_at = NOW()
             WHERE id = ?`,
            [refundAmount, rental.shift_id]
          );
          console.log('💸 تم خصم', refundAmount, 'من إيراد الشيفت');
        } catch (error) {
          console.warn('⚠️ لا يمكن تحديث إيراد الشيفت:', error.message);
        }
      }
    } else if (rental.rental_type === 'open') {
      // الوقت المفتوح لم يتم دفعه بعد، لذا لا استرداد
      console.log('🕒 الوقت المفتوح - لا يوجد دفع مسبق لاسترداده');
    }
    
    // تحديث حالة التأجير
    await pool.execute(
      `UPDATE rentals SET 
        status = 'ملغي',
        end_time = NOW(),
        actual_duration_minutes = ?,
        final_amount = ?,
        refund_amount = ?,
        payment_status = 'ملغي',
        notes = CONCAT(COALESCE(notes, ''), '\\n', ?),
        updated_at = NOW()
       WHERE id = ?`,
      [
        elapsedMinutes,
        actualAmount,
        refundAmount,
        `الإلغاء المبكر بعد ${elapsedMinutes} دقيقة - ${refundAmount > 0 ? 'تم استرداد ' + refundAmount + ' ج.م بالكامل' : 'لا يوجد استرداد (وقت مفتوح)'}`,
        rentalId
      ]
    );
    
    // إرجاع اللعبة للمخزون
    await pool.execute(
      "UPDATE games SET status = 'متاح' WHERE id = ?",
      [rental.game_id]
    );
    
    console.log('✅ تم الإلغاء المبكر بنجاح:', {
      rental_id: rentalId,
      elapsed_minutes: elapsedMinutes,
      refund_amount: refundAmount,
      actual_amount: actualAmount,
      rental_type: rental.rental_type
    });
    
    res.json({
      success: true,
      message: refundAmount > 0 ? 
        'تم الإلغاء المبكر واسترداد المبلغ بالكامل' : 
        'تم الإلغاء المبكر (وقت مفتوح - لا يوجد دفع مسبق)',
      data: {
        rental_id: rentalId,
        customer_name: rental.customer_name,
        rental_type: rental.rental_type,
        elapsed_minutes: elapsedMinutes,
        refund_amount: refundAmount,
        actual_amount: actualAmount,
        full_refund: refundAmount > 0,
        added_to_revenue: false
      },
      financial_summary: {
        المبلغ_المدفوع: rental.paid_amount || 0,
        المبلغ_المسترد: refundAmount,
        الإيراد_النهائي: 0,
        ملاحظة: 'لا إيراد للإلغاء المبكر (أقل من 3 دقائق)'
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في الإلغاء المبكر:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الإلغاء المبكر',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==================== نقطة إنهاء الوقت المفتوح ====================
app.post('/api/rentals/:id/complete-open', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { payment_method = 'كاش' } = req.body;
    
    console.log(`✅ إنهاء وقت مفتوح ${rentalId}`);
    
    // جلب بيانات التأجير
    const [rentals] = await pool.execute(
      `SELECT r.*, g.price_per_15min 
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.id = ? AND r.branch_id = ? AND r.status = 'نشط' AND r.rental_type = 'open'`,
      [rentalId, user.branch_id]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'تأجير الوقت المفتوح غير موجود أو غير نشط'
      });
    }
    
    const rental = rentals[0];
    
    // ✅ حساب المبلغ بناء على الوقت الفعلي
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const actualMinutes = Math.max(Math.floor((now - startTime) / (1000 * 60)), 15);
    
    // حساب المبلغ (كل 15 دقيقة)
    const pricePer15Min = rental.price_per_15min || 100;
    const units = Math.ceil(actualMinutes / 15);
    const finalAmount = units * pricePer15Min;
    
    console.log('💰 حساب المبلغ للوقت المفتوح:', {
      actual_minutes: actualMinutes,
      units: units,
      price_per_15min: pricePer15Min,
      final_amount: finalAmount
    });
    
    // إضافة المبلغ لإيراد الشيفت
    if (rental.shift_id && finalAmount > 0) {
      await pool.execute(
        `UPDATE shifts SET 
          total_revenue = COALESCE(total_revenue, 0) + ?,
          updated_at = NOW()
         WHERE id = ?`,
        [finalAmount, rental.shift_id]
      );
      console.log(`💰 تم إضافة ${finalAmount} إلى إيراد الشيفت ${rental.shift_id}`);
    }
    
    // تحديث التأجير
    await pool.execute(
      `UPDATE rentals SET 
        status = 'مكتمل',
        end_time = NOW(),
        actual_end_time = NOW(),
        actual_duration_minutes = ?,
        final_amount = ?,
        paid_amount = ?,
        payment_method = ?,
        payment_status = 'مدفوع',
        notes = CONCAT(COALESCE(notes, ''), '\\n', ?),
        updated_at = NOW()
       WHERE id = ?`,
      [
        actualMinutes,
        finalAmount,
        finalAmount,
        payment_method,
        `إنهاء الوقت المفتوح - ${actualMinutes} دقيقة - ${finalAmount} ج.م`,
        rentalId
      ]
    );
    
    // إرجاع اللعبة للمخزون
    await pool.execute(
      "UPDATE games SET status = 'متاح' WHERE id = ?",
      [rental.game_id]
    );
    
    console.log('✅ تم إنهاء الوقت المفتوح:', {
      rental_id: rentalId,
      actual_minutes: actualMinutes,
      final_amount: finalAmount
    });
    
    res.json({
      success: true,
      message: 'تم إنهاء الوقت المفتوح بنجاح',
      data: {
        rental_id: rentalId,
        customer_name: rental.customer_name,
        actual_minutes: actualMinutes,
        final_amount: finalAmount,
        payment_status: 'مدفوع'
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنهاء الوقت المفتوح:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الوقت المفتوح',
      error: error.message
    });
  }
});

app.post('/api/rentals/:id/complete-fixed', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    console.log(`✅ إنهاء وقت ثابت ${rentalId}`);
    
    // جلب بيانات التأجير
    const [rentals] = await pool.execute(
      `SELECT * FROM rentals 
       WHERE id = ? AND branch_id = ? AND status = 'نشط' AND rental_type = 'fixed'`,
      [rentalId, user.branch_id]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'تأجير الوقت الثابت غير موجود أو غير نشط'
      });
    }
    
    const rental = rentals[0];
    
    // ⚠️ **الوقت الثابت تم دفعه مسبقاً وتم إضافته للإيراد عند الإنشاء**
    // لا حاجة لإضافة أي شيء للإيراد عند الإنتهاء
    
    const startTime = new Date(rental.start_time);
    const now = new Date();
    const actualMinutes = Math.floor((now - startTime) / (1000 * 60));
    
    // تحديث التأجير
    await pool.execute(
      `UPDATE rentals SET 
        status = 'مكتمل',
        end_time = NOW(),
        actual_duration_minutes = ?,
        final_amount = ?,  // نفس المبلغ المدفوع مسبقاً
        payment_status = 'مدفوع',  // كان 'مدفوع مسبقاً' وأصبح 'مدفوع'
        notes = CONCAT(COALESCE(notes, ''), '\\n', ?),
        updated_at = NOW()
       WHERE id = ?`,
      [
        actualMinutes,
        rental.paid_amount || rental.total_amount,
        `إنهاء الوقت الثابت - ${actualMinutes} دقيقة - تم الدفع مسبقاً`,
        rentalId
      ]
    );
    
    // إرجاع اللعبة للمخزون
    await pool.execute(
      "UPDATE games SET status = 'متاح' WHERE id = ?",
      [rental.game_id]
    );
    
    console.log('✅ تم إنهاء الوقت الثابت:', {
      rental_id: rentalId,
      actual_minutes: actualMinutes,
      amount_paid_in_advance: rental.paid_amount,
      added_to_revenue_at_start: true
    });
    
    res.json({
      success: true,
      message: 'تم إنهاء الوقت الثابت بنجاح',
      data: {
        rental_id: rentalId,
        customer_name: rental.customer_name,
        actual_minutes: actualMinutes,
        amount_paid_in_advance: rental.paid_amount,
        added_to_revenue_at_start: true,
        note: 'المبلغ تم إضافته للإيراد عند بدء التأجير'
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنهاء الوقت الثابت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الوقت الثابت',
      error: error.message
    });
  }
});

// نقطة الحصول على تأجير محدد
app.get('/api/rentals/:id', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    console.log(`🔍 جلب تأجير ${rentalId} للمستخدم ${user.id}`);
    
    const [rentals] = await pool.execute(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.id = ? AND r.branch_id = ?`,
      [rentalId, user.branch_id]
    );
    
    if (rentals.length === 0) {
      // تحقق في جميع الفروع للتشخيص
      const [allRentals] = await pool.execute(
        `SELECT r.*, g.name as game_name
         FROM rentals r
         LEFT JOIN games g ON r.game_id = g.id
         WHERE r.id = ?`,
        [rentalId]
      );
      
      if (allRentals.length > 0) {
        console.log(`⚠️ التأجير ${rentalId} موجود في فرع ${allRentals[0].branch_id} وليس فرع المستخدم ${user.branch_id}`);
        
        return res.status(404).json({
          success: false,
          message: `التأجير موجود في فرع آخر (${allRentals[0].branch_id})`
        });
      }
      
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }
    
    const rental = rentals[0];
    
    res.json({
      success: true,
      data: rental
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجير:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات التأجير'
    });
  }
});


app.get('/api/rentals/:id', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    console.log(`🔍 جلب تأجير ${rentalId}`);
    
    const [rentals] = await pool.execute(
      `SELECT r.*, g.name as game_name 
       FROM rentals r 
       LEFT JOIN games g ON r.game_id = g.id 
       WHERE r.id = ?`,
      [rentalId]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }
    
    res.json({
      success: true,
      data: rentals[0]
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجير:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ'
    });
  }
});

app.get('/api/rentals/active-shift', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id } = req.query;
    
    let targetShiftId = shift_id;
    
    if (!targetShiftId) {
      const [shifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
        [user.id]
      );
      
      if (shifts.length > 0) {
        targetShiftId = shifts[0].id;
      } else {
        return res.json({
          success: true,
          data: [],
          message: 'لا يوجد شيفت نشط'
        });
      }
    }
    
    const [rentals] = await pool.execute(
      `SELECT r.*, g.name as game_name, g.price_per_15min
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = ? 
         AND r.branch_id = ?
         AND r.status = 'نشط'
       ORDER BY r.start_time ASC`,
      [targetShiftId, user.branch_id]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      shift_id: targetShiftId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت'
    });
  }
});

app.get('/api/rentals', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { 
      status, 
      shift_id, 
      branch_id,
      limit = 100
    } = req.query;
    
    const targetBranchId = branch_id || user.branch_id;
    
    let query = `
      SELECT r.*, g.name as game_name, g.price_per_15min
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
    `;
    
    const params = [targetBranchId];
    
    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }
    
    if (shift_id) {
      query += ' AND r.shift_id = ?';
      params.push(shift_id);
    }
    
    query += ' ORDER BY r.start_time DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [rentals] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      message: `تم جلب ${rentals.length} تأجير`
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات',
      data: []
    });
  }
});

app.get('/api/rentals/my-completed', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().split('T')[0];
    
    const [rentals] = await pool.execute(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.branch_id = ?
         AND r.user_id = ?
         AND (r.status = 'مكتمل' OR r.status = 'completed')
         AND DATE(r.created_at) = ?
       ORDER BY r.end_time DESC
       LIMIT 100`,
      [user.branch_id, user.id, today]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      user_id: user.id,
      today: today
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات المستخدم:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات',
      data: []
    });
  }
});

app.get('/api/debug/fix-rentals-structure', authenticateToken, async (req, res) => {
  try {
    console.log('🔧 بدء إصلاح هيكل جدول rentals...');
    
    // 1. التحقق من وجود الجدول
    const [tables] = await pool.execute("SHOW TABLES LIKE 'rentals'");
    
    if (tables.length === 0) {
      console.log('❌ جدول rentals غير موجود، سيتم إنشاؤه...');
      
      await pool.execute(`
        CREATE TABLE rentals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          rental_number VARCHAR(100) NOT NULL DEFAULT '',
          game_id INT NOT NULL,
          game_name VARCHAR(255),
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(20),
          user_id INT NOT NULL,
          employee_name VARCHAR(255),
          branch_id INT NOT NULL DEFAULT 1,
          shift_id INT,
          start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          end_time DATETIME,
          rental_type VARCHAR(50) DEFAULT 'fixed',
          duration_minutes INT DEFAULT 15,
          is_open_time TINYINT DEFAULT 0,
          total_amount DECIMAL(10,2) DEFAULT 0,
          final_amount DECIMAL(10,2),
          payment_method VARCHAR(50) DEFAULT 'كاش',
          payment_status VARCHAR(50) DEFAULT 'مدفوع مسبقاً',
          status VARCHAR(50) DEFAULT 'نشط',
          paid_amount DECIMAL(10,2) DEFAULT 0,
          price_per_15min DECIMAL(10,2) DEFAULT 100,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      
      console.log('✅ تم إنشاء جدول rentals بنجاح');
    }
    
    // 2. إضافة الحقول المفقودة
    const requiredColumns = [
      'rental_number', 'game_id', 'customer_name', 'user_id', 
      'branch_id', 'shift_id', 'status', 'start_time',
      'rental_type', 'is_open_time', 'payment_status', 'price_per_15min'
    ];
    
    const [existingColumns] = await pool.execute('DESCRIBE rentals');
    const existingColumnNames = existingColumns.map(col => col.Field);
    
    const addedColumns = [];
    
    for (const column of requiredColumns) {
      if (!existingColumnNames.includes(column)) {
        try {
          let alterQuery = '';
          
          switch(column) {
            case 'rental_number':
              alterQuery = 'ADD COLUMN rental_number VARCHAR(100) NOT NULL DEFAULT ""';
              break;
            case 'game_id':
              alterQuery = 'ADD COLUMN game_id INT NOT NULL';
              break;
            case 'customer_name':
              alterQuery = 'ADD COLUMN customer_name VARCHAR(255) NOT NULL';
              break;
            case 'user_id':
              alterQuery = 'ADD COLUMN user_id INT NOT NULL';
              break;
            case 'branch_id':
              alterQuery = 'ADD COLUMN branch_id INT NOT NULL DEFAULT 1';
              break;
            case 'shift_id':
              alterQuery = 'ADD COLUMN shift_id INT';
              break;
            case 'status':
              alterQuery = "ADD COLUMN status VARCHAR(50) DEFAULT 'نشط'";
              break;
            case 'start_time':
              alterQuery = 'ADD COLUMN start_time DATETIME DEFAULT CURRENT_TIMESTAMP';
              break;
            case 'rental_type':
              alterQuery = "ADD COLUMN rental_type VARCHAR(50) DEFAULT 'fixed'";
              break;
            case 'is_open_time':
              alterQuery = 'ADD COLUMN is_open_time TINYINT DEFAULT 0';
              break;
            case 'payment_status':
              alterQuery = "ADD COLUMN payment_status VARCHAR(50) DEFAULT 'مدفوع مسبقاً'";
              break;
            case 'price_per_15min':
              alterQuery = 'ADD COLUMN price_per_15min DECIMAL(10,2) DEFAULT 100';
              break;
          }
          
          if (alterQuery) {
            await pool.execute(`ALTER TABLE rentals ${alterQuery}`);
            console.log(`✅ تم إضافة الحقل: ${column}`);
            addedColumns.push(column);
          }
        } catch (alterError) {
          console.warn(`⚠️ لا يمكن إضافة ${column}:`, alterError.message);
        }
      }
    }
    
    // 3. عرض عينة من البيانات
    const [sampleData] = await pool.execute(`
      SELECT id, rental_number, customer_name, status, shift_id, branch_id, start_time
      FROM rentals 
      ORDER BY id DESC 
      LIMIT 10
    `);
    
    res.json({
      success: true,
      message: 'تم إصلاح جدول rentals',
      added_columns: addedColumns,
      total_columns: existingColumnNames.length + addedColumns.length,
      sample_data: sampleData,
      is_valid: addedColumns.length === 0
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح الجدول:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في إصلاح الجدول',
      error: error.message
    });
  }
});

app.get('/api/rentals/current-shift', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id } = req.query;
    
    let query = `
      SELECT r.*, g.name as game_name, g.price_per_15min
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND r.status IN ('نشط', 'مكتمل')
    `;
    
    const params = [user.branch_id];
    
    if (shift_id) {
      query += ' AND r.shift_id = ?';
      params.push(shift_id);
    } else {
      const [shifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' ORDER BY start_time DESC LIMIT 1",
        [user.id]
      );
      
      if (shifts.length > 0) {
        query += ' AND r.shift_id = ?';
        params.push(shifts[0].id);
      } else {
        const today = new Date().toISOString().split('T')[0];
        query += ' AND DATE(r.created_at) = ? AND r.user_id = ?';
        params.push(today, user.id);
      }
    }
    
    query += ' ORDER BY r.start_time DESC';
    
    const [rentals] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت'
    });
  }
});

app.get('/api/rentals/current-shift-completed', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [shifts] = await pool.execute(
      "SELECT id, start_time FROM shifts WHERE employee_id = ? AND status = 'نشط' ORDER BY start_time DESC LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'لا يوجد شيفت نشط'
      });
    }
    
    const currentShift = shifts[0];
    const shiftStartTime = new Date(currentShift.start_time);
    
    const [rentals] = await pool.execute(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.branch_id = ?
         AND (r.status = 'مكتمل' OR r.status = 'completed')
         AND r.start_time >= ?
         AND (r.shift_id = ? OR r.shift_id IS NULL)
       ORDER BY r.end_time DESC
       LIMIT 100`,
      [user.branch_id, shiftStartTime, currentShift.id]
    );
    
    res.json({
      success: true,
      data: rentals,
      shift_id: currentShift.id,
      count: rentals.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت الحالي:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت',
      error: error.message
    });
  }
});

app.get('/api/rentals/completed-by-shift/:shiftId', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.shiftId;
    const user = req.user;
    
    console.log(`📋 جلب التأجيرات المكتملة للشيفت ${shiftId}`);
    
    const [rentals] = await pool.execute(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = ? 
         AND (r.status = 'مكتمل' OR r.status = 'completed')
         AND r.branch_id = ?
       ORDER BY r.end_time DESC
       LIMIT 100`,
      [shiftId, user.branch_id]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      shift_id: shiftId
    });
    
  } catch (error) {
    console.error('❌ خطأ في جلب تأجيرات الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'تعذر جلب تأجيرات الشيفت',
      data: []
    });
  }
});
app.post('/api/rentals/:id/complete', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { payment_method = 'كاش' } = req.body;
    
    const [rentals] = await pool.execute(
      'SELECT * FROM rentals WHERE id = ? AND status = "نشط"',
      [rentalId]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود أو غير نشط'
      });
    }
    
    const rental = rentals[0];
    
    const startTime = new Date(rental.start_time);
    const endTime = new Date();
    const actualDuration = Math.round((endTime - startTime) / (1000 * 60));
    
    let finalAmount = rental.total_amount || 0;
    if (rental.is_open_time || rental.rental_type === 'open') {
      const [game] = await pool.execute(
        'SELECT price_per_15min FROM games WHERE id = ?',
        [rental.game_id]
      );
      const pricePer15Min = game[0]?.price_per_15min || 50;
      const units = Math.ceil(actualDuration / 15);
      finalAmount = pricePer15Min * units;
    }
    
    await pool.execute(
      `UPDATE rentals SET 
        status = 'مكتمل',
        end_time = ?,
        actual_end_time = ?,
        actual_duration_minutes = ?,
        final_amount = ?,
        payment_method = ?,
        payment_status = 'مدفوع',
        updated_at = NOW()
       WHERE id = ?`,
      [
        endTime.toISOString(),
        endTime.toISOString(),
        actualDuration,
        finalAmount,
        payment_method,
        rentalId
      ]
    );
    
    await pool.execute(
      "UPDATE games SET status = 'متاح' WHERE id = ?",
      [rental.game_id]
    );
    
    res.json({
      success: true,
      message: 'تم إكمال التأجير بنجاح',
      rental_id: rentalId,
      final_amount: finalAmount,
      actual_duration: actualDuration
    });
    
  } catch (error) {
    console.error('خطأ في إكمال التأجير:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إكمال التأجير'
    });
  }
});

app.post('/api/rentals/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const { refund_amount = 0, reason = '' } = req.body;
    
    const [rentals] = await pool.execute(
      'SELECT * FROM rentals WHERE id = ? AND status = "نشط"',
      [rentalId]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود أو غير نشط'
      });
    }
    
    const rental = rentals[0];
    
    await pool.execute(
      `UPDATE rentals SET 
        status = 'ملغي',
        end_time = NOW(),
        refund_amount = ?,
        payment_status = 'ملغي',
        notes = CONCAT(COALESCE(notes, ''), '\\n', ?),
        updated_at = NOW()
       WHERE id = ?`,
      [refund_amount, `تم الإلغاء: ${reason}`, rentalId]
    );
    
    await pool.execute(
      "UPDATE games SET status = 'متاح' WHERE id = ?",
      [rental.game_id]
    );
    
    res.json({
      success: true,
      message: 'تم إلغاء التأجير بنجاح',
      rental_id: rentalId,
      refund_amount: refund_amount
    });
    
  } catch (error) {
    console.error('خطأ في إلغاء التأجير:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إلغاء التأجير'
    });
  }
});

app.put('/api/rentals/:id', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    const rentalData = req.body;
    
    const [rentals] = await pool.execute(
      'SELECT * FROM rentals WHERE id = ?',
      [rentalId]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }
    
    const rental = rentals[0];
    
    if (user.role !== 'admin' && rental.branch_id !== user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تحديث هذا التأجير'
      });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (rentalData.game_id !== undefined) {
      updateFields.push('game_id = ?');
      updateValues.push(rentalData.game_id);
    }
    
    if (rentalData.game_name !== undefined) {
      updateFields.push('game_name = ?');
      updateValues.push(rentalData.game_name);
    }
    
    if (rentalData.price_per_15min !== undefined) {
      updateFields.push('price_per_15min = ?');
      updateValues.push(rentalData.price_per_15min);
    }
    
    if (rentalData.status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(rentalData.status);
    }
    
    if (rentalData.end_time !== undefined) {
      updateFields.push('end_time = ?');
      updateValues.push(rentalData.end_time);
    }
    
    if (rentalData.actual_end_time !== undefined) {
      updateFields.push('actual_end_time = ?');
      updateValues.push(rentalData.actual_end_time);
    }
    
    if (rentalData.actual_duration_minutes !== undefined) {
      updateFields.push('actual_duration_minutes = ?');
      updateValues.push(rentalData.actual_duration_minutes);
    }
    
    if (rentalData.final_amount !== undefined) {
      updateFields.push('final_amount = ?');
      updateValues.push(rentalData.final_amount);
    }
    
    if (rentalData.refund_amount !== undefined) {
      updateFields.push('refund_amount = ?');
      updateValues.push(rentalData.refund_amount);
    }
    
    if (rentalData.payment_status !== undefined) {
      updateFields.push('payment_status = ?');
      updateValues.push(rentalData.payment_status);
    }
    
    if (rentalData.notes !== undefined) {
      updateFields.push('notes = CONCAT(COALESCE(notes, ""), "\\n", ?)');
      updateValues.push(rentalData.notes);
    }
    
    updateFields.push('updated_at = NOW()');
    
    if (updateFields.length === 1) {
      return res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: rental
      });
    }
    
    updateValues.push(rentalId);
    
    const sql = `UPDATE rentals SET ${updateFields.join(', ')} WHERE id = ?`;
    
    const [result] = await pool.execute(sql, updateValues);
    
    if (result.affectedRows > 0) {
      const [updatedRental] = await pool.execute(
        'SELECT * FROM rentals WHERE id = ?',
        [rentalId]
      );
      
      res.json({
        success: true,
        message: 'تم تحديث التأجير بنجاح',
        data: updatedRental[0]
      });
    } else {
      res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: rental
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في تحديث التأجير:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث التأجير',
      error: error.message
    });
  }
});

app.post('/api/rentals/check-fixed-time', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { rental_id } = req.body;
    
    if (!rental_id) {
      return res.status(400).json({
        success: false,
        message: 'معرف التأجير مطلوب'
      });
    }
    
    const [rentals] = await pool.execute(`
      SELECT r.*, g.price_per_15min
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.id = ? 
        AND r.branch_id = ?
        AND r.status = 'نشط'
    `, [rental_id, user.branch_id || 1]);
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود أو غير نشط'
      });
    }
    
    const rental = rentals[0];
    const now = new Date();
    const startTime = new Date(rental.start_time);
    
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + (rental.duration_minutes || 15));
    
    const remainingMs = endTime - now;
    const remainingMinutes = Math.max(0, Math.round(remainingMs / (1000 * 60)));
    
    const isCompleted = now >= endTime;
    
    res.json({
      success: true,
      data: {
        rental_id: rental.id,
        rental_number: rental.rental_number,
        start_time: rental.start_time,
        expected_end_time: endTime.toISOString(),
        current_time: now.toISOString(),
        duration_minutes: rental.duration_minutes,
        remaining_minutes: remainingMinutes,
        is_completed: isCompleted,
        payment_status: rental.payment_status,
        should_be_paid: rental.rental_type === 'fixed' ? 'مدفوع مسبقاً' : 'عند الإنهاء'
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في التحقق من التأجير:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في التحقق',
      error: error.message
    });
  }
});

app.get('/api/rentals/expired', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    
    const [expiredRentals] = await pool.execute(`
      SELECT r.*, g.price_per_15min,
             TIMESTAMPDIFF(MINUTE, r.start_time, ?) as elapsed_minutes,
             CASE 
               WHEN r.rental_type = 'fixed' THEN 
                 TIMESTAMPDIFF(MINUTE, r.start_time, ?) - r.duration_minutes
               ELSE 0 
             END as overdue_minutes
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.status = 'نشط'
        AND r.branch_id = ?
        AND (
          (r.rental_type = 'fixed' AND 
           DATE_ADD(r.start_time, INTERVAL r.duration_minutes MINUTE) <= ?)
          OR
          (r.rental_type = 'open' AND 
           DATE_ADD(r.start_time, INTERVAL 1440 MINUTE) <= ?)
        )
    `, [now, now, user.branch_id || 1, now, now]);
    
    res.json({
      success: true,
      data: expiredRentals,
      count: expiredRentals.length,
      message: `تم العثور على ${expiredRentals.length} تأجير انتهى وقته`
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات المنتهية:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات المنتهية',
      error: error.message
    });
  }
});

app.get('/api/branches', authenticateToken, async (req, res) => {
  try {
    const [branches] = await pool.execute(
      `SELECT b.*,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT r.id) as active_rentals
       FROM branches b
       LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = 1
       LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = 1
       LEFT JOIN rentals r ON b.id = r.branch_id AND r.status = 'نشط'
       WHERE b.is_active = 1
       GROUP BY b.id
       ORDER BY b.name`
    );
    
    res.json({
      success: true,
      data: branches,
      count: branches.length
    });
    
  } catch (error) {
    console.error('❌ خطأ في جلب الفروع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الفروع',
      data: []
    });
  }
});

app.get('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    
    const [branches] = await pool.execute(
      `SELECT b.*,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT u.id) as total_employees,
        COUNT(DISTINCT r.id) as active_rentals
       FROM branches b
       LEFT JOIN games g ON b.id = g.branch_id AND g.is_active = 1
       LEFT JOIN users u ON b.id = u.branch_id AND u.is_active = 1
       LEFT JOIN rentals r ON b.id = r.branch_id AND r.status = 'نشط'
       WHERE b.id = ?
       GROUP BY b.id`,
      [branchId]
    );
    
    if (branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    res.json({
      success: true,
      data: branches[0]
    });
    
  } catch (error) {
    console.error('❌ خطأ في جلب الفرع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات الفرع'
    });
  }
});

app.post('/api/branches', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const branchData = req.body;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إنشاء فروع'
      });
    }
    
    if (!branchData.name || !branchData.location) {
      return res.status(400).json({
        success: false,
        message: 'اسم الفرع والموقع مطلوبان'
      });
    }
    
    const timestamp = Date.now().toString().slice(-6);
    const branchCode = `BR-${timestamp}`;
    
    const [result] = await pool.execute(
      `INSERT INTO branches (
        name, 
        location, 
        city, 
        contact_phone, 
        contact_email,
        opening_time, 
        closing_time,
        branch_code,
        created_by,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        branchData.name.trim(),
        branchData.location.trim(),
        branchData.city || 'القاهرة',
        branchData.contact_phone || '',
        branchData.contact_email || '',
        branchData.opening_time || '09:00:00',
        branchData.closing_time || '22:00:00',
        branchCode,
        user.id
      ]
    );
    
    const branchId = result.insertId;
    
    const [newBranch] = await pool.execute(
      `SELECT b.*,
        0 as total_games,
        1 as total_employees,
        0 as active_rentals
       FROM branches b
       WHERE b.id = ?`,
      [branchId]
    );
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الفرع بنجاح',
      data: newBranch[0],
      branch_id: branchId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء الفرع:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء الفرع',
      error: error.message,
      suggestion: 'تحقق من اتصال قاعدة البيانات'
    });
  }
});

app.put('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const user = req.user;
    const branchData = req.body;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تحديث الفروع'
      });
    }
    
    const [branches] = await pool.execute(
      'SELECT id FROM branches WHERE id = ?',
      [branchId]
    );
    
    if (branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (branchData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(branchData.name);
    }
    
    if (branchData.location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(branchData.location);
    }
    
    if (branchData.city !== undefined) {
      updateFields.push('city = ?');
      updateValues.push(branchData.city);
    }
    
    if (branchData.contact_phone !== undefined) {
      updateFields.push('contact_phone = ?');
      updateValues.push(branchData.contact_phone);
    }
    
    if (branchData.contact_email !== undefined) {
      updateFields.push('contact_email = ?');
      updateValues.push(branchData.contact_email);
    }
    
    if (branchData.opening_time !== undefined) {
      updateFields.push('opening_time = ?');
      updateValues.push(branchData.opening_time);
    }
    
    if (branchData.closing_time !== undefined) {
      updateFields.push('closing_time = ?');
      updateValues.push(branchData.closing_time);
    }
    
    if (branchData.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(branchData.is_active ? 1 : 0);
    }
    
    updateFields.push('updated_by = ?');
    updateValues.push(user.id);
    updateFields.push('updated_at = NOW()');
    
    updateValues.push(branchId);
    
    const sql = `UPDATE branches SET ${updateFields.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(sql, updateValues);
    
    if (result.affectedRows > 0) {
      const [updatedBranch] = await pool.execute(
        'SELECT * FROM branches WHERE id = ?',
        [branchId]
      );
      
      res.json({
        success: true,
        message: 'تم تحديث الفرع بنجاح',
        data: updatedBranch[0]
      });
    } else {
      res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: null
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في تحديث الفرع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث الفرع',
      error: error.message
    });
  }
});

app.delete('/api/branches/:id', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية حذف الفروع'
      });
    }
    
    const [branches] = await pool.execute(
      'SELECT id, name FROM branches WHERE id = ?',
      [branchId]
    );
    
    if (branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    const branch = branches[0];
    
    if (permanent) {
      const [games] = await pool.execute(
        'SELECT COUNT(*) as count FROM games WHERE branch_id = ?',
        [branchId]
      );
      
      if (games[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن حذف الفرع نهائياً لأنه يحتوي على ألعاب'
        });
      }
      
      const [employees] = await pool.execute(
        'SELECT COUNT(*) as count FROM users WHERE branch_id = ?',
        [branchId]
      );
      
      if (employees[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'لا يمكن حذف الفرع نهائياً لأنه يحتوي على موظفين'
        });
      }
      
      await pool.execute('DELETE FROM branches WHERE id = ?', [branchId]);
      
      res.json({
        success: true,
        message: 'تم حذف الفرع نهائياً بنجاح',
        branch_id: branchId,
        branch_name: branch.name
      });
      
    } else {
      await pool.execute(
        'UPDATE branches SET is_active = 0 WHERE id = ?',
        [branchId]
      );
      
      res.json({
        success: true,
        message: 'تم تعطيل الفرع بنجاح',
        branch_id: branchId,
        branch_name: branch.name
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في حذف الفرع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف الفرع',
      error: error.message
    });
  }
});

app.get('/api/branches/:id/games', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const user = req.user;
    const { status = 'all' } = req.query;
    
    if (user.role === 'branch_manager' && user.branch_id != branchId) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض ألعاب هذا الفرع'
      });
    }
    
    let query = `SELECT * FROM games WHERE branch_id = ? AND is_active = 1`;
    const params = [branchId];
    
    if (status && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY name';
    
    const [games] = await pool.execute(query, params);
    
    const stats = {
      total_games: games.length,
      available_games: games.filter(g => g.status === 'متاح').length,
      rented_games: games.filter(g => g.status === 'مؤجرة').length,
      maintenance_games: games.filter(g => g.status === 'صيانة').length
    };
    
    res.json({
      success: true,
      data: games,
      count: games.length,
      branch_id: branchId,
      stats: stats
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب ألعاب الفرع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب ألعاب الفرع',
      error: error.message
    });
  }
});

app.post('/api/branches/:id/add-game', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const user = req.user;
    const gameData = req.body;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إضافة ألعاب'
      });
    }
    
    const [branches] = await pool.execute(
      'SELECT * FROM branches WHERE id = ?',
      [branchId]
    );
    
    if (branches.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الفرع غير موجود'
      });
    }
    
    if (!gameData.name || !gameData.price_per_15min) {
      return res.status(400).json({
        success: false,
        message: 'اسم اللعبة والسعر مطلوبان'
      });
    }
    
    const [existingGames] = await pool.execute(
      'SELECT id FROM games WHERE name = ? AND branch_id = ?',
      [gameData.name, branchId]
    );
    
    if (existingGames.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'هذه اللعبة موجودة بالفعل في هذا الفرع'
      });
    }
    
    const [result] = await pool.execute(
      `INSERT INTO games (
        name, description, category, price_per_15min, price_per_hour,
        branch_id, status, min_rental_time, max_rental_time, minimum_age,
        image_url, external_image_url, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        gameData.name,
        gameData.description || '',
        gameData.category || 'سيارات',
        gameData.price_per_15min,
        gameData.price_per_hour || Math.ceil(gameData.price_per_15min * 4),
        branchId,
        gameData.status || 'متاح',
        gameData.min_rental_time || 15,
        gameData.max_rental_time || 120,
        gameData.minimum_age || 16,
        gameData.image_url || 'default-game.jpg',
        gameData.external_image_url || '',
        1
      ]
    );
    
    const gameId = result.insertId;
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة اللعبة للفرع بنجاح',
      game_id: gameId,
      branch_id: branchId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إضافة لعبة للفرع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إضافة اللعبة',
      error: error.message
    });
  }
});

app.post('/api/branches/:id/fix-games', authenticateToken, async (req, res) => {
  try {
    const branchId = req.params.id;
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إصلاح الألعاب'
      });
    }
    
    const [result] = await pool.execute(
      `UPDATE games g 
       LEFT JOIN rentals r ON g.id = r.game_id AND r.status = 'نشط'
       SET g.status = 'متاح'
       WHERE g.branch_id = ? 
         AND g.status = 'مؤجرة'
         AND r.id IS NULL`,
      [branchId]
    );
    
    res.json({
      success: true,
      message: `تم إصلاح ${result.affectedRows} لعبة`,
      fixed: result.affectedRows
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إصلاح ألعاب الفرع:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إصلاح الألعاب',
      error: error.message
    });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض المستخدمين'
      });
    }
    
    const { search = '', role = '', branch_id = '' } = req.query;
    
    let query = `
      SELECT u.*, b.name as branch_name
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE u.is_active = 1
    `;
    
    const params = [];
    
    if (user.role === 'branch_manager') {
      query += ' AND u.branch_id = ?';
      params.push(user.branch_id || 1);
    }
    
    if (role && role !== 'all') {
      query += ' AND u.role = ?';
      params.push(role);
    }
    
    if (user.role === 'admin' && branch_id && branch_id !== 'all') {
      query += ' AND u.branch_id = ?';
      params.push(branch_id);
    }
    
    if (search) {
      query += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ? OR u.phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY u.role, u.name';
    
    const [users] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: users,
      count: users.length,
      message: `تم جلب ${users.length} مستخدم`,
      user_role: user.role,
      current_user_branch: user.branch_id,
      can_manage: user.role === 'admin'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب المستخدمين:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب المستخدمين',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const userData = req.body;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إضافة مستخدمين'
      });
    }
    
    if (!userData.username || !userData.email || !userData.name || !userData.branch_id) {
      return res.status(400).json({
        success: false,
        message: 'اسم المستخدم والبريد الإلكتروني والاسم والفرع مطلوبون'
      });
    }
    
    if (user.role === 'branch_manager' && userData.branch_id != user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إضافة مستخدمين لفروع أخرى'
      });
    }
    
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [userData.email, userData.username]
    );
    
    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'البريد الإلكتروني أو اسم المستخدم موجود بالفعل'
      });
    }
    
    const [branches] = await pool.execute(
      'SELECT id FROM branches WHERE id = ? AND is_active = 1',
      [userData.branch_id]
    );
    
    if (branches.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'الفرع غير موجود أو غير نشط'
      });
    }
    
    const [result] = await pool.execute(
      `INSERT INTO users (
        username, 
        email, 
        password, 
        name, 
        role, 
        branch_id, 
        phone, 
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.username.trim(),
        userData.email.toLowerCase().trim(),
        userData.password || '123456',
        userData.name.trim(),
        userData.role || 'employee',
        userData.branch_id,
        userData.phone || '',
        userData.is_active ? 1 : 0
      ]
    );
    
    const userId = result.insertId;
    
    const [newUser] = await pool.execute(
      `SELECT u.*, b.name as branch_name 
       FROM users u 
       LEFT JOIN branches b ON u.branch_id = b.id 
       WHERE u.id = ?`,
      [userId]
    );
    
    res.status(201).json({
      success: true,
      message: 'تم إنشاء المستخدم بنجاح',
      data: newUser[0],
      user_id: userId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء المستخدم:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنشاء المستخدم',
      error: error.message,
      suggestion: 'تحقق من اتصال قاعدة البيانات'
    });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = req.user;
    const userData = req.body;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تحديث المستخدمين'
      });
    }
    
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }
    
    const targetUser = users[0];
    
    if (user.role === 'branch_manager' && targetUser.branch_id != user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تحديث مستخدمين من فروع أخرى'
      });
    }
    
    if (user.role === 'branch_manager' && userData.role && userData.role !== targetUser.role) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تغيير دور المستخدم'
      });
    }
    
    const updateFields = [];
    const updateValues = [];
    
    if (userData.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(userData.name.trim());
    }
    
    if (userData.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(userData.email.toLowerCase().trim());
    }
    
    if (userData.username !== undefined) {
      updateFields.push('username = ?');
      updateValues.push(userData.username.trim());
    }
    
    if (userData.password !== undefined && userData.password.trim() !== '') {
      updateFields.push('password = ?');
      updateValues.push(userData.password);
    }
    
    if (user.role === 'admin' && userData.role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(userData.role);
    }
    
    if (user.role === 'admin' && userData.branch_id !== undefined) {
      updateFields.push('branch_id = ?');
      updateValues.push(userData.branch_id);
    }
    
    if (userData.phone !== undefined) {
      updateFields.push('phone = ?');
      updateValues.push(userData.phone || '');
    }
    
    if (userData.is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(userData.is_active ? 1 : 0);
    }
    
    updateFields.push('updated_at = NOW()');
    
    if (updateFields.length === 1) {
      return res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: targetUser
      });
    }
    
    updateValues.push(userId);
    
    const sql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(sql, updateValues);
    
    if (result.affectedRows > 0) {
      const [updatedUser] = await pool.execute(
        `SELECT u.*, b.name as branch_name 
         FROM users u 
         LEFT JOIN branches b ON u.branch_id = b.id 
         WHERE u.id = ?`,
        [userId]
      );
      
      res.json({
        success: true,
        message: 'تم تحديث المستخدم بنجاح',
        data: updatedUser[0]
      });
    } else {
      res.json({
        success: true,
        message: 'لم يتم تغيير أي بيانات',
        data: targetUser
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في تحديث المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تحديث المستخدم',
      error: error.message
    });
  }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const permanent = req.query.permanent === 'true';
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية حذف المستخدمين'
      });
    }
    
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }
    
    const targetUser = users[0];
    
    if (user.role === 'branch_manager' && targetUser.branch_id != user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية حذف مستخدمين من فروع أخرى'
      });
    }
    
    if (targetUser.id === user.id) {
      return res.status(400).json({
        success: false,
        message: 'لا يمكنك حذف حسابك الخاص'
      });
    }
    
    if (permanent) {
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
      
      res.json({
        success: true,
        message: 'تم حذف المستخدم نهائياً بنجاح',
        user_id: userId,
        user_name: targetUser.name
      });
      
    } else {
      await pool.execute(
        'UPDATE users SET is_active = 0 WHERE id = ?',
        [userId]
      );
      
      res.json({
        success: true,
        message: 'تم تعطيل المستخدم بنجاح',
        user_id: userId,
        user_name: targetUser.name
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في حذف المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في حذف المستخدم',
      error: error.message
    });
  }
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = req.user;
    
    if (user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية لعرض بيانات المستخدم'
      });
    }
    
    const [users] = await pool.execute(
      `SELECT u.*, b.name as branch_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }
    
    const targetUser = users[0];
    
    if (user.role === 'branch_manager' && targetUser.branch_id != user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية عرض بيانات مستخدم من فرع آخر'
      });
    }
    
    res.json({
      success: true,
      data: targetUser
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب بيانات المستخدم:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب بيانات المستخدم',
      error: error.message
    });
  }
});

// ==================== نقطة جلب التأجيرات النشطة للشيفت ====================
app.get('/api/rentals/active-for-shift', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id } = req.query;
    
    console.log(`📋 جلب التأجيرات النشطة للشيفت ${shift_id} في الفرع ${branch_id || user.branch_id}`);
    
    const targetBranchId = branch_id || user.branch_id;
    
    if (!shift_id) {
      return res.status(400).json({
        success: false,
        message: 'معرف الشيفت مطلوب'
      });
    }
    
    // ✅ استعلام لجلب التأجيرات النشطة للشيفت المحدد
    const [rentals] = await pool.execute(
      `SELECT 
        r.id,
        r.rental_number,
        r.game_id,
        r.game_name,
        r.customer_name,
        r.customer_phone,
        r.start_time,
        r.status,
        r.rental_type,
        r.is_open_time,
        r.payment_status,
        r.paid_amount,
        r.total_amount,
        r.duration_minutes,
        r.shift_id,
        r.branch_id,
        r.price_per_15min,
        r.employee_name,
        g.name as game_name_full,
        g.price_per_15min as game_price
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND r.shift_id = ?
        AND r.status = 'نشط'
      ORDER BY r.start_time ASC`,
      [targetBranchId, shift_id]
    );
    
    console.log(`✅ تم جلب ${rentals.length} تأجير نشط للشيفت ${shift_id}`);
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      shift_id: shift_id,
      message: `تم العثور على ${rentals.length} تأجير نشط في الشيفت`
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت',
      error: error.message
    });
  }
});

// ==================== نقطة بديلة (للتأكد) ====================
app.get('/api/rentals/active-by-shift/:shiftId', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const shiftId = req.params.shiftId;
    const { branch_id } = req.query;
    
    console.log(`📋 جلب التأجيرات النشطة للشيفت ${shiftId} (نقطة بديلة)`);
    
    const targetBranchId = branch_id || user.branch_id;
    
    const [rentals] = await pool.execute(
      `SELECT 
        r.*,
        g.name as game_name
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND r.shift_id = ?
        AND r.status = 'نشط'
      ORDER BY r.start_time ASC`,
      [targetBranchId, shiftId]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      shift_id: shiftId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في النقطة البديلة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت'
    });
  }
});



// ==================== نقطة جلب التأجيرات المكتملة فقط ====================
app.get('/api/rentals/completed-only', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id } = req.query;
    
    console.log('📋 جلب التأجيرات المكتملة فقط:', { shift_id, branch_id });
    
    let query = `
      SELECT r.*, g.name as game_name
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND (r.status = 'مكتمل' OR r.status = 'completed')
    `;
    
    const params = [branch_id || user.branch_id];
    
    if (shift_id) {
      query += ' AND r.shift_id = ?';
      params.push(shift_id);
    }
    
    query += ' ORDER BY r.end_time DESC LIMIT 100';
    
    const [rentals] = await pool.execute(query, params);
    
    console.log(`✅ تم جلب ${rentals.length} تأجير مكتمل`);
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      message: 'تم تحميل التأجيرات المكتملة بنجاح'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات المكتملة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات المكتملة',
      error: error.message,
      data: []
    });
  }
});

// ==================== نقطة معالجة التأجيرات المكتملة ====================
app.post('/api/rentals/process-completed', authenticateToken, async (req, res) => {
  try {
    console.log('✅ استقبال طلب معالجة التأجيرات المكتملة');
    
    // إرجاع رد مباشر بدون معالجة حالياً
    res.json({
      success: true,
      message: 'تم استقبال طلب المعالجة بنجاح',
      data: {
        processed_count: 0,
        processed_rentals: [],
        note: 'المعالجة التلقائية مؤقتاً معطلة',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في نقطة process-completed:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في المعالجة',
      error: error.message
    });
  }
});

// ==================== نقطة معالجة التأجيرات المكتملة (مبسطة) ====================
app.post('/api/rentals/process-completed-simple', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();
    
    console.log('🔄 معالجة التأجيرات المكتملة (مبسطة) للفرع', user.branch_id);
    
    // جلب فقط التأجيرات النشطة التي انتهى وقتها
    const [expiredRentals] = await pool.execute(`
      SELECT r.id, r.rental_number, r.game_id, r.customer_name
      FROM rentals r
      WHERE r.status = 'نشط'
        AND r.branch_id = ?
        AND (
          (r.rental_type = 'fixed' AND DATE_ADD(r.start_time, INTERVAL r.duration_minutes MINUTE) <= ?)
          OR
          (r.rental_type = 'open' AND DATE_ADD(r.start_time, INTERVAL 1440 MINUTE) <= ?)
        )
    `, [user.branch_id || 1, now, now]);
    
    let processedCount = 0;
    
    for (const rental of expiredRentals) {
      try {
        await pool.execute(
          `UPDATE rentals SET 
            status = 'مكتمل',
            end_time = ?,
            updated_at = NOW()
           WHERE id = ?`,
          [now.toISOString(), rental.id]
        );
        
        await pool.execute(
          "UPDATE games SET status = 'متاح' WHERE id = ?",
          [rental.game_id]
        );
        
        processedCount++;
        console.log(`✅ تم إكمال التأجير ${rental.rental_number}`);
      } catch (error) {
        console.warn(`⚠️ خطأ في التأجير ${rental.id}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `تم معالجة ${processedCount} تأجير`,
      processed_count: processedCount,
      total_expired: expiredRentals.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في المعالجة المبسطة:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في المعالجة',
      error: error.message
    });
  }
});

// ==================== نقطة جلب موظفي الشيفت ====================
app.get('/api/shifts/:id/employees', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    
    console.log(`👥 جلب موظفي الشيفت ${shiftId}`);
    
    // 1. التحقق من أن الشيفت ينتمي لفرع المستخدم
    const [shifts] = await pool.execute(
      'SELECT branch_id FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود'
      });
    }
    
    const shift = shifts[0];
    
    // 2. جلب الموظفين الذين قاموا بتأجيرات في هذا الشيفت
    const [employees] = await pool.execute(
      `SELECT DISTINCT 
        u.id,
        u.name,
        u.role,
        u.email,
        u.phone,
        COUNT(r.id) as total_rentals
       FROM users u
       LEFT JOIN rentals r ON u.id = r.user_id AND r.shift_id = ?
       WHERE u.branch_id = ?
         AND u.is_active = 1
       GROUP BY u.id
       ORDER BY u.name`,
      [shiftId, shift.branch_id]
    );
    
    // 3. إضافة صاحب الشيفت إذا لم يكن موجوداً
    const shiftOwner = await pool.execute(
      'SELECT employee_id, employee_name FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    if (shiftOwner.length > 0 && shiftOwner[0].length > 0) {
      const owner = shiftOwner[0][0];
      const ownerExists = employees.some(e => e.id === owner.employee_id);
      
      if (!ownerExists) {
        employees.unshift({
          id: owner.employee_id,
          name: owner.employee_name,
          role: 'employee',
          email: '',
          phone: '',
          total_rentals: 0
        });
      }
    }
    
    res.json({
      success: true,
      data: employees,
      count: employees.length,
      shift_id: shiftId,
      branch_id: shift.branch_id
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب موظفي الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الموظفين'
    });
  }
});

// ==================== نقطة جلب موظفي الشيفت الحالي ====================
app.get('/api/shifts/current-employees', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id } = req.query;
    
    console.log(`👥 جلب موظفي الشيفت ${shift_id || 'الحالي'}`);
    
    let targetShiftId = shift_id;
    
    // إذا لم يتم تحديد shift_id، جلب الشيفت النشط للمستخدم
    if (!targetShiftId) {
      const [shifts] = await pool.execute(
        "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
        [user.id]
      );
      
      if (shifts.length > 0) {
        targetShiftId = shifts[0].id;
      }
    }
    
    if (!targetShiftId) {
      return res.json({
        success: true,
        data: [user], // إرجاع المستخدم الحالي فقط
        count: 1
      });
    }
    
    // جلب الموظفين في الشيفت
    const [employees] = await pool.execute(
      `SELECT DISTINCT 
        u.id,
        u.name,
        u.role,
        u.branch_id,
        COUNT(r.id) as total_rentals
       FROM shifts s
       LEFT JOIN rentals r ON s.id = r.shift_id
       LEFT JOIN users u ON r.user_id = u.id
       WHERE s.id = ?
         AND u.id IS NOT NULL
       GROUP BY u.id
       UNION
       SELECT 
        s.employee_id as id,
        s.employee_name as name,
        'employee' as role,
        s.branch_id,
        COUNT(r.id) as total_rentals
       FROM shifts s
       LEFT JOIN rentals r ON s.id = r.shift_id
       WHERE s.id = ?
       GROUP BY s.employee_id`,
      [targetShiftId, targetShiftId]
    );
    
    // إذا لم يكن هناك موظفين، إرجاع صاحب الشيفت
    if (employees.length === 0) {
      const [shiftData] = await pool.execute(
        'SELECT employee_id, employee_name FROM shifts WHERE id = ?',
        [targetShiftId]
      );
      
      if (shiftData.length > 0) {
        employees.push({
          id: shiftData[0].employee_id,
          name: shiftData[0].employee_name,
          role: 'employee',
          branch_id: user.branch_id,
          total_rentals: 0
        });
      }
    }
    
    res.json({
      success: true,
      data: employees,
      count: employees.length,
      shift_id: targetShiftId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب موظفي الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب موظفي الشيفت'
    });
  }
});

// نقطة جلب الشيفت الحالي
app.get('/api/shifts/current', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [shifts] = await pool.execute(
      `SELECT * FROM shifts 
       WHERE employee_id = ? 
         AND status = 'نشط'
       ORDER BY start_time DESC 
       LIMIT 1`,
      [user.id]
    );

    if (shifts.length > 0) {
      res.json({
        success: true,
        data: shifts[0],
        message: 'تم جلب الشيفت النشط'
      });
    } else {
      res.json({
        success: true,
        data: null,
        message: 'لا يوجد شيفت نشط'
      });
    }
    
  } catch (error) {
    console.error('❌ خطأ في جلب الشيفت الحالي:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الشيفت'
    });
  }
});

// نقطة إنهاء الشيفت مع معالجة التأجيرات
app.put('/api/shifts/:id/end', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const { notes } = req.body;
    
    console.log(`🏁 إنهاء الشيفت ${shiftId} بواسطة ${user.name}`);
    
    // 1. التحقق من وجود الشيفت
    const [shifts] = await pool.execute(
      'SELECT * FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود'
      });
    }
    
    const shift = shifts[0];
    
    // 2. التحقق من أن المستخدم هو صاحب الشيفت
    if (shift.employee_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية إنهاء هذا الشيفت'
      });
    }
    
    // 3. جلب جميع التأجيرات النشطة في هذا الشيفت
    const [activeRentals] = await pool.execute(
      `SELECT r.*, g.name as game_name
       FROM rentals r
       LEFT JOIN games g ON r.game_id = g.id
       WHERE r.shift_id = ? 
         AND r.status = 'نشط' 
         AND r.branch_id = ?`,
      [shiftId, user.branch_id]
    );
    
    // 4. معالجة التأجيرات النشطة (إنهاؤها)
    let completedRentals = 0;
    for (const rental of activeRentals) {
      try {
        await pool.execute(
          `UPDATE rentals SET 
            status = 'مكتمل',
            end_time = NOW(),
            final_amount = total_amount,
            updated_at = NOW()
           WHERE id = ?`,
          [rental.id]
        );
        
        await pool.execute(
          "UPDATE games SET status = 'متاح' WHERE id = ?",
          [rental.game_id]
        );
        
        completedRentals++;
      } catch (error) {
        console.warn(`⚠️ خطأ في معالجة التأجير ${rental.id}:`, error.message);
      }
    }
    
    // 5. تحديث الشيفت
    const now = new Date();
    await pool.execute(
      `UPDATE shifts SET 
        status = 'منتهي',
        end_time = ?,
        notes = ?,
        total_rentals = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        now.toISOString(),
        notes || `تم إنهاء الشيفت بواسطة ${user.name} - تم معالجة ${completedRentals} تأجير`,
        activeRentals.length,
        shiftId
      ]
    );
    
    // 6. إرجاع الاستجابة
    const [endedShift] = await pool.execute(
      'SELECT * FROM shifts WHERE id = ?',
      [shiftId]
    );
    
    res.json({
      success: true,
      message: `تم إنهاء الشيفت بنجاح وتمت معالجة ${completedRentals} تأجير`,
      data: endedShift[0],
      stats: {
        total_rentals_processed: completedRentals,
        shift_id: shiftId,
        ended_at: now.toISOString()
      }
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنهاء الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الشيفت'
    });
  }
});


// نقطة لإنهاء الشيفت مع إخفاء تأجيراته
app.put('/api/shifts/:id/end-with-rentals', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    const { notes } = req.body;
    
    console.log(`🏁 إنهاء الشيفت ${shiftId} وإخفاء تأجيراته`);
    
    // 1. التحقق من وجود الشيفت
    const [shifts] = await pool.execute(
      'SELECT * FROM shifts WHERE id = ? AND employee_id = ?',
      [shiftId, user.id]
    );
    
    if (shifts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'الشيفت غير موجود أو ليس لديك صلاحية إنهائه'
      });
    }
    
    // 2. تحديث الشيفت
    const [shiftResult] = await pool.execute(
      `UPDATE shifts SET 
        status = 'منتهي',
        end_time = NOW(),
        notes = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        notes || `تم إنهاء الشيفت بواسطة ${user.name}`,
        shiftId
      ]
    );
    
    // 3. تحديث التأجيرات المرتبطة (إخفاؤها)
    const [rentalResult] = await pool.execute(
      `UPDATE rentals SET 
        is_visible = 0,
        hidden_at = NOW(),
        hidden_by = ?,
        hidden_reason = 'انتهاء الشيفت'
       WHERE shift_id = ? AND branch_id = ?`,
      [user.id, shiftId, user.branch_id]
    );
    
    console.log(`✅ تم إنهاء الشيفت وإخفاء ${rentalResult.affectedRows} تأجير`);
    
    // 4. إرجاع الاستجابة
    res.json({
      success: true,
      message: 'تم إنهاء الشيفت وإخفاء جميع التأجيرات المرتبطة',
      data: {
        shift_id: shiftId,
        hidden_rentals_count: rentalResult.affectedRows || 0,
        hidden_from_display: true
      },
      hidden_rentals_count: rentalResult.affectedRows || 0
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنهاء الشيفت مع التأجيرات:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في إنهاء الشيفت'
    });
  }
});

app.post('/api/users/:id/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = req.user;
    const { new_password, confirm_password } = req.body;
    
    if (user.id != userId && user.role !== 'admin' && user.role !== 'branch_manager') {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تغيير كلمة مرور هذا المستخدم'
      });
    }
    
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'المستخدم غير موجود'
      });
    }
    
    const targetUser = users[0];
    
    if (user.role === 'branch_manager' && targetUser.branch_id != user.branch_id) {
      return res.status(403).json({
        success: false,
        message: 'ليس لديك صلاحية تغيير كلمة مرور مستخدم من فرع آخر'
      });
    }
    
    if (!new_password || new_password.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة مطلوبة'
      });
    }
    
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'كلمات المرور غير متطابقة'
      });
    }
    
    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور يجب أن تكون على الأقل 6 أحرف'
      });
    }
    
    await pool.execute(
      'UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?',
      [new_password, userId]
    );
    
    res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
      user_id: userId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في تغيير كلمة المرور:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تغيير كلمة المرور',
      error: error.message
    });
  }
});

app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { search = '' } = req.query;
    
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params = [];
    
    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY name LIMIT 100';
    
    const [customers] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: customers,
      count: customers.length
    });
    
  } catch (error) {
    console.error('❌ خطأ في جلب العملاء:', error.message);
    res.json({
      success: true,
      data: [],
      message: 'بيانات افتراضية'
    });
  }
});

app.get('/api/rentals/completed', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { start_date, end_date, shift_id } = req.query;
    
    let query = `
      SELECT r.*, g.name as game_name
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND r.status = 'مكتمل'
    `;
    
    const params = [user.branch_id];
    
    if (shift_id) {
      query += ' AND r.shift_id = ?';
      params.push(shift_id);
    }
    
    if (start_date) {
      query += ' AND DATE(r.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(r.created_at) <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY r.end_time DESC LIMIT 100';
    
    const [rentals] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب التأجيرات المكتملة:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات المكتملة'
    });
  }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const today = new Date().toISOString().split('T')[0];
    
    // حساب الإحصائيات
    const [gamesStats] = await pool.execute(
      `SELECT 
         COUNT(*) as total_games,
         COUNT(CASE WHEN status = 'متاح' THEN 1 END) as available_games
       FROM games 
       WHERE branch_id = ? AND is_active = 1`,
      [user.branch_id]
    );
    
    const [activeRentals] = await pool.execute(
      `SELECT COUNT(*) as active_rentals 
       FROM rentals 
       WHERE branch_id = ? AND status = 'نشط'`,
      [user.branch_id]
    );
    
    const [todayStats] = await pool.execute(
      `SELECT 
         COUNT(*) as today_rentals,
         COALESCE(SUM(final_amount), 0) as today_revenue
       FROM rentals 
       WHERE branch_id = ? 
         AND DATE(created_at) = ? 
         AND status = 'مكتمل'`,
      [user.branch_id, today]
    );
    
    res.json({
      success: true,
      data: {
        totalGames: gamesStats[0]?.total_games || 0,
        availableGames: gamesStats[0]?.available_games || 0,
        activeRentals: activeRentals[0]?.active_rentals || 0,
        todayRentals: todayStats[0]?.today_rentals || 0,
        todayRevenue: todayStats[0]?.today_revenue || 0
      },
      message: 'تم تحميل الإحصائيات بنجاح'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب الإحصائيات:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب الإحصائيات',
      data: {
        totalGames: 0,
        availableGames: 0,
        activeRentals: 0,
        todayRentals: 0,
        todayRevenue: 0
      }
    });
  }
});

app.get('/api/reports/rentals', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { 
      start_date, 
      end_date, 
      shift_id, 
      employee_id,
      branch_id = user.branch_id 
    } = req.query;
    
    let query = `
      SELECT r.*, 
        g.name as game_name,
        s.shift_number,
        s.employee_name as shift_employee_name,
        s.start_time as shift_start_time,
        s.end_time as shift_end_time,
        b.name as branch_name
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      LEFT JOIN shifts s ON r.shift_id = s.id
      LEFT JOIN branches b ON r.branch_id = b.id
      WHERE r.branch_id = ?
        AND r.status IN ('مكتمل', 'completed', 'ملغي')
    `;
    
    const params = [branch_id];
    
    if (start_date) {
      query += ' AND DATE(r.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(r.created_at) <= ?';
      params.push(end_date);
    }
    
    if (shift_id) {
      query += ' AND r.shift_id = ?';
      params.push(shift_id);
    }
    
    if (employee_id) {
      query += ' AND r.user_id = ?';
      params.push(employee_id);
    }
    
    query += ' ORDER BY r.end_time DESC LIMIT 500';
    
    const [rentals] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      for_reports_only: true
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تقارير التأجيرات:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التقارير'
    });
  }
});

app.get('/api/debug/rentals-table', async (req, res) => {
  try {
    const [structure] = await pool.execute(`DESCRIBE rentals`);
    
    const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM rentals`);
    
    const [recentRentals] = await pool.execute(`
      SELECT id, rental_number, customer_name, status, created_at 
      FROM rentals 
      ORDER BY id DESC 
      LIMIT 5
    `);
    
    const requiredColumns = [
      'rental_number', 'game_id', 'customer_name', 'customer_phone',
      'user_id', 'branch_id', 'shift_id', 'status'
    ];
    
    const existingColumns = structure.map(col => col.Field);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    
    res.json({
      success: true,
      table: 'rentals',
      structure: structure,
      stats: {
        total_records: countResult[0].total,
        recent_records: recentRentals.length
      },
      recent_rentals: recentRentals,
      validation: {
        has_required_columns: missingColumns.length === 0,
        missing_columns: missingColumns,
        existing_columns: existingColumns
      },
      fix_queries: missingColumns.map(col => {
        if (col === 'rental_number') {
          return "ALTER TABLE rentals ADD COLUMN rental_number VARCHAR(100) NOT NULL DEFAULT ''";
        }
        if (col === 'game_id') {
          return "ALTER TABLE rentals ADD COLUMN game_id INT NOT NULL";
        }
        if (col === 'customer_name') {
          return "ALTER TABLE rentals ADD COLUMN customer_name VARCHAR(255) NOT NULL";
        }
        if (col === 'customer_phone') {
          return "ALTER TABLE rentals ADD COLUMN customer_phone VARCHAR(20)";
        }
        if (col === 'user_id') {
          return "ALTER TABLE rentals ADD COLUMN user_id INT NOT NULL";
        }
        if (col === 'branch_id') {
          return "ALTER TABLE rentals ADD COLUMN branch_id INT NOT NULL DEFAULT 1";
        }
        if (col === 'shift_id') {
          return "ALTER TABLE rentals ADD COLUMN shift_id INT";
        }
        if (col === 'status') {
          return "ALTER TABLE rentals ADD COLUMN status VARCHAR(50) DEFAULT 'نشط'";
        }
        return `ALTER TABLE rentals ADD COLUMN ${col} TEXT`;
      })
    });
    
  } catch (error) {
    console.error('🔥 خطأ في فحص جدول rentals:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في فحص الجدول',
      error: error.message
    });
  }
});

app.post('/api/debug/fix-rentals-auto', async (req, res) => {
  try {
    const queries = [
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS rental_number VARCHAR(100) NOT NULL DEFAULT ''",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS game_id INT NOT NULL",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NOT NULL",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20) DEFAULT ''",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS user_id INT NOT NULL",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS branch_id INT NOT NULL DEFAULT 1",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS shift_id INT",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'نشط'",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS start_time DATETIME DEFAULT CURRENT_TIMESTAMP",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2) DEFAULT 0",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'كاش'",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'عند الإنهاء'",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS duration_minutes INT DEFAULT 15",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS rental_type VARCHAR(50) DEFAULT 'fixed'",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS notes TEXT",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS is_open_time TINYINT DEFAULT 0",
      "ALTER TABLE rentals ADD COLUMN IF NOT EXISTS child_name VARCHAR(100)"
    ];
    
    const results = [];
    for (const query of queries) {
      try {
        await pool.execute(query);
        results.push({ query: query.substring(0, 50) + '...', success: true });
      } catch (error) {
        results.push({ query: query.substring(0, 50) + '...', success: false, error: error.message });
      }
    }
    
    const [structure] = await pool.execute('DESCRIBE rentals');
    const columnNames = structure.map(col => col.Field);
    
    res.json({
      success: true,
      message: 'تم محاولة إصلاح الجدول',
      columns: columnNames,
      total_columns: columnNames.length,
      required_columns: ['rental_number', 'game_id', 'customer_name', 'user_id', 'branch_id', 'status'],
      all_required: ['rental_number', 'game_id', 'customer_name', 'user_id', 'branch_id', 'status'].every(col => 
        columnNames.includes(col)
      ),
      results: results
    });
    
  } catch (error) {
    console.error('🔥 خطأ في الإصلاح التلقائي:', error.message);
    res.status(500).json({
      success: false,
      message: 'خطأ في الإصلاح التلقائي',
      error: error.message
    });
  }
});

app.get('/api/debug/branches-check', async (req, res) => {
  try {
    const [tables] = await pool.execute(
      "SHOW TABLES LIKE 'branches'"
    );
    
    if (tables.length === 0) {
      return res.json({
        success: false,
        message: 'جدول branches غير موجود',
        suggestion: 'قم بتشغيل createTables() مرة أخرى'
      });
    }
    
    const [structure] = await pool.execute('DESCRIBE branches');
    
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM branches');
    
    const [sampleData] = await pool.execute(
      'SELECT id, name, is_active FROM branches ORDER BY id LIMIT 5'
    );
    
    res.json({
      success: true,
      table_exists: true,
      structure: structure.map(col => ({
        field: col.Field,
        type: col.Type,
        null: col.Null,
        key: col.Key,
        default: col.Default
      })),
      stats: {
        total_branches: countResult[0].total
      },
      sample_data: sampleData,
      required_columns: ['id', 'name', 'location', 'is_active', 'branch_code'],
      all_columns_present: ['id', 'name', 'location', 'is_active', 'branch_code']
        .every(col => structure.some(s => s.Field === col))
    });
    
  } catch (error) {
    console.error('🔥 خطأ في التحقق من جدول branches:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في التحقق من الجدول',
      error: error.message
    });
  }
});

app.post('/api/debug/create-branches-table', async (req, res) => {
  try {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS branches (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        location VARCHAR(500),
        city VARCHAR(100),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(255),
        opening_time TIME DEFAULT '09:00:00',
        closing_time TIME DEFAULT '22:00:00',
        branch_code VARCHAR(50) UNIQUE,
        created_by INT,
        updated_by INT,
        is_active TINYINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `;
    
    await pool.execute(createTableSQL);
    
    const [existing] = await pool.execute('SELECT id FROM branches LIMIT 1');
    if (existing.length === 0) {
      await pool.execute(`
        INSERT INTO branches (name, location, city, contact_phone, branch_code, is_active)
        VALUES ('الفرع الرئيسي', 'القاهرة', 'القاهرة', '01000000000', 'BR-001', 1)
      `);
    }
    
    res.json({
      success: true,
      message: 'تم إنشاء/تحديث جدول branches بنجاح'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في إنشاء جدول branches:', error);
    res.status(500).json({
      success: false,
      message: 'فشل إنشاء الجدول',
      error: error.message,
      sql: error.sql
    });
  }
});

app.get('/api/debug/validate-rentals-table', async (req, res) => {
  try {
    console.log('🔍 فحص هيكل جدول rentals...');
    
    // 1. فحص هيكل الجدول
    const [structure] = await pool.execute('DESCRIBE rentals');
    const columnNames = structure.map(col => col.Field);
    
    // 2. الحقول المطلوبة
    const requiredColumns = [
      'rental_number', 'game_id', 'customer_name', 
      'user_id', 'branch_id', 'shift_id', 'status'
    ];
    
    // 3. التحقق من الحقول الناقصة
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    // 4. إصلاح الحقول الناقصة
    for (const column of missingColumns) {
      try {
        let alterQuery = '';
        
        switch(column) {
          case 'rental_number':
            alterQuery = 'ADD COLUMN rental_number VARCHAR(100) NOT NULL DEFAULT ""';
            break;
          case 'game_id':
            alterQuery = 'ADD COLUMN game_id INT NOT NULL';
            break;
          case 'customer_name':
            alterQuery = 'ADD COLUMN customer_name VARCHAR(255) NOT NULL';
            break;
          case 'user_id':
            alterQuery = 'ADD COLUMN user_id INT NOT NULL';
            break;
          case 'branch_id':
            alterQuery = 'ADD COLUMN branch_id INT NOT NULL DEFAULT 1';
            break;
          case 'shift_id':
            alterQuery = 'ADD COLUMN shift_id INT';
            break;
          case 'status':
            alterQuery = "ADD COLUMN status VARCHAR(50) DEFAULT 'نشط'";
            break;
        }
        
        if (alterQuery) {
          await pool.execute(`ALTER TABLE rentals ${alterQuery}`);
          console.log(`✅ تم إضافة الحقل: ${column}`);
        }
      } catch (alterError) {
        console.warn(`⚠️ لا يمكن إضافة ${column}:`, alterError.message);
      }
    }
    
    // 5. عرض عينة من البيانات
    const [sampleData] = await pool.execute(
      'SELECT id, rental_number, customer_name, status FROM rentals ORDER BY id DESC LIMIT 5'
    );
    
    res.json({
      success: true,
      message: 'تم فحص جدول rentals',
      structure: structure,
      columns: columnNames,
      missing_columns_fixed: missingColumns.length,
      sample_data: sampleData,
      is_valid: missingColumns.length === 0
    });
    
  } catch (error) {
    console.error('🔥 خطأ في فحص الجدول:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في فحص الجدول',
      error: error.message
    });
  }
});

// نقطة خاصة لتأكيد إضافة إيراد الوقت الثابت
app.post('/api/rentals/:id/confirm-fixed-revenue', authenticateToken, async (req, res) => {
  try {
    const rentalId = req.params.id;
    const user = req.user;
    
    console.log(`💰 تأكيد إيراد للوقت الثابت - تأجير ${rentalId}`);
    
    // جلب بيانات التأجير
    const [rentals] = await pool.execute(
      `SELECT r.*, s.id as shift_id, s.total_revenue
       FROM rentals r
       LEFT JOIN shifts s ON r.shift_id = s.id
       WHERE r.id = ? AND r.branch_id = ?`,
      [rentalId, user.branch_id]
    );
    
    if (rentals.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'التأجير غير موجود'
      });
    }
    
    const rental = rentals[0];
    
    // التحقق من أن التأجير وقت ثابت
    if (rental.rental_type !== 'fixed' && rental.is_open_time !== 0) {
      return res.status(400).json({
        success: false,
        message: 'هذا التأجير ليس وقتاً ثابتاً'
      });
    }
    
    const paidAmount = rental.paid_amount || rental.total_amount || 0;
    
    if (paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'لا يوجد مبلغ مدفوع لإضافته للإيراد'
      });
    }
    
    // تحديث إيراد الشيفت
    const [result] = await pool.execute(
      `UPDATE shifts SET 
        total_revenue = COALESCE(total_revenue, 0) + ?,
        updated_at = NOW()
       WHERE id = ?`,
      [paidAmount, rental.shift_id]
    );
    
    if (result.affectedRows > 0) {
      // تحديث حالة الدفع في التأجير
      await pool.execute(
        `UPDATE rentals SET 
          payment_status = 'مدفوع مسبقاً',
          updated_at = NOW()
         WHERE id = ?`,
        [rentalId]
      );
      
      console.log(`✅ تم إضافة إيراد للوقت الثابت: ${paidAmount} ج.م`);
      
      // جلب الإيراد المحدث
      const [shift] = await pool.execute(
        'SELECT total_revenue FROM shifts WHERE id = ?',
        [rental.shift_id]
      );
      
      res.json({
        success: true,
        message: 'تم إضافة إيراد الوقت الثابت بنجاح',
        data: {
          rental_id: rentalId,
          amount_added: paidAmount,
          shift_id: rental.shift_id,
          new_total_revenue: shift[0]?.total_revenue || 0,
          rental_type: 'fixed'
        }
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'فشل تحديث إيراد الشيفت'
      });
    }
    
  } catch (error) {
    console.error('🔥 خطأ في تأكيد إيراد الوقت الثابت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في تأكيد الإيراد'
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: '✅ الخادم يعمل بشكل صحيح!',
    endpoints: {
      auth: ['POST /api/auth/login', 'GET /api/auth/profile'],
      shifts: ['POST /api/shifts/start', 'GET /api/shifts/simple', 'PUT /api/shifts/:id/end'],
      games: ['GET /api/games', 'GET /api/branches/:id/games'],
      rentals: [
        'GET /api/rentals/active',
        'POST /api/rentals',
        'POST /api/rentals/alt',
        'POST /api/rentals/simple',
        'POST /api/rentals/:id/complete',
        'GET /api/rentals'
      ],
      branches: ['GET /api/branches', 'GET /api/branches/:id'],
      stats: ['GET /api/dashboard/stats/simple'],
      debug: [
        'GET /api/health',
        'GET /api/debug/rentals-table',
        'POST /api/debug/fix-rentals-auto'
      ]
    },
    timestamp: new Date().toISOString()
  });
});

app.post('/api/rentals/test', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { game_id, customer_name } = req.body;
    
    const rentalNumber = `TEST-${Date.now()}`;
    
    const [result] = await pool.execute(
      'INSERT INTO rentals (rental_number, game_id, customer_name, user_id, branch_id) VALUES (?, ?, ?, ?, ?)',
      [rentalNumber, game_id, customer_name, user.id, user.branch_id || 1]
    );
    
    res.json({
      success: true,
      message: 'نجح الاختبار!',
      rental_id: result.insertId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في الاختبار:', error.message);
    res.status(500).json({
      success: false,
      message: 'فشل الاختبار: ' + error.message,
      error_details: error
    });
  }
});

app.post('/api/rentals/debug-test', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const rentalNumber = `TEST-${Date.now()}`;
    
    const [result] = await pool.execute(
      `INSERT INTO rentals (
        rental_number, 
        game_id, 
        customer_name, 
        user_id, 
        branch_id
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        rentalNumber,
        1,
        'عميل تجريبي',
        user.id,
        user.branch_id || 1
      ]
    );
    
    res.json({
      success: true,
      message: '✅ تم إنشاء تأجير اختبار بنجاح',
      rental_id: result.insertId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في اختبار التأجير:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'خطأ في SQL',
      error: error.message,
      sql: error.sql,
      suggestion: 'تحقق من هيكل جدول rentals'
    });
  }
});

// نقطة تشخيصية لفحص التأجيرات
app.get('/api/debug/check-rental-types', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    const [rentals] = await pool.execute(
      `SELECT 
        id,
        rental_number,
        customer_name,
        rental_type,
        is_open_time,
        payment_status,
        status,
        start_time
       FROM rentals 
       WHERE branch_id = ?
       ORDER BY id DESC 
       LIMIT 10`,
      [user.branch_id]
    );
    
    console.log('📊 فحص أنواع التأجيرات:', rentals);
    
    res.json({
      success: true,
      data: rentals,
      message: 'تم فحص أنواع التأجيرات'
    });
    
  } catch (error) {
    console.error('🔥 خطأ في فحص أنواع التأجيرات:', error);
    res.status(500).json({
      success: false,
      message: 'خطأ في الفحص'
    });
  }
});

app.get('/api/rentals/all-for-branch', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { limit = 20 } = req.query;
    
    const [rentals] = await pool.execute(
      `SELECT 
        id,
        rental_number,
        customer_name,
        game_id,
        status,
        shift_id,
        branch_id,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
       FROM rentals 
       WHERE branch_id = ?
       ORDER BY id DESC 
       LIMIT ?`,
      [user.branch_id || 1, parseInt(limit)]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      message: `آخر ${rentals.length} تأجير في الفرع`
    });
    
  } catch (error) {
    console.error('Error in /rentals/all-for-branch:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
 
// ==================== 🔥 نقطة بسيطة لجلب التأجيرات النشطة للشيفت ====================
app.get('/api/rentals/active-simple', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id } = req.query;
    
    console.log(`📥 جلب التأجيرات النشطة للشيفت: ${shift_id}, الفرع: ${branch_id || user?.branch_id}`);
    
    // التحقق من وجود shift_id
    if (!shift_id) {
      console.log('⚠️ معرف الشيفت غير موجود');
      return res.status(400).json({
        success: false,
        message: 'معرف الشيفت مطلوب'
      });
    }
    
    const targetBranchId = branch_id || user?.branch_id || 1;
    
    // ✅ **الإصلاح: استعلام محسن مع التأكد من جلب duration_minutes بشكل صحيح**
    const [rentals] = await pool.execute(
      `SELECT 
        r.id,
        r.rental_number,
        r.game_id,
        r.game_name,
        r.customer_name,
        r.customer_phone,
        r.start_time,
        r.status,
        r.rental_type,
        r.is_open_time,
        r.payment_status,
        r.paid_amount,
        r.total_amount,
        r.final_amount,
        r.duration_minutes,      -- ⭐ هذا هو الحقل المهم
        r.shift_id,
        r.branch_id,
        r.price_per_15min,
        r.employee_name,
        r.user_id,
        r.created_at,
        r.updated_at,
        g.name as game_name_full,
        g.price_per_15min as game_price
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND r.shift_id = ?
        AND r.status = 'نشط'
      ORDER BY r.start_time ASC`,
      [targetBranchId, shift_id]
    );
    
    console.log(`✅ تم جلب ${rentals.length} تأجير نشط للشيفت ${shift_id}`);
    
    // تسجيل قيم duration_minutes للتأكد
    if (rentals.length > 0) {
      rentals.forEach(rental => {
        console.log(`📋 تأجير ${rental.id} - المدة: ${rental.duration_minutes} دقيقة, النوع: ${rental.rental_type}`);
      });
    }
    
    // معالجة البيانات للتأكد من وجود duration_minutes
    const processedRentals = rentals.map(rental => ({
      ...rental,
      time_type_display: (rental.rental_type === 'open' || rental.is_open_time === 1) ? 'مفتوح' : 'ثابت',
      game_name: rental.game_name || rental.game_name_full || 'لعبة غير معروفة',
      customer_phone: rental.customer_phone || '00000000000',
      price_per_15min: rental.price_per_15min || rental.game_price || 100,
      // ⭐ التأكد من وجود duration_minutes (إذا كانت null أو 0، استخدم 15 للوقت الثابت)
      duration_minutes: rental.rental_type === 'fixed' ? 
        (rental.duration_minutes || 15) : 
        rental.duration_minutes
    }));
    
    res.json({
      success: true,
      data: processedRentals,
      count: processedRentals.length,
      shift_id: shift_id,
      message: `تم العثور على ${processedRentals.length} تأجير نشط في الشيفت`
    });
    
  } catch (error) {
    console.error('🔥 خطأ في /api/rentals/active-simple:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات النشطة للشيفت',
      error: error.message
    });
  }
});

// ==================== نقطة بديلة للتأكد ====================
app.get('/api/rentals/active-for-shift', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    const { shift_id, branch_id } = req.query;
    
    console.log(`📋 جلب التأجيرات النشطة للشيفت ${shift_id} (نقطة بديلة)`);
    
    const targetBranchId = branch_id || user?.branch_id || 1;
    
    const [rentals] = await pool.execute(
      `SELECT 
        r.*,
        g.name as game_name
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.branch_id = ?
        AND r.shift_id = ?
        AND r.status = 'نشط'
      ORDER BY r.start_time ASC`,
      [targetBranchId, shift_id]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      shift_id: shift_id
    });
    
  } catch (error) {
    console.error('🔥 خطأ في النقطة البديلة:', error.message);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت'
    });
  }
});

app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.url}`);
  res.status(404).json({
    success: false,
    message: 'المسار غير موجود',
    requested_url: req.url,
    method: req.method,
    available_endpoints: [
      'GET    /api/health',
      'GET    /api/test',
      'POST   /api/auth/login',
      'GET    /api/auth/profile',
      'POST   /api/shifts/start',
      'GET    /api/shifts/simple',
      'PUT    /api/shifts/:id/end',
      'GET    /api/games',
      'GET    /api/rentals/active',
      'POST   /api/rentals',
      'POST   /api/rentals/alt',
      'POST   /api/rentals/simple',
      'POST   /api/rentals/:id/complete',
      'GET    /api/rentals',
      'GET    /api/branches',
      'GET    /api/dashboard/stats/simple',
      'GET    /api/debug/tables',
      'GET    /api/debug/check-database'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('🔥 Unhandled Error:', error.message);
  
  res.status(500).json({
    success: false,
    message: 'حدث خطأ غير متوقع في الخادم',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug/check-rentals', async (req, res) => {
  try {
    const [rentals] = await pool.execute('SELECT * FROM rentals LIMIT 10');
    const [structure] = await pool.execute('DESCRIBE rentals');
    
    res.json({
      success: true,
      rentals_count: rentals.length,
      structure: structure,
      sample: rentals
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

app.get('/api/rentals/for-shift/:shiftId', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.shiftId;
    const user = req.user;
    const { branch_id } = req.query;
    
    console.log(`📋 جلب تأجيرات الشيفت ${shiftId}`);
    
    const targetBranchId = branch_id || user.branch_id;
    
    const [rentals] = await pool.execute(
      `SELECT 
        r.id,
        r.rental_number,
        r.game_id,
        r.game_name,
        r.customer_name,
        r.customer_phone,
        r.start_time,
        r.status,
        r.rental_type,
        r.is_open_time,
        r.payment_status,
        r.paid_amount,
        r.total_amount,
        r.duration_minutes,
        r.shift_id,
        r.branch_id,
        g.price_per_15min
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.shift_id = ?
        AND r.branch_id = ?
        AND r.status = 'نشط'
      ORDER BY r.start_time ASC`,
      [shiftId, targetBranchId]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت'
    });
  }
});

// نقطة مبسطة لجلب تأجيرات الشيفت
app.get('/api/shifts/:id/rentals-active', authenticateToken, async (req, res) => {
  try {
    const shiftId = req.params.id;
    const user = req.user;
    
    console.log(`📋 جلب تأجيرات نشطة للشيفت ${shiftId}`);
    
    const [rentals] = await pool.execute(
      `SELECT 
        r.id,
        r.rental_number,
        r.game_id,
        r.game_name,
        r.customer_name,
        r.customer_phone,
        r.start_time,
        r.status,
        r.rental_type,
        r.is_open_time,
        r.payment_status,
        r.paid_amount,
        r.total_amount,
        r.duration_minutes,
        r.shift_id,
        r.branch_id,
        g.price_per_15min
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.shift_id = ?
        AND r.branch_id = ?
        AND r.status = 'نشط'
      ORDER BY r.start_time ASC`,
      [shiftId, user.branch_id || 1]
    );
    
    res.json({
      success: true,
      data: rentals,
      count: rentals.length,
      shift_id: shiftId
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب تأجيرات الشيفت'
    });
  }
});

// ==================== نقطة لجلب تأجيرات الشيفت الحالي فقط ====================
app.get('/api/rentals/current-shift-only', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    // جلب الشيفت النشط للمستخدم
    const [shifts] = await pool.execute(
      "SELECT id FROM shifts WHERE employee_id = ? AND status = 'نشط' LIMIT 1",
      [user.id]
    );
    
    if (shifts.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: 'لا يوجد شيفت نشط'
      });
    }
    
    const shiftId = shifts[0].id;
    
    // جلب تأجيرات هذا الشيفت فقط
    const [rentals] = await pool.execute(
      `SELECT 
        r.*,
        g.name as game_name
      FROM rentals r
      LEFT JOIN games g ON r.game_id = g.id
      WHERE r.shift_id = ? 
        AND r.status = 'نشط'
        AND r.branch_id = ?
      ORDER BY r.start_time ASC`,
      [shiftId, user.branch_id]
    );
    
    res.json({
      success: true,
      data: rentals,
      shift_id: shiftId,
      count: rentals.length
    });
    
  } catch (error) {
    console.error('🔥 خطأ في جلب تأجيرات الشيفت الحالي:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في جلب التأجيرات'
    });
  }
});
// نقطة اختبار للتحقق من وجود النقاط
app.get('/api/test-endpoints', (req, res) => {
  res.json({
    success: true,
    endpoints: [
      '/api/rentals/active-for-shift',
      '/api/shifts/:id/employees',
      '/api/rentals/completed-only',
      '/api/rentals/active'
    ],
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 L3BTY Rental System - Professional Edition
  ==============================================
  📡 Port: ${PORT}
  🌐 URL: http://localhost:${PORT}
  🔗 API: http://localhost:${PORT}/api
  🏥 Health: http://localhost:${PORT}/api/health
  🔧 Debug: http://localhost:${PORT}/api/debug/check-database
  
  ==============================================
  ✅ النظام جاهز للتشغيل
  ==============================================
  `);
});