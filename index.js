const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { testLogin } = require('./auth');
const mysql = require('mysql2/promise');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'l3bty-secret-key-2024';

// إنشاء خادم WebSocket
const http = require('http');
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
  server,
  path: '/ws',
  clientTracking: true
});
// إنشاء اتصال قاعدة البيانات
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'l3bty_rental_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware للتحقق من التوكن
// Middleware للتحقق من التوكن
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 Authentication attempt:', {
      hasToken: !!token,
      path: req.path,
      method: req.method
    });

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'التوكن مطلوب' 
      });
    }

    // تحقق من التوكن
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token decoded:', decoded);

    // جلب بيانات الموظف
    const [employees] = await pool.execute(
      `SELECT e.*, b.name as branch_name, b.status as branch_status 
       FROM employees e 
       LEFT JOIN branches b ON e.branch_id = b.id 
       WHERE e.id = ? AND e.status = 'active' AND e.deleted_at IS NULL`,
      [decoded.id]
    );

    if (employees.length === 0) {
      console.log('❌ Employee not found or inactive');
      return res.status(401).json({ 
        success: false, 
        message: 'المستخدم غير موجود أو غير نشط' 
      });
    }

    req.user = employees[0];
    console.log('👤 User authenticated:', req.user.email);
    next();
    
  } catch (error) {
    console.error('❌ Token verification error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ 
        success: false, 
        message: 'توكن غير صالح' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ 
        success: false, 
        message: 'التوكن منتهي الصلاحية' 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'خطأ في التحقق من التوكن' 
    });
  }
};

// Middleware للتحقق من الصلاحيات
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'غير مصرح لك بهذا الإجراء' 
            });
        }
        next();
    };
};

// تسجيل النشاط في قاعدة البيانات
const logActivity = async (employeeId, action, tableName = null, recordId = null, oldValues = null, newValues = null, req = null) => {
    try {
        const ip = req ? req.ip : null;
        const userAgent = req ? req.headers['user-agent'] : null;
        
        await pool.execute(
            `INSERT INTO activity_logs 
            (employee_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, action, tableName, recordId, 
             oldValues ? JSON.stringify(oldValues) : null, 
             newValues ? JSON.stringify(newValues) : null,
             ip, userAgent]
        );
    } catch (error) {
        console.error('Error logging activity:', error);
    }
};

// WebSocket للتواصل الحي
const connectedClients = new Map();

wss.on('connection', (ws, req) => {
    const clientId = Date.now();
    connectedClients.set(clientId, ws);
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            if (data.type === 'subscribe_rentals') {
                ws.branchId = data.branchId;
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        connectedClients.delete(clientId);
    });
});

// وظيفة بث تحديثات للتأجيرات
const broadcastRentalUpdate = (branchId, rentalData) => {
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.branchId === branchId) {
            client.send(JSON.stringify({
                type: 'rental_update',
                data: rentalData
            }));
        }
    });
};

// وظيفة بث تنبيهات انتهاء الوقت
const broadcastTimerAlert = (branchId, alertData) => {
    connectedClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.branchId === branchId) {
            client.send(JSON.stringify({
                type: 'timer_alert',
                data: alertData
            }));
        }
    });
};

// توليد كود تأجير فريد
const generateRentalCode = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `R${timestamp}${random}`;
};

// ====================== Routes ======================

// 1. Authentication Routes
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'البريد الإلكتروني وكلمة المرور مطلوبان' 
            });
        }

        const [employees] = await pool.execute(
            'SELECT e.*, b.name as branch_name FROM employees e LEFT JOIN branches b ON e.branch_id = b.id WHERE e.email = ? AND e.deleted_at IS NULL',
            [email]
        );

        if (employees.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
            });
        }

        const employee = employees[0];

        if (employee.status !== 'active') {
            return res.status(401).json({ 
                success: false, 
                message: 'حسابك غير نشط. يرجى الاتصال بالمدير' 
            });
        }

        const validPassword = await bcrypt.compare(password, employee.password);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' 
            });
        }

        // التحقق من حالة الفرع
        const [branches] = await pool.execute(
            'SELECT status FROM branches WHERE id = ?',
            [employee.branch_id]
        );

        if (branches.length === 0 || branches[0].status !== 'active') {
            return res.status(401).json({ 
                success: false, 
                message: 'الفرع غير نشط حالياً' 
            });
        }

        const token = jwt.sign(
            { 
                id: employee.id, 
                email: employee.email, 
                role: employee.role,
                branch_id: employee.branch_id 
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        // إزالة كلمة المرور من الاستجابة
        delete employee.password;

        await logActivity(employee.id, 'LOGIN', null, null, null, null, req);

        res.json({
            success: true,
            token,
            user: employee
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في الخادم' 
        });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [branches] = await pool.execute(
            'SELECT name, location, status FROM branches WHERE id = ?',
            [req.user.branch_id]
        );

        const user = { ...req.user };
        delete user.password;
        
        if (branches.length > 0) {
            user.branch_info = branches[0];
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في الخادم' 
        });
    }
});

// 2. Rentals Routes
// بدء تأجير جديد مع التحقق من الشروط
app.post('/api/rentals', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { game_id, customer_name, customer_phone, duration_minutes, notes } = req.body;
        const employee_id = req.user.id;
        const branch_id = req.user.branch_id;

        // التحقق من البيانات المطلوبة
        if (!game_id || !customer_name || !duration_minutes) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'اللعبة واسم العميل والمدة مطلوبة' 
            });
        }

        // التحقق من أن الموظف نشط
        if (req.user.status !== 'active') {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'حساب الموظف غير نشط' 
            });
        }

        // التحقق من أن الفرع نشط
        const [branches] = await connection.execute(
            'SELECT status FROM branches WHERE id = ? AND deleted_at IS NULL',
            [branch_id]
        );

        if (branches.length === 0 || branches[0].status !== 'active') {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'الفرع غير نشط حالياً' 
            });
        }

        // التحقق من أن اللعبة متاحة في هذا الفرع
        const [games] = await connection.execute(
            `SELECT g.*, b.status as branch_status 
             FROM games g 
             JOIN branches b ON g.branch_id = b.id 
             WHERE g.id = ? AND g.branch_id = ? 
             AND g.deleted_at IS NULL AND b.deleted_at IS NULL`,
            [game_id, branch_id]
        );

        if (games.length === 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'اللعبة غير موجودة في هذا الفرع' 
            });
        }

        const game = games[0];

        if (game.status !== 'available') {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'اللعبة غير متاحة للتأجير حالياً' 
            });
        }

        if (game.branch_status !== 'active') {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'فرع اللعبة غير نشط' 
            });
        }

        // حساب السعر
        let finalPrice;
        const [prices] = await connection.execute(
            'SELECT price FROM prices WHERE game_id = ? AND branch_id = ? AND duration_minutes = ?',
            [game_id, branch_id, duration_minutes]
        );

        if (prices.length > 0) {
            finalPrice = prices[0].price;
        } else {
            // حساب السعر بناءً على السعر لكل 15 دقيقة
            const blocks = Math.ceil(duration_minutes / 15);
            finalPrice = blocks * game.price_per_15min;
        }

        const rentalCode = generateRentalCode();
        const startTime = new Date();

        // إنشاء التأجير
        const [result] = await connection.execute(
            `INSERT INTO rentals 
            (rental_code, game_id, branch_id, employee_id, customer_name, customer_phone, 
             start_time, duration_minutes, original_price, final_price, status, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rentalCode, game_id, branch_id, employee_id, customer_name, customer_phone,
             startTime, duration_minutes, finalPrice, finalPrice, 'active', notes]
        );

        const rentalId = result.insertId;

        // تحديث حالة اللعبة إلى مؤجرة
        await connection.execute(
            'UPDATE games SET status = ? WHERE id = ?',
            ['rented', game_id]
        );

        // إنشاء تايمر للتأجير
        await connection.execute(
            'INSERT INTO rental_timers (rental_id, remaining_minutes) VALUES (?, ?)',
            [rentalId, duration_minutes]
        );

        // تسجيل الدفع
        await connection.execute(
            `INSERT INTO payments (rental_id, payment_method, amount, status) 
            VALUES (?, 'cash', ?, 'completed')`,
            [rentalId, finalPrice]
        );

        // تحديث الإحصائيات اليومية
        const today = new Date().toISOString().split('T')[0];
        await connection.execute(
            `INSERT INTO daily_statistics (branch_id, date, total_rentals, total_revenue) 
            VALUES (?, ?, 1, ?) 
            ON DUPLICATE KEY UPDATE 
            total_rentals = total_rentals + 1, 
            total_revenue = total_revenue + ?`,
            [branch_id, today, finalPrice, finalPrice]
        );

        await connection.commit();

        // جلب بيانات التأجير الجديد
        const [rentals] = await pool.execute(
            `SELECT r.*, g.name as game_name, g.category, 
                    b.name as branch_name, e.name as employee_name
             FROM rentals r
             JOIN games g ON r.game_id = g.id
             JOIN branches b ON r.branch_id = b.id
             JOIN employees e ON r.employee_id = e.id
             WHERE r.id = ?`,
            [rentalId]
        );

        const newRental = rentals[0];

        // تسجيل النشاط
        await logActivity(employee_id, 'CREATE_RENTAL', 'rentals', rentalId, null, newRental, req);

        // بث التحديث لجميع العملاء المتصلين
        broadcastRentalUpdate(branch_id, {
            type: 'new_rental',
            rental: newRental
        });

        res.json({
            success: true,
            message: 'تم بدء التأجير بنجاح',
            rental: newRental
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create rental error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في بدء التأجير',
            error: error.message 
        });
    } finally {
        connection.release();
    }
});

// الحصول على التأجيرات النشطة
app.get('/api/rentals/active', authenticateToken, async (req, res) => {
    try {
        const { branch_id } = req.query;
        const employeeBranchId = req.user.branch_id;
        
        // التحقق من الصلاحيات: الموظف العادي لا يمكنه رؤية تأجيرات فروع أخرى
        let queryBranchId = employeeBranchId;
        
        if (req.user.role === 'admin' || req.user.role === 'manager') {
            if (branch_id && req.user.role === 'admin') {
                queryBranchId = branch_id;
            }
        }

        const [rentals] = await pool.execute(
            `SELECT r.*, g.name as game_name, g.category, g.image_url,
                    b.name as branch_name, e.name as employee_name,
                    rt.remaining_minutes,
                    TIMESTAMPADD(MINUTE, r.duration_minutes, r.start_time) as end_time_calculated,
                    CASE 
                        WHEN rt.remaining_minutes <= 0 THEN 'expired'
                        WHEN rt.remaining_minutes <= 5 THEN 'warning'
                        ELSE 'active'
                    END as timer_status
             FROM rentals r
             JOIN games g ON r.game_id = g.id
             JOIN branches b ON r.branch_id = b.id
             JOIN employees e ON r.employee_id = e.id
             LEFT JOIN rental_timers rt ON r.id = rt.rental_id
             WHERE r.status = 'active' 
             AND r.branch_id = ?
             AND r.deleted_at IS NULL
             ORDER BY r.start_time DESC`,
            [queryBranchId]
        );

        // التحقق من التأجيرات المنتهية
        const now = new Date();
        for (const rental of rentals) {
            const endTime = new Date(rental.end_time_calculated);
            if (endTime < now && rental.status === 'active') {
                // تحديث حالة التأجير إلى منتهي
                await pool.execute(
                    'UPDATE rentals SET status = ? WHERE id = ?',
                    ['expired', rental.id]
                );
                
                // إرجاع اللعبة للمتاحة
                await pool.execute(
                    'UPDATE games SET status = ? WHERE id = ?',
                    ['available', rental.game_id]
                );

                // بث تنبيه
                broadcastTimerAlert(rental.branch_id, {
                    type: 'rental_expired',
                    rental_id: rental.id,
                    game_name: rental.game_name,
                    customer_name: rental.customer_name
                });
            }
        }

        res.json({
            success: true,
            rentals
        });

    } catch (error) {
        console.error('Get active rentals error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في جلب التأجيرات' 
        });
    }
});

// إلغاء التأجير (خلال أول 3 دقائق فقط)
app.post('/api/rentals/:id/cancel', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const rentalId = req.params.id;
        const { reason } = req.body;
        const employee_id = req.user.id;

        // جلب بيانات التأجير
        const [rentals] = await connection.execute(
            `SELECT r.*, g.name as game_name 
             FROM rentals r 
             JOIN games g ON r.game_id = g.id 
             WHERE r.id = ? AND r.deleted_at IS NULL`,
            [rentalId]
        );

        if (rentals.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false, 
                message: 'التأجير غير موجود' 
            });
        }

        const rental = rentals[0];

        // التحقق من أن التأجير نشط
        if (rental.status !== 'active') {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'لا يمكن إلغاء تأجير غير نشط' 
            });
        }

        // التحقق من صلاحيات الموظف
        if (req.user.role !== 'admin' && rental.branch_id !== req.user.branch_id) {
            await connection.rollback();
            return res.status(403).json({ 
                success: false, 
                message: 'غير مصرح لك بإلغاء تأجير من فرع آخر' 
            });
        }

        // التحقق من وقت الإلغاء (3 دقائق فقط)
        const startTime = new Date(rental.start_time);
        const now = new Date();
        const diffMinutes = (now - startTime) / (1000 * 60);

        if (diffMinutes > 3) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'لا يمكن إلغاء التأجير بعد مرور 3 دقائق' 
            });
        }

        // تحديث حالة التأجير إلى ملغي
        await connection.execute(
            'UPDATE rentals SET status = ?, end_time = ? WHERE id = ?',
            ['canceled', now, rentalId]
        );

        // إرجاع اللعبة للمتاحة
        await connection.execute(
            'UPDATE games SET status = ? WHERE id = ?',
            ['available', rental.game_id]
        );

        // تسجيل عملية الإلغاء
        const [cancelResult] = await connection.execute(
            `INSERT INTO rental_cancellations 
            (rental_id, employee_id, reason, cancelled_within_3min, refund_amount) 
            VALUES (?, ?, ?, ?, ?)`,
            [rentalId, employee_id, reason, true, rental.final_price]
        );

        // تسجيل استرجاع المبلغ
        await connection.execute(
            `INSERT INTO payments (rental_id, payment_method, amount, status, notes) 
            VALUES (?, 'cash', ?, 'refunded', ?)`,
            [rentalId, rental.final_price, reason || 'إلغاء تأجير']
        );

        // تحديث الإحصائيات اليومية
        const today = new Date().toISOString().split('T')[0];
        await connection.execute(
            `UPDATE daily_statistics 
             SET total_cancellations = total_cancellations + 1,
                 total_refunded = total_refunded + ?
             WHERE branch_id = ? AND date = ?`,
            [rental.final_price, rental.branch_id, today]
        );

        await connection.commit();

        // تسجيل النشاط
        await logActivity(employee_id, 'CANCEL_RENTAL', 'rentals', rentalId, rental, { status: 'canceled' }, req);

        // بث التحديث
        broadcastRentalUpdate(rental.branch_id, {
            type: 'rental_cancelled',
            rental_id: rentalId,
            game_name: rental.game_name
        });

        res.json({
            success: true,
            message: 'تم إلغاء التأجير واسترجاع المبلغ بنجاح',
            cancelled_within_3min: true,
            refund_amount: rental.final_price
        });

    } catch (error) {
        await connection.rollback();
        console.error('Cancel rental error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في إلغاء التأجير' 
        });
    } finally {
        connection.release();
    }
});

// إنهاء التأجير
app.post('/api/rentals/:id/end', authenticateToken, async (req, res) => {
    try {
        const rentalId = req.params.id;
        const employee_id = req.user.id;

        // جلب بيانات التأجير
        const [rentals] = await pool.execute(
            `SELECT r.*, g.name as game_name 
             FROM rentals r 
             JOIN games g ON r.game_id = g.id 
             WHERE r.id = ? AND r.deleted_at IS NULL`,
            [rentalId]
        );

        if (rentals.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'التأجير غير موجود' 
            });
        }

        const rental = rentals[0];

        // التحقق من صلاحيات الموظف
        if (req.user.role !== 'admin' && rental.branch_id !== req.user.branch_id) {
            return res.status(403).json({ 
                success: false, 
                message: 'غير مصرح لك بإنهاء تأجير من فرع آخر' 
            });
        }

        const now = new Date();

        // تحديث حالة التأجير إلى مكتمل
        await pool.execute(
            'UPDATE rentals SET status = ?, end_time = ? WHERE id = ?',
            ['completed', now, rentalId]
        );

        // إرجاع اللعبة للمتاحة
        await pool.execute(
            'UPDATE games SET status = ? WHERE id = ?',
            ['available', rental.game_id]
        );

        // حذف التايمر
        await pool.execute('DELETE FROM rental_timers WHERE rental_id = ?', [rentalId]);

        // تسجيل النشاط
        await logActivity(employee_id, 'END_RENTAL', 'rentals', rentalId, rental, { status: 'completed', end_time: now }, req);

        res.json({
            success: true,
            message: 'تم إنهاء التأجير بنجاح'
        });

    } catch (error) {
        console.error('End rental error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في إنهاء التأجير' 
        });
    }
});

// تمديد التأجير
app.post('/api/rentals/:id/extend', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const rentalId = req.params.id;
        const { additional_minutes } = req.body;
        const employee_id = req.user.id;

        if (!additional_minutes || additional_minutes <= 0) {
            await connection.rollback();
            return res.status(400).json({ 
                success: false, 
                message: 'عدد الدقائق الإضافية مطلوب' 
            });
        }

        // جلب بيانات التأجير واللعبة
        const [rentals] = await connection.execute(
            `SELECT r.*, g.price_per_15min, g.name as game_name 
             FROM rentals r 
             JOIN games g ON r.game_id = g.id 
             WHERE r.id = ? AND r.status = 'active' AND r.deleted_at IS NULL`,
            [rentalId]
        );

        if (rentals.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false, 
                message: 'التأجير غير موجود أو غير نشط' 
            });
        }

        const rental = rentals[0];

        // التحقق من صلاحيات الموظف
        if (req.user.role !== 'admin' && rental.branch_id !== req.user.branch_id) {
            await connection.rollback();
            return res.status(403).json({ 
                success: false, 
                message: 'غير مصرح لك بتمديد تأجير من فرع آخر' 
            });
        }

        // حساب السعر الإضافي
        const blocks = Math.ceil(additional_minutes / 15);
        const additionalPrice = blocks * rental.price_per_15min;

        // تحديث بيانات التأجير
        const newDuration = rental.duration_minutes + additional_minutes;
        const newFinalPrice = rental.final_price + additionalPrice;

        await connection.execute(
            'UPDATE rentals SET duration_minutes = ?, final_price = ? WHERE id = ?',
            [newDuration, newFinalPrice, rentalId]
        );

        // تحديث التايمر
        await connection.execute(
            'UPDATE rental_timers SET remaining_minutes = remaining_minutes + ? WHERE rental_id = ?',
            [additional_minutes, rentalId]
        );

        // تسجيل الدفعة الإضافية
        await connection.execute(
            `INSERT INTO payments (rental_id, payment_method, amount, status, notes) 
            VALUES (?, 'cash', ?, 'completed', ?)`,
            [rentalId, additionalPrice, `تمديد ${additional_minutes} دقيقة`]
        );

        // تحديث الإحصائيات
        const today = new Date().toISOString().split('T')[0];
        await connection.execute(
            `UPDATE daily_statistics 
             SET total_revenue = total_revenue + ?
             WHERE branch_id = ? AND date = ?`,
            [additionalPrice, rental.branch_id, today]
        );

        await connection.commit();

        // تسجيل النشاط
        await logActivity(employee_id, 'EXTEND_RENTAL', 'rentals', rentalId, 
            { duration: rental.duration_minutes, price: rental.final_price },
            { duration: newDuration, price: newFinalPrice }, req);

        res.json({
            success: true,
            message: `تم تمديد التأجير ${additional_minutes} دقيقة`,
            additional_price: additionalPrice,
            new_duration: newDuration,
            new_total_price: newFinalPrice
        });

    } catch (error) {
        await connection.rollback();
        console.error('Extend rental error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في تمديد التأجير' 
        });
    } finally {
        connection.release();
    }
});

