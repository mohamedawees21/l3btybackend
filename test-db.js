// test-db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDatabase() {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'l3bty_store_db'
    });

    console.log('🔍 فحص قاعدة البيانات...\n');

    // 1. التحقق من الاتصال
    console.log('1. 🔌 اختبار الاتصال بقاعدة البيانات...');
    await pool.execute('SELECT 1');
    console.log('   ✅ الاتصال يعمل\n');

    // 2. التحقق من الجداول
    console.log('2. 📊 التحقق من الجداول...');
    const [tables] = await pool.execute('SHOW TABLES');
    console.log('   📋 الجداول الموجودة:');
    tables.forEach(table => {
      console.log(`     - ${table[Object.keys(table)[0]]}`);
    });
    console.log();

    // 3. التحقق من جدول users
    console.log('3. 👥 التحقق من جدول users...');
    try {
      const [users] = await pool.execute('SELECT * FROM users LIMIT 5');
      console.log(`   👥 عدد المستخدمين: ${users.length}`);
      if (users.length > 0) {
        console.log('   📋 المستخدمون:');
        users.forEach(user => {
          console.log(`     - ${user.name} (${user.email}) - ${user.role}`);
        });
      } else {
        console.log('   ⚠️  لا يوجد مستخدمين في قاعدة البيانات');
      }
    } catch (error) {
      console.log('   ❌ جدول users غير موجود أو به مشكلة');
    }
    console.log();

    // 4. التحقق من جدول branches
    console.log('4. 🏬 التحقق من جدول branches...');
    try {
      const [branches] = await pool.execute('SELECT * FROM branches LIMIT 5');
      console.log(`   🏬 عدد الفروع: ${branches.length}`);
    } catch (error) {
      console.log('   ❌ جدول branches غير موجود');
    }

    await pool.end();
    
    console.log('\n✅ اختبار قاعدة البيانات اكتمل بنجاح!');
    
  } catch (error) {
    console.error('❌ خطأ في اختبار قاعدة البيانات:', error.message);
  }
}

testDatabase();