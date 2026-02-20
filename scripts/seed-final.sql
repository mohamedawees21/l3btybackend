-- بيانات حقيقية للنظام
USE l3bty_rental;

-- 1. إضافة فروع حقيقية
INSERT INTO branches (name, location, phone, email) VALUES
('الفرع الرئيسي - مدينة نصر', 'القاهرة - مدينة نصر - ميدان الاتحاد', '01012345678', 'main@l3bty.com'),
('فرع الجيزة - الدقي', 'الجيزة - الدقي - شارع جامعة القاهرة', '01087654321', 'giza@l3bty.com'),
('فرع المعادي', 'القاهرة - المعادي - كورنيش النيل', '01055556666', 'maadi@l3bty.com');

-- 2. إضافة مستخدمين حقيقيين (كلمة المرور: 123456)
INSERT INTO users (username, email, password, name, role, branch_id, is_active) VALUES
('admin', 'admin@l3bty.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s4D3R5HPpZ3JXqI5QdG7pN1J7wLX7K', 'المدير العام', 'admin', 1, TRUE),
('manager_cairo', 'manager.cairo@l3bty.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s4D3R5HPpZ3JXqI5QdG7pN1J7wLX7K', 'أحمد محمد', 'branch_manager', 1, TRUE),
('employee1', 'ahmed.ali@l3bty.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s4D3R5HPpZ3JXqI5QdG7pN1J7wLX7K', 'أحمد علي', 'employee', 1, TRUE),
('employee2', 'sara.mohamed@l3bty.com', '$2a$10$N9qo8uLOickgx2ZMRZoMye1s4D3R5HPpZ3JXqI5QdG7pN1J7wLX7K', 'سارة محمد', 'employee', 2, TRUE);

-- 3. إضافة ألعاب لكل فرع
-- الفرع الرئيسي
INSERT INTO games (name, type, description, base_price, branch_id, is_available, is_active) VALUES
('دريفت كار', 'DRIFT_CAR', 'سيارة درفت احترافية - سرعة عالية - تحكم دقيق', 50.00, 1, TRUE, TRUE),
('عربيه كهربائيه', 'ELECTRIC_CAR', 'سيارة كهربائية صديقة للبيئة - بطارية طويلة الأمد', 40.00, 1, TRUE, TRUE),
('موتسكل كهربائي', 'ELECTRIC_BIKE', 'دراجة نارية كهربائية - خفيفة الوزن - سرعة 60 كم/س', 30.00, 1, TRUE, TRUE),
('هافربورد', 'HOVERBOARD', 'لوح توازن كهربائي - تحكم بالجسم - بطارية 4 ساعات', 20.00, 1, TRUE, TRUE),
('هارلي', 'HARLEY', 'دراجة نارية أمريكية - صوت قوي - تصميم كلاسيكي', 60.00, 1, TRUE, TRUE);

-- فرع الجيزة
INSERT INTO games (name, type, description, base_price, branch_id, is_available, is_active) VALUES
('سكوتر كهربائي', 'ELECTRIC_SCOOTER', 'سكوتر كهربائي قابل للطي - مناسب للمسافات القصيرة', 15.00, 2, TRUE, TRUE),
('كريزي كار', 'CRAZY_CAR', 'سيارة بأداء عالي - تسارع سريع - تصميم رياضي', 45.00, 2, TRUE, TRUE),
('دريفت كار', 'DRIFT_CAR', 'سيارة درفت احترافية - نسخة مطورة', 55.00, 2, TRUE, TRUE);

-- 4. إضافة تأجيرات تجريبية
INSERT INTO rentals (id, game_id, game_type, branch_id, employee_id, customer_name, customer_phone, start_time, duration, price, status) VALUES
(UUID(), 1, 'DRIFT_CAR', 1, 3, 'محمد أحمد', '01011112222', DATE_SUB(NOW(), INTERVAL 2 HOUR), 60, 150, 'completed'),
(UUID(), 3, 'ELECTRIC_BIKE', 1, 3, 'فاطمة خالد', '01033334444', DATE_SUB(NOW(), INTERVAL 30 MINUTE), 45, 75, 'active'),
(UUID(), 2, 'ELECTRIC_CAR', 2, 4, 'علي محمود', '01055556666', DATE_SUB(NOW(), INTERVAL 3 HOUR), 90, 120, 'completed');

-- 5. إضافة إحصائيات
INSERT INTO daily_stats (branch_id, stat_date, total_rentals, total_revenue, total_cancellations, avg_rental_time) VALUES
(1, CURDATE(), 15, 1250.00, 2, 45.5),
(2, CURDATE(), 8, 680.00, 1, 38.2);

SELECT '✅ تم إضافة البيانات التجريبية بنجاح!' as message;