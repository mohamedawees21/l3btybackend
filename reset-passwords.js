const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetPasswords() {
  let connection;
  try {
    // إنشاء connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'l3bty_rental',
      port: process.env.DB_PORT || 3306
    });

    console.log('🔄 Resetting all passwords...');

    // تشفير كلمة المرور "admin123"
    const plainPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    console.log('   Plain password:', plainPassword);
    console.log('   Generated hash:', hashedPassword);
    console.log('   Hash length:', hashedPassword.length);
    console.log('   Hash prefix:', hashedPassword.substring(0, 7));

    // عرض كلمات المرور الحالية أولاً
    console.log('\n📋 Current passwords in database:');
    const [currentUsers] = await connection.execute(
      'SELECT id, email, LEFT(password, 30) as password_preview FROM users'
    );
    
    currentUsers.forEach(user => {
      console.log(`   ${user.id}. ${user.email}: ${user.password_preview}...`);
    });

    // تحديث جميع المستخدمين
    console.log('\n🔄 Updating passwords...');
    const [result] = await connection.execute(
      'UPDATE users SET password = ?, updated_at = NOW()',
      [hashedPassword]
    );

    console.log(`✅ Updated ${result.affectedRows} users' passwords`);

    // التحقق من التحديث
    console.log('\n✅ Verification - updated passwords:');
    const [updatedUsers] = await connection.execute(
      'SELECT id, email, LEFT(password, 30) as password_preview FROM users'
    );
    
    updatedUsers.forEach(user => {
      console.log(`   ${user.id}. ${user.email}: ${user.password_preview}...`);
    });

    // اختبار Bcrypt
    console.log('\n🔐 Testing bcrypt verification:');
    const testResult = await bcrypt.compare(plainPassword, hashedPassword);
    console.log(`   Bcrypt.compare("${plainPassword}", new hash): ${testResult}`);

    // اختبار مع كلمة مرور خاطئة
    const wrongTest = await bcrypt.compare('wrongpassword', hashedPassword);
    console.log(`   Bcrypt.compare("wrongpassword", new hash): ${wrongTest}`);

    await connection.end();
    
    console.log('\n🎉 Password reset completed successfully!');
    console.log('🔐 All users now have password: admin123');
    console.log('\n📋 Test credentials:');
    console.log('   1. admin@l3bty.com / admin123 (ADMIN)');
    console.log('   2. manager1@l3bty.com / admin123 (BRANCH_MANAGER)');
    console.log('   3. employee1@l3bty.com / admin123 (EMPLOYEE)');
    
  } catch (error) {
    console.error('❌ Password reset failed:', error);
    console.error('Error details:', error.message);
    
    if (connection) {
      try {
        await connection.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
    
    process.exit(1);
  }
}

resetPasswords();