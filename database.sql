-- حذف قاعدة البيانات إذا كانت موجودة وإنشاؤها من جديد
DROP DATABASE IF EXISTS l3bty_rental;
CREATE DATABASE l3bty_rental CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE l3bty_rental;

-- جدول الفروع
CREATE TABLE branches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المستخدمين
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'branch_manager', 'employee') DEFAULT 'employee',
    branch_id INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    INDEX idx_username (username),
    INDEX idx_role (role),
    INDEX idx_branch (branch_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الألعاب
CREATE TABLE games (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    branch_id INT NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    last_maintenance DATE,
    next_maintenance DATE,
    total_rentals INT DEFAULT 0,
    total_hours INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    INDEX idx_branch (branch_id),
    INDEX idx_available (is_available),
    INDEX idx_active (is_active),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الأسعار
CREATE TABLE pricing (
    id INT PRIMARY KEY AUTO_INCREMENT,
    game_type VARCHAR(50) NOT NULL,
    duration INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_game_duration (game_type, duration),
    INDEX idx_game_type (game_type),
    INDEX idx_duration (duration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول التأجيرات
CREATE TABLE rentals (
    id VARCHAR(50) PRIMARY KEY,
    game_id INT NOT NULL,
    game_type VARCHAR(50) NOT NULL,
    branch_id INT NOT NULL,
    employee_id INT NOT NULL,
    customer_name VARCHAR(100),
    customer_phone VARCHAR(20),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'active', 'completed', 'cancelled') DEFAULT 'active',
    cancellation_reason TEXT,
    cancelled_by INT,
    cancelled_at DATETIME,
    completed_at DATETIME,
    extension_count INT DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    refund_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_branch_status (branch_id, status),
    INDEX idx_start_time (start_time),
    INDEX idx_game_status (game_id, status),
    INDEX idx_employee (employee_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول سجلات النشاط
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_action (user_id, action),
    INDEX idx_created_at (created_at),
    INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الإحصائيات اليومية
CREATE TABLE daily_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    branch_id INT NOT NULL,
    stat_date DATE NOT NULL,
    total_rentals INT DEFAULT 0,
    total_revenue DECIMAL(15,2) DEFAULT 0,
    total_cancellations INT DEFAULT 0,
    cancellation_revenue DECIMAL(15,2) DEFAULT 0,
    avg_rental_time DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_branch_date (branch_id, stat_date),
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
    INDEX idx_stat_date (stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول الإشعارات
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'warning', 'success', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- إضافة بيانات تجريبية
INSERT INTO branches (name, location, phone, email) VALUES
('الفرع الرئيسي', 'القاهرة - مدينة نصر', '01012345678', 'main@l3bty.com'),
('فرع الجيزة', 'الجيزة - الدقي', '01087654321', 'giza@l3bty.com');

INSERT INTO users (username, email, password, name, role, branch_id) VALUES
('admin', 'admin@l3bty.com', '$2a$10$YourHashedPasswordHere', 'المدير العام', 'admin', 1),
('manager1', 'manager1@l3bty.com', '$2a$10$YourHashedPasswordHere', 'أحمد محمد', 'branch_manager', 1),
('employee1', 'employee1@l3bty.com', '$2a$10$YourHashedPasswordHere', 'محمد أحمد', 'employee', 1);

-- إضافة الألعاب مع كلمة مرور افتراضية: 123456
UPDATE users SET password = '$2a$10$N9qo8uLOickgx2ZMRZoMye1s4D3R5HPpZ3JXqI5QdG7pN1J7wLX7K' 
WHERE username IN ('admin', 'manager1', 'employee1');