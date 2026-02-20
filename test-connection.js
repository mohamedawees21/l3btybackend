console.log('🔍 اختبار اتصال MySQL البسيط');
console.log('===========================');

const mysql = require('mysql2');

// محاولة الاتصال بدون قاعدة بيانات أولاً
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: ''
});

connection.connect((err) => {
  if (err) {
    console.log('❌ فشل الاتصال بـ MySQL:', err.message);
    console.log('\n🔧 حاول الآتي:');
    console.log('   1. افتح XAMPP Control Panel');
    console.log('   2. اضغط Start على MySQL');
    console.log('   3. تأكد من عدم وجود كلمة مرور');
    console.log('   4. جرب في CMD: mysql -u root');
  } else {
    console.log('✅ الاتصال بـ MySQL ناجح!');
    
    // التحقق من وجود قاعدة البيانات
    connection.query('SHOW DATABASES LIKE "l3bty_rental"', (err, results) => {
      if (err) {
        console.log('❌ خطأ في الاستعلام:', err.message);
      } else if (results.length > 0) {
        console.log('✅ قاعدة البيانات موجودة');
      } else {
        console.log('⚠️ قاعدة البيانات غير موجودة');
        console.log('📝 جاري إنشاء قاعدة البيانات...');
        
        connection.query('CREATE DATABASE IF NOT EXISTS l3bty_rental', (err) => {
          if (err) {
            console.log('❌ فشل إنشاء قاعدة البيانات:', err.message);
          } else {
            console.log('✅ تم إنشاء قاعدة البيانات بنجاح');
          }
          connection.end();
        });
      }
    });
  }
});