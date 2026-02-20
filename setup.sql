-- نظام الفروع المتكامل
CREATE TABLE IF NOT EXISTS branches (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255) NOT NULL,
  city VARCHAR(50) DEFAULT 'القاهرة',
  contact_phone VARCHAR(20),
  contact_email VARCHAR(100),
  opening_time TIME DEFAULT '10:00:00',
  closing_time TIME DEFAULT '22:00:00',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_branch_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- تصنيفات الألعاب
CREATE TABLE IF NOT EXISTS game_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- الألعاب الرئيسية (المخزون المركزي)
CREATE TABLE IF NOT EXISTS games_inventory (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  category_id INT,
  description TEXT,
  specifications JSON,
  image_url VARCHAR(500),
  minimum_age INT DEFAULT 12,
  max_weight INT DEFAULT 100,
  safety_instructions TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES game_categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ألعاب الفروع (توزيع الألعاب)
CREATE TABLE IF NOT EXISTS branch_games (
  id INT PRIMARY KEY AUTO_INCREMENT,
  branch_id INT NOT NULL,
  game_inventory_id INT NOT NULL,
  game_code VARCHAR(50) UNIQUE,
  price_per_hour DECIMAL(10,2) NOT NULL,
  price_per_15min DECIMAL(10,2),
  hourly_discount_rate DECIMAL(5,2) DEFAULT 0,
  status ENUM('متاح', 'مؤجر', 'صيانة', 'غير متاح') DEFAULT 'متاح',
  current_rental_id INT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
  FOREIGN KEY (game_inventory_id) REFERENCES games_inventory(id) ON DELETE CASCADE,
  INDEX idx_branch (branch_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- تحديث جدول التأجيرات
ALTER TABLE rentals 
  ADD COLUMN branch_game_id INT,
  ADD COLUMN actual_end_time DATETIME,
  ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0,
  MODIFY COLUMN status ENUM('نشط', 'مكتمل', 'ملغى') DEFAULT 'نشط',
  MODIFY COLUMN payment_status ENUM('غير مدفوع', 'مدفوع جزئياً', 'مدفوع', 'مدفوع إلكترونياً') DEFAULT 'غير مدفوع',
  ADD FOREIGN KEY (branch_game_id) REFERENCES branch_games(id);

-- تحديث جدول المستخدمين
ALTER TABLE users 
  ADD COLUMN last_login TIMESTAMP NULL,
  ADD FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL;

-- إضافة جدول سجل الأنشطة
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- إضافة بيانات تجريبية
INSERT INTO game_categories (name, description, icon) VALUES
('سيارات كهربائية', 'سيارات كهربائية متنوعة', '🚗'),
('دراجات كهربائية', 'دراجات وموتوسيكلات كهربائية', '🏍️'),
('هوفر بورد', 'ألواح هوفر بورد', '🛹'),
('سكوتر كهربائي', 'سكوترات كهربائية', '🛴'),
('ألعاب مائية', 'ألعاب كهربائية للاستخدام في الماء', '🌊');

-- إضافة فروع
INSERT INTO branches (name, location, city, contact_phone) VALUES
('الفرع الرئيسي', 'مدينة نصر، شارع التسعين', 'القاهرة', '01012345678'),
('فرع المعادي', 'المعادي الجديدة، شارع 9', 'القاهرة', '01087654321'),
('فرع الرحاب', 'مدينة الرحاب، الحي الأول', 'القاهرة', '01023456789');