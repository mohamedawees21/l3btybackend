// stable-server.js - خادم مستقر لا يتوقف
const express = require('express');
const app = express();

console.log('🚀 بدء تشغيل L3BTY Server...');

// Middleware بسيط
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// Routes الأساسية
app.get('/', (req, res) => {
    console.log('📨 طلب GET /');
    res.json({
        message: '🎮 L3BTY Rental System v1.0',
        status: 'active',
        server: 'stable',
        endpoints: {
            dashboard: 'GET /api/dashboard/:id',
            games: 'GET /api/games/:id',
            login: 'POST /api/auth/login'
        }
    });
});

app.get('/api/dashboard/:id', (req, res) => {
    console.log(`📊 Dashboard للفرع ${req.params.id}`);
    res.json({
        success: true,
        branchId: req.params.id,
        stats: {
            totalGames: 7,
            activeRentals: 3,
            availableGames: 4,
            dailyRevenue: 450,
            monthlyRevenue: 13500,
            topGame: 'دريفت كار'
        },
        timestamp: new Date().toISOString()
    });
});

app.get('/api/games/:id', (req, res) => {
    console.log(`🎮 الألعاب للفرع ${req.params.id}`);
    
    const games = [
        { id: 1, name: 'دريفت كار', type: 'Car', price: 50, status: 'available', branch: 'سكوير مول' },
        { id: 2, name: 'عربيه كهربائيه', type: 'Electric', price: 50, status: 'available', branch: 'سكوير مول' },
        { id: 3, name: 'موتسكل كهربائي', type: 'Motorcycle', price: 50, status: 'rented', branch: 'سكوير مول' },
        { id: 4, name: 'هارلي', type: 'Motorcycle', price: 60, status: 'available', branch: 'سكوير مول' },
        { id: 5, name: 'سكوتر كهربائي', type: 'Scooter', price: 60, status: 'available', branch: 'سكوير مول' },
        { id: 6, name: 'هافر بورد', type: 'Board', price: 50, status: 'available', branch: 'سكوير مول' },
        { id: 7, name: 'كريزي كار', type: 'Car', price: 60, status: 'rented', branch: 'سكوير مول' }
    ];
    
    res.json({
        success: true,
        count: games.length,
        games: games,
        branch: 'سكوير مول'
    });
});

app.post('/api/auth/login', (req, res) => {
    console.log('🔐 محاولة تسجيل دخول:', req.body.email || 'no email');
    
    // بيانات وهمية للتسجيل
    const users = {
        'admin@l3bty.com': { id: 1, name: 'مدير النظام', role: 'admin', branch: 'جميع الفروع' },
        'manager@l3bty.com': { id: 2, name: 'مدير فرع', role: 'manager', branch: 'سكوير مول' },
        'staff@l3bty.com': { id: 3, name: 'موظف', role: 'staff', branch: 'سكوير مول' }
    };
    
    const { email, password } = req.body;
    const user = users[email];
    
    if (user && (password === '123456' || password === 'admin123')) {
        res.json({
            success: true,
            message: `مرحباً ${user.name}!`,
            token: `l3bty_${user.role}_${Date.now()}`,
            user: user,
            permissions: ['dashboard', 'games', 'rentals']
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'بيانات الدخول غير صحيحة'
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'الرابط غير موجود',
        path: req.path,
        method: req.method
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        success: false,
        message: 'خطأ داخلي في الخادم',
        error: err.message
    });
});

// تشغيل الخادم
const PORT = 5000;
app.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('✅ L3BTY RENTAL SYSTEM - SERVER STARTED');
    console.log('='.repeat(60));
    console.log(`🌐 Base URL: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard/1`);
    console.log(`🎮 Games: http://localhost:${PORT}/api/games/1`);
    console.log(`🔐 Login: POST http://localhost:${PORT}/api/auth/login`);
    console.log('='.repeat(60));
    console.log('📝 Test Commands:');
    console.log(`   curl http://localhost:${PORT}/`);
    console.log(`   curl http://localhost:${PORT}/api/dashboard/1`);
    console.log(`   curl http://localhost:${PORT}/api/games/1`);
    console.log('='.repeat(60));
    console.log('🚀 Server is stable and ready!');
});

// جعل الخادم يستمر عند الأخطاء
process.on('uncaughtException', (error) => {
    console.error('⚠️  Uncaught Exception:', error);
    console.log('🔄 Server will continue running...');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
});