// 3. Games Routes
app.get('/api/games/available', authenticateToken, async (req, res) => {
    try {
        const { branch_id } = req.query;
        let queryBranchId = req.user.branch_id;

        // المدير والإدمن يمكنهم رؤية ألعاب فروع أخرى
        if ((req.user.role === 'admin' || req.user.role === 'manager') && branch_id) {
            queryBranchId = branch_id;
        }

        const [games] = await pool.execute(
            `SELECT g.*, b.name as branch_name, b.status as branch_status,
                    (SELECT price FROM prices WHERE game_id = g.id AND branch_id = g.branch_id AND duration_minutes = 15 LIMIT 1) as price_15min,
                    (SELECT price FROM prices WHERE game_id = g.id AND branch_id = g.branch_id AND duration_minutes = 30 LIMIT 1) as price_30min,
                    (SELECT price FROM prices WHERE game_id = g.id AND branch_id = g.branch_id AND duration_minutes = 60 LIMIT 1) as price_60min
             FROM games g
             JOIN branches b ON g.branch_id = b.id
             WHERE g.branch_id = ? 
             AND g.status = 'available'
             AND g.deleted_at IS NULL 
             AND b.deleted_at IS NULL
             ORDER BY g.name`,
            [queryBranchId]
        );

        res.json({
            success: true,
            games
        });

    } catch (error) {
        console.error('Get available games error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في جلب الألعاب' 
        });
    }
});

