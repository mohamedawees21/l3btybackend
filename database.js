const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// اختبار الاتصال مرة واحدة عند التشغيل
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database Connected Successfully');
    client.release();
  } catch (err) {
    console.error('❌ Database Connection Error:', err.message);
  }
})();

module.exports = pool;