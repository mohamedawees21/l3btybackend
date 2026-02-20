const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixPasswords() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'l3bty_rental'
    });

    console.log('🔄 Fixing passwords...');
    
    const plainPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    console.log('   New hash for "admin123":', hashedPassword.substring(0, 30) + '...');
    
    const [result] = await connection.execute(
      'UPDATE users SET password = ?',
      [hashedPassword]
    );
    
    console.log(`✅ Updated ${result.affectedRows} users`);
    
    // التحقق
    const [users] = await connection.execute(
      'SELECT id, email, LEFT(password, 30) as hash FROM users'
    );
    
    console.log('\n👥 Updated users:');
    users.forEach(user => {
      console.log(`   ${user.id}. ${user.email}: ${user.hash}...`);
    });
    
    // اختبار
    const test = await bcrypt.compare(plainPassword, hashedPassword);
    console.log(`\n🔐 Test: bcrypt.compare("${plainPassword}", new hash) = ${test}`);
    
    await connection.end();
    console.log('\n🎉 Done! Use admin@l3bty.com / admin123 to login');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixPasswords();