const mysql = require('mysql2/promise');
require('dotenv').config();

// إعدادات قاعدة البيانات
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'l3bty_store_db',
  charset: process.env.DB_CHARSET || 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : undefined
});

// اختبار الاتصال
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ تم الاتصال بقاعدة البيانات: ${process.env.DB_NAME}`);
    connection.release();
  } catch (error) {
    console.error('❌ فشل الاتصال بقاعدة البيانات:', error.message);
    console.log('⚠️  تأكد من:');
    console.log('   1. أن MySQL يعمل');
    console.log('   2. بيانات الاتصال في ملف .env صحيحة');
    console.log('   3. أن قاعدة البيانات موجودة');
    process.exit(1);
  }
})();

module.exports = pool;