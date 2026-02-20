-- backend/setup-database-final.sql
DROP DATABASE IF EXISTS l3bty_rental;
CREATE DATABASE l3bty_rental;
USE l3bty_rental;

-- ==================== الجداول الأساسية ====================

-- جدول الفروع (مصري)
CREATE TABLE branches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(50) NOT NULL DEFAULT 'القاهرة',
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    opening_time TIME DEFAULT '10:00:00',
    closing_time TIME DEFAULT '22:00:00',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول المستخدمين
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin', 'branch_manager', 'employee') DEFAULT 'employee',
    branch_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

-- جدول الألعاب (أسعار بالجنيه المصري)
CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category ENUM('سيارات', 'دراجات', 'سكوتر', 'عربات', 'كهربائية', 'أخرى') DEFAULT 'كهربائية',
    image_url VARCHAR(255),
    price_per_hour DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    price_per_15min DECIMAL(10,2) NOT NULL DEFAULT 30.00,
    min_rental_time INT DEFAULT 15,
    max_rental_time INT DEFAULT 120,
    branch_id INT NOT NULL,
    status ENUM('متاح', 'مؤجر', 'صيانة', 'محجوز') DEFAULT 'متاح',
    current_rental_id INT,
    specifications JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- جدول العملاء
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    id_number VARCHAR(20),
    notes TEXT,
    total_rentals INT DEFAULT 0,
    total_spent DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول التأجيرات (احترافي)
CREATE TABLE rentals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rental_number VARCHAR(50) UNIQUE NOT NULL,
    game_id INT NOT NULL,
    customer_id INT NOT NULL,
    user_id INT NOT NULL,
    branch_id INT NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    expected_end_time DATETIME,
    actual_end_time DATETIME NULL,
    duration_minutes INT,
    price_per_hour DECIMAL(10,2),
    subtotal DECIMAL(10,2),
    tax_rate DECIMAL(5,2) DEFAULT 14.00,
    tax_amount DECIMAL(10,2),
    total_amount DECIMAL(10,2),
    deposit DECIMAL(10,2) DEFAULT 0,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    remaining_amount DECIMAL(10,2) DEFAULT 0,
    status ENUM('نشط', 'مكتمل', 'ملغي', 'متأخر') DEFAULT 'نشط',
    payment_status ENUM('مدفوع', 'جزئي', 'غير مدفوع') DEFAULT 'غير مدفوع',
    payment_method ENUM('كاش', 'فيزا', 'فودافون كاش', 'شحن') DEFAULT 'كاش',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- جدول المدفوعات
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rental_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('كاش', 'فيزا', 'فودافون كاش', 'شحن') DEFAULT 'كاش',
    transaction_id VARCHAR(100),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول سجل النشاطات
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ==================== إدخال البيانات الحقيقية ====================

-- الفروع المصرية
INSERT INTO branches (name, location, city, contact_phone, contact_email) VALUES
('غازي مول', 'شارع النصر، مدينة نصر', 'القاهرة', '01001234567', 'gazimall@l3bty.com'),
('سكوير مول', 'الدقى، الجيزة', 'الجيزة', '01007654321', 'squaremall@l3bty.com'),
('زمزم مول', 'سموحة، الإسكندرية', 'الإسكندرية', '01009876543', 'zamzammall@l3bty.com'),
('نادي أكتوبر', 'مدينة 6 أكتوبر', 'الجيزة', '01005554444', 'october@l3bty.com'),
('نادي الجزيرة', 'الزمالك', 'القاهرة', '01003332222', 'gezira@l3bty.com');