// 4. Admin Dashboard Routes
app.get('/api/admin/dashboard', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        // إحصائيات عامة
        const [[stats]] = await pool.execute(`
            SELECT 
                (SELECT COUNT(*) FROM rentals WHERE status = 'active') as active_rentals,
                (SELECT COUNT(*) FROM rentals WHERE DATE(start_time) = ?) as today_rentals,
                (SELECT SUM(final_price) FROM rentals WHERE DATE(start_time) = ?) as today_revenue,
                (SELECT COUNT(*) FROM branches WHERE status = 'active' AND deleted_at IS NULL) as active_branches,
                (SELECT COUNT(*) FROM employees WHERE status = 'active' AND deleted_at IS NULL) as active_employees,
                (SELECT COUNT(*) FROM games WHERE status = 'available' AND deleted_at IS NULL) as available_games
        `, [today, today]);

        // إيرادات الشهر
        const [[monthlyStats]] = await pool.execute(`
            SELECT 
                COALESCE(SUM(final_price), 0) as month_revenue,
                COALESCE(COUNT(*), 0) as month_rentals
            FROM rentals 
            WHERE DATE(start_time) >= ?
        `, [startOfMonth]);

        // أكثر الألعاب ربحاً
        const [topGames] = await pool.execute(`
            SELECT g.name, COUNT(r.id) as rental_count, SUM(r.final_price) as total_revenue
            FROM rentals r
            JOIN games g ON r.game_id = g.id
            WHERE DATE(r.start_time) >= ?
            GROUP BY g.id
            ORDER BY total_revenue DESC
            LIMIT 10
        `, [startOfMonth]);

        // أداء الفروع
        const [branchesPerformance] = await pool.execute(`
            SELECT b.name, 
                   COUNT(r.id) as rental_count,
                   COALESCE(SUM(r.final_price), 0) as total_revenue,
                   COALESCE(SUM(CASE WHEN r.status = 'canceled' THEN 1 ELSE 0 END), 0) as cancellations
            FROM branches b
            LEFT JOIN rentals r ON b.id = r.branch_id AND DATE(r.start_time) >= ?
            WHERE b.deleted_at IS NULL
            GROUP BY b.id
            ORDER BY total_revenue DESC
        `, [startOfMonth]);

        // آخر التأجيرات
        const [recentRentals] = await pool.execute(`
            SELECT r.*, g.name as game_name, b.name as branch_name, e.name as employee_name
            FROM rentals r
            JOIN games g ON r.game_id = g.id
            JOIN branches b ON r.branch_id = b.id
            JOIN employees e ON r.employee_id = e.id
            ORDER BY r.start_time DESC
            LIMIT 20
        `);

        res.json({
            success: true,
            stats: {
                ...stats,
                ...monthlyStats
            },
            top_games: topGames,
            branches_performance: branchesPerformance,
            recent_rentals: recentRentals
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في جلب بيانات لوحة التحكم' 
        });
    }
});

// 5. Reports Routes
app.get('/api/reports/rentals', authenticateToken, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { start_date, end_date, branch_id, status } = req.query;
        
        let whereClause = 'WHERE r.deleted_at IS NULL';
        const params = [];

        if (start_date && end_date) {
            whereClause += ' AND DATE(r.start_time) BETWEEN ? AND ?';
            params.push(start_date, end_date);
        }

        if (branch_id && (req.user.role === 'admin' || branch_id == req.user.branch_id)) {
            whereClause += ' AND r.branch_id = ?';
            params.push(branch_id);
        } else if (req.user.role !== 'admin') {
            whereClause += ' AND r.branch_id = ?';
            params.push(req.user.branch_id);
        }

        if (status) {
            whereClause += ' AND r.status = ?';
            params.push(status);
        }

        const [rentals] = await pool.execute(`
            SELECT r.*, g.name as game_name, b.name as branch_name, e.name as employee_name,
                   CASE 
                       WHEN r.status = 'canceled' AND EXISTS (
                           SELECT 1 FROM rental_cancellations rc 
                           WHERE rc.rental_id = r.id AND rc.cancelled_within_3min = 1
                       ) THEN 'within_3min'
                       WHEN r.status = 'canceled' THEN 'after_3min'
                       ELSE r.status
                   END as detailed_status
            FROM rentals r
            JOIN games g ON r.game_id = g.id
            JOIN branches b ON r.branch_id = b.id
            JOIN employees e ON r.employee_id = e.id
            ${whereClause}
            ORDER BY r.start_time DESC
            LIMIT 500
        `, params);

        res.json({
            success: true,
            rentals,
            count: rentals.length
        });

    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'حدث خطأ في جلب التقارير' 
        });
    }
});

// 6. Health Check
app.get('/api/health', async (req, res) => {
    try {
        // التحقق من اتصال قاعدة البيانات
        await pool.execute('SELECT 1');
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            database: 'connected',
            websocket_clients: connectedClients.size
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// 7. WebSocket Endpoint
app.get('/api/ws', (req, res) => {
    res.json({
        success: true,
        message: 'WebSocket server is running',
        client_count: connectedClients.size
    });
});

// بدء الخادم
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 API URL: http://localhost:${PORT}/api`);
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
    console.log(`👤 Default Admin: admin@l3bty.com / 123456`);
});


