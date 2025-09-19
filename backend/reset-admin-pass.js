// reset-admin-pass.cjs  (CommonJS)
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

// ถ้ามี .env ใช้ค่าจาก env; ไม่มีก็ใส่ค่าตรง ๆ
const pool = new Pool({
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'petshop_db',
  password: process.env.PGPASSWORD || '123456', // <-- ใส่ของคุณ
  port: Number(process.env.PGPORT || 5432),
});

(async () => {
  try {
    const hash = await bcrypt.hash('12', 10); // รหัสใหม่ = "12"
    const q = await pool.query(
      `UPDATE users
         SET password=$1, role='admin', email_verified=true
       WHERE LOWER(username)='admin'
       RETURNING user_id, username, password`,
      [hash]
    );
    console.log('✅ Updated:', q.rows[0]);
  } catch (e) {
    console.error('❌ Error:', e);
  } finally {
    await pool.end();
  }
})();
