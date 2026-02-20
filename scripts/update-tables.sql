-- scripts/update-tables.sql

-- تحديث جدول rentals
ALTER TABLE rentals
ADD COLUMN expires_at DATETIME AFTER started_at,
ADD COLUMN canceled_at DATETIME AFTER completed_at,
ADD COLUMN canceled_by INT AFTER canceled_at,
ADD COLUMN cancel_reason TEXT AFTER canceled_by,
ADD COLUMN deleted_at DATETIME AFTER updated_at,
MODIFY COLUMN status ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELED') DEFAULT 'PENDING';

-- إنشاء جدول activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- إنشاء جدول notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- إنشاء indexes للأداء
CREATE INDEX idx_rentals_branch_status ON rentals(branch_id, status);
CREATE INDEX idx_rentals_started_at ON rentals(started_at);
CREATE INDEX idx_rentals_employee ON rentals(employee_id);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);