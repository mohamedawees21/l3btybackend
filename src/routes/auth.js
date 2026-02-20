// في دالة تسجيل الدخول، تحديث last_login بعد المصادقة
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // التحقق من المستخدم
        const query = `
            SELECT u.*, b.name as branch_name 
            FROM users u
            LEFT JOIN branches b ON u.branch_id = b.id
            WHERE u.email = ? AND u.password = ?
        `;
        
        const [users] = await db.query(query, [email, password]);
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
            });
        }
        
        const user = users[0];
        
        // 🔹 تحديث last_login
        await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        // توليد التوكن
        const token = generateToken(user);
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                name: user.name,
                role: user.role,
                branch_id: user.branch_id,
                branch_name: user.branch_name,
                phone: user.phone,
                last_login: user.last_login
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
});