-- المستخدمين (كلمات مرور: 123456)
INSERT INTO users (username, email, password, name, phone, role, branch_id) VALUES
-- المدير العام
('admin', 'admin@l3bty.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'المدير العام', '01000000001', 'admin', 1),

-- مدراء الفروع
('manager_gazi', 'manager@gazimall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'أحمد محمود', '01001112222', 'branch_manager', 1),
('manager_square', 'manager@squaremall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'محمد علي', '01002223333', 'branch_manager', 2),
('manager_zamzam', 'manager@zamzammall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'خالد سعيد', '01003334444', 'branch_manager', 3),

-- الموظفين
('emp_gazi1', 'emp1@gazimall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'محمود حسين', '01004445555', 'employee', 1),
('emp_gazi2', 'emp2@gazimall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'سعيد فؤاد', '01005556666', 'employee', 1),
('emp_square1', 'emp1@squaremall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'فاطمة أحمد', '01006667777', 'employee', 2),
('emp_zamzam1', 'emp1@zamzammall.com', '$2a$10$YMi9n/3u5KMOuqFAIBpMKOvYB3okUHyXMOwbh722N8F.BrPv2q5G', 'عائشة محمد', '01007778888', 'employee', 3);

-- الألعاب (أسعار واقعية بالجنيه المصري)
INSERT INTO games (name, description, category, image_url, price_per_hour, price_per_15min, branch_id) VALUES
-- فرع غازي مول
('دريفت كار أحمر', 'سيارة درفت كهربائية للأطفال، سرعة متوسطة، ألوان زاهية', 'سيارات', 'drift-car.jpg', 150.00, 40.00, 1),
('هافر بورد إلكتروني', 'لوح توازن كهربائي، تحكم عن بعد، إضاءة LED', 'كهربائية', 'hoverboard.jpg', 120.00, 35.00, 1),
('دراجة كهربائية', 'دراجة كهربائية للكبار، بطارية 3 ساعات، سرعة 25 كم/س', 'دراجات', 'electric-bike.jpg', 200.00, 55.00, 1),
('سيارة كهربائية صغيرة', 'سيارة كهربائية للأطفال، مقعدين، تحكم عن بعد', 'عربات', 'electric-car.jpg', 180.00, 50.00, 1),
('سكوتر كهربائي', 'سكوتر كهربائي قابل للطي، سرعة 20 كم/س', 'سكوتر', 'electric-scooter.jpg', 100.00, 30.00, 1),

-- فرع سكوير مول
('دريفت كار أزرق', 'سيارة درفت كهربائية، تحكم دقيق، ألوان متعددة', 'سيارات', 'drift-car.jpg', 160.00, 45.00, 2),
('دراجة نارية صغيرة', 'دراجة نارية كهربائية، مناسبة للمراهقين', 'دراجات', 'harley.jpg', 220.00, 60.00, 2),
('عربة دفع رباعي', 'عربة دفع رباعي كهربائية، مناسبة للتضاريس', 'عربات', 'crazy-car.jpg', 250.00, 70.00, 2),
('سكوتر سيجواي', 'سكوتر توازن ذكي، تقنية متطورة', 'سكوتر', 'segway.jpg', 180.00, 50.00, 2),

-- فرع زمزم مول
('دريفت كار أخضر', 'سيارة درفت كهربائية، إضاءات LED، صوت محرك', 'سيارات', 'drift-car.jpg', 140.00, 40.00, 3),
('هافر بورد برو', 'هافر بورد محترف، سرعة عالية، مسافة طويلة', 'كهربائية', 'hoverboard.jpg', 130.00, 35.00, 3),
('دراجة كهربائية سريعة', 'دراجة كهربائية بسرعة 30 كم/س، بطارية 4 ساعات', 'دراجات', 'electric-bike.jpg', 210.00, 60.00, 3);

-- عملاء
INSERT INTO customers (name, phone, email, id_number) VALUES
('أحمد محمد', '01012345678', 'ahmed@example.com', '12345678901234'),
('سارة خالد', '01023456789', 'sara@example.com', '23456789012345'),
('محمد علي', '01034567890', NULL, '34567890123456'),
('فاطمة سعيد', '01045678901', 'fatma@example.com', '45678901234567'),
('خالد محمود', '01056789012', NULL, '56789012345678');

-- ==================== الفهارس ====================
CREATE INDEX idx_rentals_status ON rentals(status);
CREATE INDEX idx_rentals_rental_number ON rentals(rental_number);
CREATE INDEX idx_games_branch_status ON games(branch_id, status);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);

-- ==================== عرض البيانات ====================
SELECT '✅ قاعدة البيانات أنشئت بنجاح' as message;

SELECT 'الفروع' as table_name, COUNT(*) as count FROM branches
UNION ALL
SELECT 'المستخدمين', COUNT(*) FROM users
UNION ALL
SELECT 'الألعاب', COUNT(*) FROM games
UNION ALL
SELECT 'العملاء', COUNT(*) FROM customers;