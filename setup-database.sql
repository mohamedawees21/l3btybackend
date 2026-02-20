-- setup-database.sql
-- إضافة الفروع الخمسة
INSERT INTO branches (name, location, is_active, working_hours) VALUES
('غازي مول', 'الرياض', 1, '{"open": "10:00", "close": "23:00"}'),
('سكوير مول', 'الرياض', 1, '{"open": "10:00", "close": "23:00"}'),
('زمزم مول', 'الرياض', 1, '{"open": "10:00", "close": "23:00"}'),
('نادي اكتوبر', 'الرياض', 1, '{"open": "10:00", "close": "23:00"}'),
('نادي الجزيرة', 'الرياض', 1, '{"open": "10:00", "close": "23:00"}');

-- إضافة الألعاب الأساسية
INSERT INTO games (name, category, is_active, image_url) VALUES
('دريفت كار', 'CARS', 1, 'drift-car.jpg'),
('هافر بورد', 'ELECTRIC', 1, 'hoverboard.jpg'),
('موتسكل كهربائي', 'ELECTRIC', 1, 'electric-bike.jpg'),
('عربيه كهربائيه', 'CARS', 1, 'electric-car.jpg'),
('سكوتر كهربائي', 'ELECTRIC', 1, 'electric-scooter.jpg'),
('هارلي', 'MOTORCYCLE', 1, 'harley.jpg'),
('سيجواي', 'ELECTRIC', 1, 'segway.jpg'),
('كريزي كار', 'CARS', 1, 'crazy-car.jpg');

-- إضافة أسعار للفروع (مثال: فرع غازي مول)
INSERT INTO pricing (branch_id, game_id, price_per_hour) VALUES
-- فرع غازي مول
(1, 1, 120.00), -- دريفت كار
(1, 2, 60.00),  -- هافر بورد
(1, 3, 100.00), -- موتسكل كهربائي
(1, 4, 150.00), -- عربيه كهربائيه
(1, 5, 50.00),  -- سكوتر كهربائي
(1, 6, 180.00), -- هارلي
(1, 7, 70.00),  -- سيجواي
(1, 8, 130.00); -- كريزي كار

-- إضافة موظفين لكل فرع
INSERT INTO users (username, email, password, name, role, branch_id, is_active) VALUES
-- فرع غازي مول
('gasimol_emp1', 'emp1@gasimol.com', '$2a$10$...', 'محمد علي', 'employee', 1, 1),
('gasimol_emp2', 'emp2@gasimol.com', '$2a$10$...', 'أحمد سعيد', 'employee', 1, 1),

-- فرع سكوير مول
('square_emp1', 'emp1@square.com', '$2a$10$...', 'خالد محمد', 'employee', 2, 1),
('square_mgr1', 'mgr1@square.com', '$2a$10$...', 'سعود أحمد', 'branch_manager', 2, 1),

-- فرع زمزم مول
('zamzam_emp1', 'emp1@zamzam.com', '$2a$10$...', 'فهد راشد', 'employee', 3, 1),

-- نادي اكتوبر
('october_emp1', 'emp1@october.com', '$2a$10$...', 'نواف خالد', 'employee', 4, 1),

-- نادي الجزيرة
('jazira_emp1', 'emp1@jazira.com', '$2a$10$...', 'تركي محمد', 'employee', 5, 1);