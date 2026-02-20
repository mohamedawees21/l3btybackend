// backend/complete-server.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// 🔐 AUTH ENDPOINTS
app.post('/api/auth/login', async (req, res) => {
  console.log('🔐 Login attempt:', req.body.email);
  
  try {
    const { email, password } = req.body;
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );
    
    await connection.end();
    
    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }
    
    const user = users[0];
    
    // Simple password check (for development)
    if (password === '123456') {
      const token = `l3bty_token_${user.id}_${Date.now()}`;
      
      return res.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          branch_id: user.branch_id
        }
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
      });
    }
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// 👥 USERS ENDPOINTS
app.get('/api/users', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [users] = await connection.execute(
      `SELECT id, username, email, name, role, branch_id, is_active, created_at 
       FROM users ORDER BY created_at DESC`
    );
    
    await connection.end();
    
    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { username, email, password, name, role, branch_id, phone } = req.body;
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [result] = await connection.execute(
      `INSERT INTO users (username, email, password, name, role, branch_id, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [username, email, password, name, role, branch_id, phone]
    );
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'تم إنشاء المستخدم بنجاح',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// 🎮 GAMES ENDPOINTS
app.get('/api/games', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [games] = await connection.execute(
      `SELECT * FROM games ORDER BY name`
    );
    
    await connection.end();
    
    res.json({
      success: true,
      data: games
    });
  } catch (error) {
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

app.post('/api/games', async (req, res) => {
  try {
    const { name, category, image_url, price_per_hour, price_per_15min, branch_id } = req.body;
    
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [result] = await connection.execute(
      `INSERT INTO games (name, category, image_url, price_per_hour, price_per_15min, branch_id, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'available', 1)`,
      [name, category, image_url, price_per_hour, price_per_15min, branch_id]
    );
    
    await connection.end();
    
    res.json({
      success: true,
      message: 'تم إنشاء اللعبة بنجاح',
      gameId: result.insertId
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// 🏬 BRANCHES ENDPOINTS
app.get('/api/branches', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [branches] = await connection.execute(
      `SELECT * FROM branches ORDER BY name`
    );
    
    await connection.end();
    
    res.json({
      success: true,
      data: branches
    });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// ⏱️ RENTALS ENDPOINTS
app.get('/api/rentals', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [rentals] = await connection.execute(`
      SELECT r.*, u.name as customer_name, g.name as game_name, b.name as branch_name
      FROM rentals r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN games g ON r.game_id = g.id
      LEFT JOIN branches b ON r.branch_id = b.id
      ORDER BY r.start_time DESC
      LIMIT 50
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      data: rentals
    });
  } catch (error) {
    console.error('Get rentals error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// 📊 DASHBOARD STATS
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    // إجمالي الإيرادات
    const [revenueResult] = await connection.execute(
      'SELECT COALESCE(SUM(total_price), 0) as total_revenue FROM rentals WHERE payment_status = "paid"'
    );
    
    // إجمالي التأجيرات
    const [rentalsResult] = await connection.execute(
      'SELECT COUNT(*) as total_rentals FROM rentals'
    );
    
    // التأجيرات النشطة
    const [activeResult] = await connection.execute(
      'SELECT COUNT(*) as active_rentals FROM rentals WHERE status = "active"'
    );
    
    // إجمالي المستخدمين
    const [usersResult] = await connection.execute(
      'SELECT COUNT(*) as total_users FROM users WHERE is_active = 1'
    );
    
    // إجمالي الفروع
    const [branchesResult] = await connection.execute(
      'SELECT COUNT(*) as total_branches FROM branches WHERE is_active = 1'
    );
    
    // إجمالي الألعاب
    const [gamesResult] = await connection.execute(
      'SELECT COUNT(*) as total_games FROM games WHERE is_active = 1'
    );
    
    // إيرادات اليوم
    const today = new Date().toISOString().split('T')[0];
    const [todayRevenueResult] = await connection.execute(
      'SELECT COALESCE(SUM(total_price), 0) as today_revenue FROM rentals WHERE DATE(start_time) = ? AND payment_status = "paid"',
      [today]
    );
    
    // تأجيرات اليوم
    const [todayRentalsResult] = await connection.execute(
      'SELECT COUNT(*) as today_rentals FROM rentals WHERE DATE(start_time) = ?',
      [today]
    );
    
    await connection.end();
    
    res.json({
      success: true,
      data: {
        totalRevenue: revenueResult[0].total_revenue || 0,
        totalRentals: rentalsResult[0].total_rentals || 0,
        activeRentals: activeResult[0].active_rentals || 0,
        totalUsers: usersResult[0].total_users || 0,
        totalBranches: branchesResult[0].total_branches || 0,
        totalGames: gamesResult[0].total_games || 0,
        todayRevenue: todayRevenueResult[0].today_revenue || 0,
        todayRentals: todayRentalsResult[0].today_rentals || 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// 📈 RECENT RENTALS
app.get('/api/dashboard/recent-rentals', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [rentals] = await connection.execute(`
      SELECT r.id, u.name as customer, g.name as game, b.name as branch, 
             r.start_time, r.status,
             CASE 
               WHEN r.status = 'active' THEN 'نشط'
               WHEN r.status = 'completed' THEN 'مكتمل'
               WHEN r.status = 'cancelled' THEN 'ملغي'
               ELSE 'غير معروف'
             END as status_arabic,
             TIMESTAMPDIFF(MINUTE, r.start_time, NOW()) as minutes_ago
      FROM rentals r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN games g ON r.game_id = g.id
      LEFT JOIN branches b ON r.branch_id = b.id
      ORDER BY r.start_time DESC
      LIMIT 10
    `);
    
    await connection.end();
    
    // تنسيق البيانات
    const formattedRentals = rentals.map(rental => ({
      id: rental.id,
      customer: rental.customer || 'غير محدد',
      game: rental.game || 'غير محدد',
      branch: rental.branch || 'غير محدد',
      time: rental.minutes_ago < 60 
        ? `منذ ${rental.minutes_ago} دقيقة`
        : rental.minutes_ago < 1440
        ? `منذ ${Math.floor(rental.minutes_ago / 60)} ساعة`
        : `منذ ${Math.floor(rental.minutes_ago / 1440)} يوم`,
      status: rental.status_arabic
    }));
    
    res.json({
      success: true,
      data: formattedRentals
    });
  } catch (error) {
    console.error('Recent rentals error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// 🏆 TOP GAMES
app.get('/api/dashboard/top-games', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    const [games] = await connection.execute(`
      SELECT g.name, 
             COUNT(r.id) as rental_count,
             COALESCE(SUM(r.total_price), 0) as revenue
      FROM games g
      LEFT JOIN rentals r ON g.id = r.game_id
      WHERE r.payment_status = 'paid'
      GROUP BY g.id, g.name
      ORDER BY revenue DESC
      LIMIT 5
    `);
    
    await connection.end();
    
    res.json({
      success: true,
      data: games.map(game => ({
        name: game.name,
        rentals: game.rental_count,
        revenue: game.revenue
      }))
    });
  } catch (error) {
    console.error('Top games error:', error);
    res.status(500).json({
      success: false,
      message: 'حدث خطأ في الخادم'
    });
  }
});

// HEALTH CHECK
app.get('/api/health', async (req, res) => {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'l3bty_rental'
    });
    
    await connection.end();
    
    res.json({
      success: true,
      status: 'running',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'running',
      database: 'disconnected',
      error: error.message
    });
  }
});

// API INFO
app.get('/api', (req, res) => {
  res.json({
    success: true,
    name: 'L3BTY Rental System API',
    version: '1.0.0',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login'
      },
      users: {
        list: 'GET /api/users',
        create: 'POST /api/users'
      },
      games: {
        list: 'GET /api/games',
        create: 'POST /api/games'
      },
      branches: {
        list: 'GET /api/branches'
      },
      rentals: {
        list: 'GET /api/rentals'
      },
      dashboard: {
        stats: 'GET /api/dashboard/stats',
        recentRentals: 'GET /api/dashboard/recent-rentals',
        topGames: 'GET /api/dashboard/top-games'
      }
    }
  });
});

// ERROR HANDLING
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'حدث خطأ في الخادم',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
  🚀 L3BTY Rental System Backend
  ===============================
  📡 Port: ${PORT}
  🌐 URL: http://localhost:${PORT}
  🔗 API: http://localhost:${PORT}/api
  🏥 Health: http://localhost:${PORT}/api/health
  
  📊 Dashboard Stats: GET http://localhost:${PORT}/api/dashboard/stats
  👥 Users: GET http://localhost:${PORT}/api/users
  🎮 Games: GET http://localhost:${PORT}/api/games
  🏬 Branches: GET http://localhost:${PORT}/api/branches
  ⏱️ Rentals: GET http://localhost:${PORT}/api/rentals
  
  💡 بيانات اختبار:
  Admin: admin@l3bty.com / 123456
  Manager: manager@gazimall.com / 123456
  Employee: emp1@gazimall.com / 123456
  `);
});