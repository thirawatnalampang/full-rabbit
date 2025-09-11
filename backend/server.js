// server.js (CommonJS)
require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const pool = require('./db'); // ✅ ใช้ pool จากไฟล์ db ที่คุณมีอยู่แล้ว (อย่าสร้าง Pool ซ้ำ)
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

/* ===================== Middlewares ===================== */
app.use(bodyParser.json());
app.use(cors({ origin: true, credentials: true }));

/* ===================== Helpers (LOG & DIFF) ===================== */
const nowISO = () => new Date().toISOString();
const TRACK_FIELDS = ['username', 'email', 'phone', 'address', 'gender', 'profile_image'];
const show = (v) => {
  if (v === null || v === undefined) return 'null';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + '...' : s;
};
function diffUser(oldRow, newRow) {
  const diffs = [];
  for (const f of TRACK_FIELDS) {
    const o = oldRow?.[f] ?? null;
    const n = newRow?.[f] ?? null;
    if (String(o) !== String(n)) diffs.push({ field: f, oldVal: o, newVal: n });
  }
  return diffs;
}
const num = (v) => Number(v || 0);

/* ===================== Static / Upload Dirs ===================== */
const UPLOAD_ROOT = path.join(__dirname, 'uploads');
const SLIPS_DIR = path.join(UPLOAD_ROOT, 'slips');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT);
if (!fs.existsSync(SLIPS_DIR)) fs.mkdirSync(SLIPS_DIR);

// ให้เสิร์ฟไฟล์ในโฟลเดอร์ uploads ทั้งหมด
app.use('/uploads', express.static(UPLOAD_ROOT));

/* ========== Multer storages แยกคนละตัว เพื่อไม่ชนชื่อ ========== */
// โปรไฟล์
const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const uploadProfile = multer({ storage: profileStorage });

// สลิป
const slipStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, SLIPS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `slip_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const uploadSlip = multer({ storage: slipStorage });

/* ===================== Nodemailer ===================== */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587, // STARTTLS
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS, // App Password 16 ตัว
  },
});
transporter.verify((err, ok) => {
  if (err) {
    console.error('SMTP verify failed:', {
      message: err.message, code: err.code, command: err.command, response: err.response,
    });
  } else {
    console.log('SMTP ready:', ok);
  }
});

/* ===================== OTP Store (in-memory) ===================== */
const otpStore = {};
const OTP_EXPIRE_MIN = Number(process.env.OTP_EXPIRE_MIN || 10);
const OTP_EXPIRE_MS = OTP_EXPIRE_MIN * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const now = () => Date.now();
const cleanupOtp = (email) => delete otpStore[email];

/* ===================== Upload รูปโปรไฟล์ ===================== */
app.post('/api/upload', uploadProfile.single('profileImage'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ไม่มีไฟล์ถูกอัปโหลด' });
  const url = `http://localhost:${port}/uploads/${req.file.filename}`;
  res.json({ url });
});
// ========== RABBIT STOCK APIs ==========

app.get('/api/admin/rabbits', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
    const offset = (page - 1) * limit;

    const totalQ = await pool.query('SELECT COUNT(*)::int AS total FROM rabbits');
    const total = totalQ.rows[0].total || 0;

    const rowsQ = await pool.query(
      `SELECT rabbit_id, name, breed, age, gender, price,
              description, image_url, status, stock,
              is_parent, parent_role, available_date, weight
       FROM rabbits
       ORDER BY rabbit_id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), items: rowsQ.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/admin/rabbits', async (req, res) => {
  try {
    const {
      name, breed = null, age = null, gender = null,
      price, description = null, image_url = null, status = 'available',
      stock = 0,
      // ฟิลด์ breeding
      is_parent = false, parent_role = null, available_date = null, weight = null
    } = req.body;

    if (!name || price == null)
      return res.status(400).json({ error: 'name และ price จำเป็น' });

    const q = await pool.query(
      `INSERT INTO rabbits (
         name, breed, age, gender, price, description, image_url, status, stock,
         is_parent, parent_role, available_date, weight
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING rabbit_id, name, breed, age, gender, price,
                 description, image_url, status, stock,
                 is_parent, parent_role, available_date, weight`,
      [name, breed, age, gender, price, description, image_url, status, stock,
       is_parent, parent_role, available_date, weight]
    );
    res.status(201).json(q.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});


app.put('/api/admin/rabbits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, breed, age, gender, price, description, image_url, status, stock,
      is_parent, parent_role, available_date, weight
    } = req.body;

    const q = await pool.query(
      `UPDATE rabbits SET
         name        = COALESCE($1, name),
         breed       = COALESCE($2, breed),
         age         = COALESCE($3, age),
         gender      = COALESCE($4, gender),
         price       = COALESCE($5, price),
         description = COALESCE($6, description),
         image_url   = COALESCE($7, image_url),
         status      = COALESCE($8, status),
         stock       = COALESCE($9, stock),
         is_parent   = COALESCE($10, is_parent),
         parent_role = COALESCE($11, parent_role),
         available_date = COALESCE($12, available_date),
         weight      = COALESCE($13, weight)
       WHERE rabbit_id = $14
       RETURNING rabbit_id, name, breed, age, gender, price,
                 description, image_url, status, stock,
                 is_parent, parent_role, available_date, weight`,
      [name, breed, age, gender, price, description, image_url, status, stock,
       is_parent, parent_role, available_date, weight, id]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(q.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});


// 📌 ลบกระต่าย
app.delete('/api/admin/rabbits/:id', async (req, res) => {
  try {
    const q = await pool.query('DELETE FROM rabbits WHERE rabbit_id = $1', [req.params.id]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});


// 📌 อัปเดตสต๊อกโดยตรง (เพิ่ม/ลดทีหลัง)
app.patch('/api/admin/rabbits/:id/stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { change } = req.body; // change = +1 / -1 / +5 / -3

    if (!Number.isInteger(change)) {
      return res.status(400).json({ error: 'change ต้องเป็นจำนวนเต็ม' });
    }

    // ป้องกัน stock < 0
    const q = await pool.query(
      `UPDATE rabbits
       SET stock = stock + $1
       WHERE rabbit_id = $2 AND stock + $1 >= 0
       RETURNING rabbit_id, stock`,
      [change, id]
    );

    if (q.rowCount === 0) {
      return res.status(400).json({ error: 'ไม่สามารถอัปเดต stock (อาจติดลบหรือไม่พบ id)' });
    }

    res.json(q.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/rabbits/:id', async (req, res) => {
  try {
    const q = await pool.query(
      `SELECT rabbit_id, name, breed, age, gender, price,
              description, image_url, status, stock,
              is_parent, parent_role, available_date, weight
       FROM rabbits
       WHERE rabbit_id = $1`,
      [req.params.id]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(q.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});



/* ========= Product APIs ========= */
app.get('/api/admin/products', async (req, res) => {
  try {
    const page   = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit  = Math.max(parseInt(req.query.limit || '10', 10), 1);
    const offset = (page - 1) * limit;

    let category = (req.query.category ?? '').toString().trim();
    if (category) {
      const c = category.toLowerCase();
      if (c === 'petfood' || c === 'pet_food') category = 'Pet food';
      else if (c === 'equipment' || c === 'equip') category = 'Equipment';
    } else {
      category = null;
    }

    let totalQ, rowsQ;
    if (category) {
      totalQ = await pool.query(
        'SELECT COUNT(*)::int AS total FROM products WHERE LOWER(category) = LOWER($1)',
        [category]
      );
      rowsQ = await pool.query(
        `SELECT product_id, name, category, price, stock, description, image_url, status
         FROM products
         WHERE LOWER(category) = LOWER($1)
         ORDER BY product_id ASC
         LIMIT $2 OFFSET $3`,
        [category, limit, offset]
      );
    } else {
      totalQ = await pool.query('SELECT COUNT(*)::int AS total FROM products');
      rowsQ = await pool.query(
        `SELECT product_id, name, category, price, stock, description, image_url, status
         FROM products
         ORDER BY product_id ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    const total = totalQ.rows[0].total || 0;
    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), items: rowsQ.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== CREATE PRODUCT =====
app.post('/api/admin/products', async (req, res) => {
  try {
    const {
      name, category, price, stock,
      description = null,
      image_url = null,
      status = 'available'
    } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'name, price, category จำเป็น' });
    }

    const q = await pool.query(
      `INSERT INTO products (name, category, price, stock, description, image_url, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       RETURNING *`,
      [name, category, price, stock, description, image_url, status]
    );

    res.status(201).json(q.rows[0]);
  } catch (e) {
    console.error('POST /api/admin/products', e);
    res.status(500).json({ error: 'Server error' });
  }
});


// PUT /api/admin/products/:id
app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'invalid product id' });
    }

    // ดึงค่าจาก body (ถ้าไม่ได้ส่งมาก็ปล่อยเป็น null ให้ COALESCE ข้าม)
    let {
      name = null,
      category = null,
      price = null,
      stock = null,
      description = null,
      image_url = null,
      status = null,
    } = req.body || {};

    // กัน NaN สำหรับ number fields
    price = Number.isFinite(Number(price)) ? Number(price) : null;
    stock = Number.isInteger(Number(stock)) ? Number(stock) : null;

    const q = await pool.query(
      `UPDATE products SET
         name        = COALESCE($1, name),
         category    = COALESCE($2, category),
         price       = COALESCE($3, price),
         stock       = COALESCE($4, stock),
         description = COALESCE($5, description),
         image_url   = COALESCE($6, image_url),
         status      = COALESCE($7, status),
         updated_at  = NOW()
       WHERE product_id = $8
       RETURNING *`,
      [name, category, price, stock, description, image_url, status, id]
    );

    if (!q.rowCount) return res.status(404).json({ error: 'not found' });
    res.json(q.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/admin/products/:id', async (req, res) => {
  try {
    const q = await pool.query('SELECT * FROM products WHERE product_id = $1', [req.params.id]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(q.rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const q = await pool.query('DELETE FROM products WHERE product_id = $1', [req.params.id]);
    if (q.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ===================== OTP API ===================== */
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'กรุณาส่งอีเมล' });

    const record = otpStore[email];
    if (record && record.lastSentAt && (now() - record.lastSentAt) < 60_000) {
      const waitMs = 60_000 - (now() - record.lastSentAt);
      const waitSec = Math.ceil(waitMs / 1000);
      res.set('Retry-After', String(waitSec));
      return res.status(429).json({ message: `โปรดรอ ${waitSec} วินาที แล้วลองส่งใหม่อีกครั้ง`, retry_after: waitSec });
    }

    const code = genOtp();
    otpStore[email] = { code, expireAt: now() + OTP_EXPIRE_MS, lastSentAt: now() };

    try {
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM || process.env.MAIL_USER,
        to: email,
        subject: 'รหัสยืนยันการสมัครสมาชิก (OTP)',
        text: `รหัส OTP ของคุณคือ ${code} (หมดอายุภายใน ${OTP_EXPIRE_MIN} นาที)`,
        html: `<p>รหัส OTP: <b style="font-size:20px">${code}</b></p><p>หมดอายุใน ${OTP_EXPIRE_MIN} นาที</p>`,
      });
      console.log('sendMail OK:', { messageId: info.messageId });
    } catch (sendErr) {
      console.error('sendMail FAILED:', {
        message: sendErr.message, code: sendErr.code, command: sendErr.command, response: sendErr.response,
      });
      return res.status(500).json({ message: 'ส่ง OTP ไม่สำเร็จ' });
    }

    if (process.env.NODE_ENV !== 'production') {
      return res.json({ message: 'ส่ง OTP ไปที่อีเมลแล้ว', dev_otp: otpStore[email].code });
    }
    return res.json({ message: 'ส่ง OTP ไปที่อีเมลแล้ว' });
  } catch (err) {
    console.error('send-otp error:', err);
    return res.status(500).json({ message: 'ส่ง OTP ไม่สำเร็จ' });
  }
});

/* ===================== Users ===================== */
app.get('/api/users', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users ORDER BY user_id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Error fetching users:', err.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid user ID' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('❌ Error fetching user:', err.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

const nowISO_log = () => new Date().toISOString();

app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email, otp } = req.body;
    console.log(`[REGISTER ATTEMPT] username:${username}, email:${email}, time:${nowISO_log()}`);

    if (!username || !password || !email || !otp) {
      return res.status(400).json({ message: 'กรุณากรอก username, password, email และ otp ให้ครบ' });
    }

    const record = otpStore[email];
    if (!record) return res.status(400).json({ message: 'ยังไม่ได้ส่ง OTP หรือ OTP หมดอายุ' });
    if (now() > record.expireAt) { cleanupOtp(email); return res.status(400).json({ message: 'OTP หมดอายุ กรุณาขอรหัสใหม่' }); }
    if (String(otp) !== String(record.code)) return res.status(400).json({ message: 'OTP ไม่ถูกต้อง' });

    const existing = await pool.query('SELECT 1 FROM users WHERE username=$1 OR email=$2', [username, email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password, email, phone, address, gender, role, profile_image, email_verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING user_id`,
      [username, hashedPassword, email, null, null, null, 'user', null, true]
    );

    cleanupOtp(email);

    const newUserId = result.rows[0].user_id;
    console.log(`[REGISTER SUCCESS] New user registered: ${username} (user_id: ${newUserId}) at ${nowISO_log()}`);

    res.status(201).json({ message: 'สมัครสมาชิกสำเร็จ' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`[LOGIN ATTEMPT] username:${username}, time:${nowISO_log()}`);

    if (!username || !password) {
      console.log(`[LOGIN FAIL] username:${username}, reason:missing_fields, time:${nowISO_log()}`);
      return res.status(400).json({ message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rows.length === 0) {
      console.log(`[LOGIN FAIL] username:${username}, reason:user_not_found, time:${nowISO_log()}`);
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = userResult.rows[0];

    if (user.role !== 'admin' && user.email_verified === false) {
      console.log(`[LOGIN FAIL] username:${username}, user_id:${user.user_id}, reason:email_not_verified, time:${nowISO_log()}`);
      return res.status(403).json({ message: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' });
    }

    let match = false;
    if (user.role === 'admin') {
      match = password === user.password || await bcrypt.compare(password, user.password);
    } else {
      match = await bcrypt.compare(password, user.password);
    }
    if (!match) {
      console.log(`[LOGIN FAIL] username:${username}, user_id:${user.user_id}, reason:password_incorrect, time:${nowISO_log()}`);
      return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    console.log(`[LOGIN SUCCESS] ${user.username} (user_id: ${user.user_id}, role: ${user.role}) at ${nowISO_log()}`);

    res.json({
      message: 'ล็อกอินสำเร็จ',
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        address: user.address,
        profile_image: user.profile_image,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    console.log(`[LOGIN FAIL] username:${req.body?.username}, reason:server_error, time:${nowISO_log()}`);
    res.status(500).json({ message: 'เกิดข้อผิดพลาดในระบบ' });
  }
});
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, email, phone, address, gender, profileImage } = req.body;

  try {
    const beforeRes = await pool.query('SELECT * FROM users WHERE user_id = $1', [id]);
    if (beforeRes.rows.length === 0) {
      console.log(`[PROFILE UPDATE FAIL] user_id:${id}, reason:not_found, time:${nowISO()}`);
      return res.status(404).json({ error: 'User not found' });
    }
    const before = beforeRes.rows[0];

    // ❌ ห้ามแก้ email: ถ้าส่ง email มาและต่างจากเดิม → ปฏิเสธ
    if (typeof email !== 'undefined' && email !== before.email) {
      console.log(`[PROFILE UPDATE FAIL] user_id:${id}, reason:email_change_attempt, time:${nowISO()}`);
      return res.status(400).json({ error: 'Email cannot be changed' });
    }

    // ✅ อัปเดตเฉพาะฟิลด์ที่อนุญาต (ไม่แตะ email เลย)
    const result = await pool.query(
      `UPDATE users 
         SET username = $1,
             phone = $2,
             address = $3,
             gender = $4,
             profile_image = $5
       WHERE user_id = $6
       RETURNING *`,
      [
        (typeof username !== 'undefined') ? username : before.username,
        (typeof phone !== 'undefined') ? phone : before.phone,
        (typeof address !== 'undefined') ? address : before.address,
        (typeof gender !== 'undefined') ? gender : before.gender,
        (typeof profileImage !== 'undefined') ? profileImage : before.profile_image,
        id
      ]
    );

    const after = result.rows[0];
    const changes = diffUser(before, after);
    if (changes.length === 0) {
      console.log(`[PROFILE UPDATE] user_id:${id}, changed:none, time:${nowISO()}`);
    } else {
      const parts = changes.map(c => `${c.field}:{${show(c.oldVal)} -> ${show(c.newVal)}}`);
      console.log(`[PROFILE UPDATE] user_id:${id}, changed:${parts.join(', ')}, time:${nowISO()}`);
    }

    res.json(after);
  } catch (err) {
    console.error('❌ Failed to update user:', err);
    console.log(`[PROFILE UPDATE FAIL] user_id:${id}, reason:server_error, time:${nowISO()}`);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/api/users/:id/profile-image', async (req, res) => {
  const { id } = req.params;
  const { profileImage } = req.body;

  try {
    const result = await pool.query(
      'UPDATE users SET profile_image=$1 WHERE user_id=$2 RETURNING *',
      [profileImage, id]
    );

    if (result.rowCount === 0) {
      console.log(`[PROFILE IMAGE UPDATE FAIL] user_id:${id}, reason:not_found, time:${nowISO()}`);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log(`[PROFILE IMAGE UPDATE] user_id:${id}, new_image:${show(profileImage)}, time:${nowISO()}`);

    res.json({
      message: 'Profile image updated',
      user: {
        user_id: result.rows[0].user_id,
        username: result.rows[0].username,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        address: result.rows[0].address,
        profileImage: result.rows[0].profile_image,
      },
    });
  } catch (err) {
    console.error('❌ Failed to update profile image:', err.message);
    console.log(`[PROFILE IMAGE UPDATE FAIL] user_id:${id}, reason:server_error, time:${nowISO()}`);
    res.status(500).json({ error: 'Failed to update profile image' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM users WHERE user_id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('❌ Failed to delete user:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/* =============== สั่งซื้อ: POST /api/orders (ตัดสต๊อกแบบ transactional) =============== */
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
// เผื่อส่งมาจากฟรอนต์ต่างรูปแบบ
const getQty = (it) => Math.max(1, toNum(it.qty ?? it.quantity ?? 1));
const getUnitPrice = (it) => toNum(it.unit_price ?? it.price ?? 0);
const getType = (it) => String(it.type || '').toLowerCase();
const getIdNum = (it) => {
  const raw = it.rabbit_id ?? it.product_id ?? it.base_id ?? it.id;
  const m = typeof raw === 'string' ? raw.match(/\d+/)?.[0] : raw;
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
};

app.post('/api/orders', uploadSlip.single('slip'), async (req, res) => {
  const client = await pool.connect();
  try {
    // -------- parse body + slip --------
    let body;
    let slipPath = null;

    if (req.is('multipart/form-data')) {
      if (!req.body?.order) return res.status(400).json({ message: "missing 'order' json" });
      body = JSON.parse(req.body.order);
      if (!req.file) return res.status(400).json({ message: 'ต้องแนบไฟล์สลิป (field: slip)' });
      slipPath = `/uploads/slips/${req.file.filename}`;
    } else if (req.is('application/json')) {
      body = req.body;
    } else {
      return res.status(415).json({ message: 'Unsupported Content-Type' });
    }

    const { user_id, contact, shipping, payment, note, items = [], summary } = body || {};
    if (!contact?.full_name || !contact?.phone) return res.status(400).json({ message: 'กรอกชื่อ/เบอร์ให้ครบ' });
    if (!shipping?.method) return res.status(400).json({ message: 'ระบุ shipping.method' });
    if (!payment?.method) return res.status(400).json({ message: 'ระบุ payment.method' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'ไม่มีสินค้า' });

    // -------- สรุปยอด --------
    const subtotal = toNum(summary?.subtotal);
    const discount = toNum(summary?.discount);
    const shippingFee = toNum(shipping?.fee);
    const total = toNum(summary?.total);
    const currency = summary?.currency || 'THB';
    const paymentStatus = payment?.status || (slipPath ? 'submitted' : 'unpaid');

    // -------- เริ่มทรานแซกชัน --------
    await client.query('BEGIN');

    // 1) ล็อกสต๊อก & ตรวจพอหรือไม่ (SELECT ... FOR UPDATE)
    const shortages = []; // [{type, id, need, have}]
    const lockedRows = []; // เก็บข้อมูลไว้ใช้ตอนอัปเดต

    for (const it of items) {
      const type = getType(it);
      const baseId = getIdNum(it);
      const need = getQty(it);

      if (!baseId || need <= 0) {
        shortages.push({ type, id: baseId || '(invalid id)', need, have: 0 });
        continue;
      }

      if (type === 'rabbit') {
        const q = await client.query(
          'SELECT rabbit_id, stock, status FROM rabbits WHERE rabbit_id = $1 FOR UPDATE',
          [baseId]
        );
        if (q.rowCount === 0) {
          shortages.push({ type, id: baseId, need, have: 0 });
          continue;
        }
        const row = q.rows[0];
        const have = Number(row.stock || 0);
        if (have < need) {
          shortages.push({ type, id: baseId, need, have });
          continue;
        }
        lockedRows.push({ type, id: baseId, have, need });
      } else {
        // product: pet-food / equipment
        const q = await client.query(
          'SELECT product_id, stock, status FROM products WHERE product_id = $1 FOR UPDATE',
          [baseId]
        );
        if (q.rowCount === 0) {
          shortages.push({ type, id: baseId, need, have: 0 });
          continue;
        }
        const row = q.rows[0];
        const have = Number(row.stock || 0);
        if (have < need) {
          shortages.push({ type, id: baseId, need, have });
          continue;
        }
        lockedRows.push({ type, id: baseId, have, need });
      }
    }

    if (shortages.length > 0) {
      // มีของไม่พอ -> ยกเลิกทรานแซกชัน
      await client.query('ROLLBACK');
      return res.status(409).json({
        message: 'จำนวนสินค้าไม่พอ',
        shortages, // บอกตัวไหนขาด/เหลือเท่าไหร่
      });
    }

    // 2) บันทึกหัวออเดอร์
    const insertOrderSql = `
      INSERT INTO orders (
        buyer_id, order_date,
        total_amount, status,
        contact_full_name, contact_phone,
        shipping_method, shipping_address, shipping_fee,
        payment_method, payment_status, payment_slip_path,
        note, subtotal, discount, currency
      ) VALUES (
        $1, NOW(),
        $2, 'pending',
        $3, $4,
        $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14
      )
      RETURNING order_id
    `;
    const insertOrderVals = [
      user_id ?? null,
      total,
      contact.full_name,
      contact.phone,
      shipping.method,
      shipping.address ? JSON.stringify(shipping.address) : null,
      shippingFee,
      payment.method,
      paymentStatus,
      slipPath,
      note || null,
      subtotal,
      discount,
      currency,
    ];
    const { rows } = await client.query(insertOrderSql, insertOrderVals);
    const orderId = rows[0].order_id;

    // 3) บันทึกรายการย่อย + ตัดสต๊อก
    const insertDetailSql = `
      INSERT INTO order_details (order_id, item_type, item_id, quantity, price)
      VALUES ($1, $2, $3, $4, $5)
    `;

    for (const it of items) {
      const type = getType(it);
      const baseId = getIdNum(it);
      const qty = getQty(it);
      const price = getUnitPrice(it);

      // insert detail
      await client.query(insertDetailSql, [
        orderId,
        type,
        baseId,
        qty,
        price,
      ]);

      // deduct stock (อัปเดตในตารางที่ถูกต้อง)
      if (type === 'rabbit') {
        await client.query(
          `UPDATE rabbits
             SET stock = stock - $2,
                 status = CASE WHEN stock - $2 <= 0 THEN 'reserved' ELSE status END
           WHERE rabbit_id = $1`,
          [baseId, qty]
        );
      } else {
        await client.query(
          `UPDATE products
             SET stock = stock - $2,
                 status = CASE WHEN stock - $2 <= 0 THEN 'out_of_stock' ELSE status END
           WHERE product_id = $1`,
          [baseId, qty]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ status: 'ok', order_id: orderId, total_amount: total, currency });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('create order error:', err);
    res.status(500).json({ message: 'create order failed' });
  } finally {
    client.release();
  }
});
/* ========= My Orders (รวมสินค้าทั้งหมด) ========= */
app.get('/api/my-orders', async (req, res) => {
  try {
    const buyerId = Number(req.query.buyer_id);
    if (!Number.isFinite(buyerId)) return res.status(400).json({ message: 'invalid buyer_id' });

    const q = await pool.query(`
      SELECT
        o.order_id,
        o.order_date,
        o.total_amount,
        o.status,
        o.payment_status,
        o.payment_method,
        /* ✅ ฟิลด์สำหรับเลขพัสดุ */
        o.carrier,
        o.tracking_code,
        o.tracking_updated_at,
        COALESCE(SUM(od.quantity),0)::int AS total_items,
        json_agg(
          json_build_object(
            'order_detail_id', od.order_detail_id,
            'item_type',       od.item_type,
            'item_name',       COALESCE(r.name, p.name),
            'item_image',
              CASE
                WHEN od.item_type = 'rabbit' THEN r.image_url
                ELSE p.image_url
              END,
            'quantity', od.quantity,
            'price',    od.price
          )
          ORDER BY od.order_detail_id
        ) FILTER (WHERE od.order_detail_id IS NOT NULL) AS items   -- ✅ กัน null
      FROM orders o
      LEFT JOIN order_details od ON od.order_id = o.order_id
      LEFT JOIN rabbits  r ON od.item_type = 'rabbit' AND r.rabbit_id  = od.item_id
      LEFT JOIN products p ON od.item_type IN ('pet-food','equipment') AND p.product_id = od.item_id
      WHERE o.buyer_id = $1
      GROUP BY o.order_id
      ORDER BY o.order_date DESC
    `, [buyerId]);

    res.json(q.rows);
  } catch (err) {
    console.error('my-orders error:', err);
    res.status(500).json({ message: 'server error' });
  }
});

/* ========= รายละเอียดคำสั่งซื้อ ========= */
app.get('/api/orders/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

    const head = await pool.query(
      `SELECT
         o.order_id, o.order_code, o.buyer_id, o.order_date, o.total_amount, o.currency,
         o.status, o.payment_status, o.payment_method,
         o.contact_full_name, o.contact_phone,
         o.shipping_method, o.shipping_address, o.shipping_fee,
         o.subtotal, o.discount, o.note,
         /* ✅ เพิ่มฟิลด์พัสดุ */
         o.carrier, o.tracking_code, o.tracking_updated_at
       FROM orders o
       WHERE o.order_id = $1`,
      [id]
    );

    if (!head.rowCount) return res.status(404).json({ message: 'not found' });

    const items = await pool.query(
      `SELECT od.order_detail_id, od.item_type, od.item_id, od.quantity, od.price,
              (od.quantity*od.price) AS line_total
       FROM order_details od
       WHERE od.order_id=$1
       ORDER BY od.order_detail_id ASC`,
      [id]
    );

    res.json({ order: head.rows[0], items: items.rows });
  } catch (err) {
    console.error('order detail error:', err);
    res.status(500).json({ message: 'server error' });
  }
});/* ========= Admin: รวมรายการ + ชื่อ/รูป ========= */
app.get('/api/admin/orders', async (_req, res) => {
  try {
    const q = await pool.query(`
      SELECT
        o.*,
        COALESCE(SUM(od.quantity), 0)::int AS total_items,
        json_agg(
          json_build_object(
            'order_detail_id', od.order_detail_id,
            'item_type',       od.item_type,
            'item_id',         od.item_id,
            'quantity',        od.quantity,
            'price',           od.price,
            'item_name',
              CASE
                WHEN od.item_type = 'rabbit' THEN r.name
                WHEN od.item_type IN ('pet-food','equipment') THEN p.name
                ELSE NULL
              END,
            'item_image',
              CASE
                WHEN od.item_type = 'rabbit' THEN r.image_url
                WHEN od.item_type IN ('pet-food','equipment') THEN p.image_url
                ELSE NULL
              END
          )
          ORDER BY od.order_detail_id
        ) FILTER (WHERE od.order_detail_id IS NOT NULL) AS items
      FROM orders o
      LEFT JOIN order_details od ON o.order_id = od.order_id
      LEFT JOIN rabbits  r ON od.item_type = 'rabbit'
                           AND r.rabbit_id  = od.item_id
      LEFT JOIN products p ON od.item_type IN ('pet-food','equipment')
                           AND p.product_id = od.item_id
      GROUP BY o.order_id
      ORDER BY o.order_date DESC
    `);
    res.json(q.rows);
  } catch (err) {
    console.error('fetch admin orders error:', err);
    res.status(500).json({ message: 'failed to fetch orders' });
  }
});
/* ========= Admin: อัปเดตสถานะ/ขนส่ง/เลขพัสดุ ========= */
app.put('/api/admin/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, carrier, tracking_code, payment_status } = req.body;

    // อ่านของเดิม
    const cur = await pool.query(
      `SELECT payment_method, payment_status, tracking_code FROM orders WHERE order_id=$1`,
      [id]
    );
    if (!cur.rowCount) return res.status(404).json({ message: 'not found' });

    const prev = cur.rows[0];
    let newPayStatus = payment_status ?? prev.payment_status;

    // กฎ COD: ถ้าส่งเป็น "done" → ถือว่าจ่ายแล้ว
    if (prev.payment_method === 'cod' && status === 'done') {
      newPayStatus = 'paid';
    }

    // ตรวจว่า tracking เปลี่ยนไหม
    const trackingChanged =
      typeof tracking_code === 'string' && tracking_code !== prev.tracking_code;

    const q = await pool.query(
      `
      UPDATE orders
      SET
        status               = COALESCE($1, status),
        carrier              = COALESCE($2, carrier),
        tracking_code        = COALESCE($3, tracking_code),
        tracking_updated_at  = CASE
                                  WHEN $4::boolean = TRUE THEN NOW()
                                  ELSE tracking_updated_at
                                END,
        payment_status       = $5
      WHERE order_id = $6
      RETURNING *;
      `,
      [
        status ?? null,
        carrier ?? null,
        tracking_code ?? null,
        trackingChanged,     // $4
        newPayStatus,        // $5
        id                   // $6
      ]
    );

    res.json(q.rows[0]);
  } catch (err) {
    console.error('update order error:', err);
    res.status(500).json({ message: 'failed to update order' });
  }
});

/* ========= Admin: อนุมัติ/ปฏิเสธสลิป ========= */
app.put('/api/admin/orders/:id/payment', async (req, res) => {
  try {
    const { id } = req.params; const { action } = req.body; // 'approve'|'reject'
    if (!['approve','reject'].includes(action)) return res.status(400).json({ message: "action must be 'approve' or 'reject'" });
    const newStatus = action === 'approve' ? 'paid' : 'rejected';
    const q = await pool.query(
      `UPDATE orders SET payment_status=$1 WHERE order_id=$2 RETURNING *`, [newStatus, id]
    );
    if (!q.rowCount) return res.status(404).json({ message: 'not found' });
    res.json(q.rows[0]);
  } catch (err) { console.error('payment update error:', err); res.status(500).json({ message: 'failed to update payment' }); }
});

/* ===================== Health ===================== */
app.get('/', (_req,res)=>res.send('OK'));
// /api/search — เวอร์ชัน ILIKE อย่างเดียว (กันตาย)
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const like = `%${q}%`;

  const sql = `
    WITH
    p AS (
      SELECT product_id AS id, name,
             COALESCE(description,'') AS description,
             COALESCE(image_url,'')   AS image_url,
             COALESCE(price,0)        AS price,
             'product' AS kind
      FROM products
      WHERE name ILIKE $1 OR description ILIKE $1
    ),
    r AS (
      SELECT rabbit_id AS id, name,
             CONCAT('สายพันธุ์ ', COALESCE(breed,'')) AS description,
             COALESCE(image_url,'') AS image_url,
             COALESCE(price,0)      AS price,
             'rabbit' AS kind
      FROM rabbits
      WHERE name ILIKE $1 OR breed ILIKE $1
    )
    SELECT * FROM (SELECT * FROM p UNION ALL SELECT * FROM r) t
    ORDER BY name ASC
    LIMIT 50;
  `;

  try {
    const { rows } = await pool.query(sql, [like]);
    res.json(rows);
  } catch (e) {
    console.error('search error:', e);
    res.status(500).json({ message: 'search error' });
  }
});
// ===== Dev-only guards (ง่าย เร็ว ใช้ชั่วคราว) =====
function auth(req, res, next) {
  // dev: ให้ผ่านหมด และผูก user ให้มี role=admin โดยอัตโนมัติ
  // ถ้าอยากทดสอบสิทธิ์ ให้ส่ง header x-role: admin หรือ x-role: user
  const role = (req.headers['x-role'] || 'admin').toLowerCase();
  req.user = { role };
  next();
}

function isAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  return res.status(403).json({ message: 'forbidden: admin only' });
}
// ====== /api/admin/dashboard/stats (ADMIN ONLY) ======
app.get('/api/admin/dashboard/stats', auth, isAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { start, end } = req.query; // ISO yyyy-mm-dd

    // --------- อ่าน schema ---------
    const qCols = async (tbl) =>
      (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [tbl]))
        .rows.map(r => r.column_name);

    const colsOD = await qCols('order_details');
    const colsP  = await qCols('products');
    const colsR  = (await client.query(`
      SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_name='rabbits'
    `)).rows[0].c > 0 ? await qCols('rabbits') : [];

    const findCol = (cands, cols, fallback=null) => cands.find(c => cols.includes(c)) || fallback;

    // order_details
    const OD_ITEM_TYPE_COL = findCol(['item_type','type'], colsOD, 'item_type');
    const OD_ITEM_ID_COL   = findCol(['item_id','product_id','prod_id'], colsOD, 'item_id');
    const OD_QTY_COL       = findCol(['quantity','qty'], colsOD, 'quantity');
    const OD_PRICE_COL     = findCol(['price','unit_price','sale_price'], colsOD, 'price');

    // products
    const P_ID_COL   = findCol(['product_id','id','pid'], colsP, 'product_id');
    const P_NAME_COL = findCol(['name','product_name','title'], colsP, 'name');
    const P_IMG_COL  = findCol(['image_url','image','img','thumbnail','thumb','picture','photo','cover','main_image','image_path','img_url'], colsP);

    // rabbits (อาจไม่มี)
    const HAS_RABBITS = colsR.length > 0;
    const R_ID_COL    = HAS_RABBITS ? findCol(['rabbit_id','id'], colsR, 'rabbit_id') : null;
    const R_NAME_COL  = HAS_RABBITS ? findCol(['name','rabbit_name','title'], colsR, 'name') : null;
    const R_IMG_COL   = HAS_RABBITS ? findCol(['image_url','image','img','photo','picture','thumbnail','thumb'], colsR) : null;

    // --------- helper วันที่ ---------
    const sevenEnd  = end ? `DATE '${end}'` : `NOW()::date`;
    const sevenFrom = end ? `DATE '${end}' - INTERVAL '6 days'` : `NOW()::date - INTERVAL '6 days'`;

    const todayCond = start && end
      ? `(order_date)::date BETWEEN DATE '${start}' AND DATE '${end}'`
      : `(order_date)::date = (NOW())::date`;

    const monthCond = start && end
      ? `date_trunc('month', order_date) = date_trunc('month', DATE '${start}')`
      : `date_trunc('month', order_date) = date_trunc('month', NOW())`;

    // --------- Query หลักทั้งหมด ---------
    const [
      salesTodayQ,
      salesMonthQ,
      ordersTodayQ,
      ordersMonthQ,
      invQ,
      rabbitsQ,
      sales7DaysQ,
      recentOrdersQ,
      topProductsQ,
    ] = await Promise.all([
      client.query(`
        SELECT COALESCE(SUM(total_amount),0)::numeric AS total
        FROM orders
        WHERE ${todayCond}
          AND status IN ('done','shipped','ready_to_ship')
      `),
      client.query(`
        SELECT COALESCE(SUM(total_amount),0)::numeric AS total
        FROM orders
        WHERE ${monthCond}
          AND status IN ('done','shipped','ready_to_ship')
      `),
      client.query(`SELECT COUNT(*)::int AS cnt FROM orders WHERE ${todayCond}`),
      client.query(`SELECT COUNT(*)::int AS cnt FROM orders WHERE ${monthCond}`),

      client.query(`
        SELECT
          COUNT(*)::int AS total_products,
          COUNT(*) FILTER (WHERE stock IS NOT NULL AND stock <= 5)::int AS low_stock
        FROM products
      `),

      // count rabbits table if exists
      HAS_RABBITS
        ? client.query(`SELECT COUNT(*)::int AS total_rabbits FROM rabbits`)
        : Promise.resolve({ rows: [{ total_rabbits: 0 }] }),

      client.query(`
        WITH days AS (
          SELECT generate_series( (${sevenFrom}), (${sevenEnd}), INTERVAL '1 day')::date AS d
        )
        SELECT d::text AS date,
               COALESCE(SUM(o.total_amount),0)::numeric AS total
        FROM days
        LEFT JOIN orders o
          ON (o.order_date)::date = d
         AND o.status IN ('done','shipped','ready_to_ship')
        GROUP BY d
        ORDER BY d
      `),

      // ✅ ออเดอร์ล่าสุด 10 รายการ + สินค้า/กระต่าย
      client.query(`
        WITH latest AS (
          SELECT
            o.order_id, o.order_date, o.status, o.payment_status, o.total_amount,
            COALESCE(o.contact_full_name, 'ผู้ใช้ #' || o.buyer_id::text) AS buyer_name
          FROM orders o
          ORDER BY o.order_date DESC
          LIMIT 10
        )
        SELECT
          l.order_id, l.order_date, l.status, l.payment_status, l.total_amount, l.buyer_name,
          COALESCE(
            JSON_AGG(
              CASE
                WHEN od.${OD_ITEM_TYPE_COL} = 'rabbit' ${HAS_RABBITS ? `THEN JSON_BUILD_OBJECT(
                  'product_id', r.${R_ID_COL},
                  'name', COALESCE(r.${R_NAME_COL}, 'ไม่ระบุชื่อ'),
                  'image', ${R_IMG_COL ? `r.${R_IMG_COL}` : 'NULL'},
                  'qty', od.${OD_QTY_COL},
                  'price', od.${OD_PRICE_COL}
                )` : `THEN JSON_BUILD_OBJECT(
                  'product_id', od.${OD_ITEM_ID_COL},
                  'name', 'กระต่าย',
                  'image', NULL,
                  'qty', od.${OD_QTY_COL},
                  'price', od.${OD_PRICE_COL}
                )`}
                ELSE JSON_BUILD_OBJECT(
                  'product_id', p.${P_ID_COL},
                  'name', COALESCE(p.${P_NAME_COL}, 'ไม่ระบุชื่อ'),
                  'image', ${P_IMG_COL ? `p.${P_IMG_COL}` : 'NULL'},
                  'qty', od.${OD_QTY_COL},
                  'price', od.${OD_PRICE_COL}
                )
              END
            ) FILTER (WHERE od.order_id IS NOT NULL),
            '[]'::json
          ) AS items
        FROM latest l
        LEFT JOIN order_details od ON od.order_id = l.order_id
        LEFT JOIN products p ON p.${P_ID_COL} = od.${OD_ITEM_ID_COL} AND od.${OD_ITEM_TYPE_COL} <> 'rabbit'
        ${HAS_RABBITS ? `LEFT JOIN rabbits r ON r.${R_ID_COL} = od.${OD_ITEM_ID_COL} AND od.${OD_ITEM_TYPE_COL} = 'rabbit'` : ''}
        GROUP BY l.order_id, l.order_date, l.status, l.payment_status, l.total_amount, l.buyer_name
        ORDER BY l.order_date DESC
      `),

      // ✅ Top 5 สินค้าขายดี (7 วัน) รวม products + rabbits
      client.query(`
        SELECT
          CASE WHEN od.${OD_ITEM_TYPE_COL} = 'rabbit' ${HAS_RABBITS ? `THEN r.${R_ID_COL}` : `THEN od.${OD_ITEM_ID_COL}`} ELSE p.${P_ID_COL} END AS product_id,
          CASE WHEN od.${OD_ITEM_TYPE_COL} = 'rabbit' ${HAS_RABBITS ? `THEN COALESCE(r.${R_NAME_COL}, 'ไม่ระบุชื่อ')` : `THEN 'กระต่าย'`} ELSE COALESCE(p.${P_NAME_COL}, 'ไม่ระบุชื่อ') END AS product_name,
          CASE WHEN od.${OD_ITEM_TYPE_COL} = 'rabbit' ${HAS_RABBITS ? `THEN ${R_IMG_COL ? `r.${R_IMG_COL}` : 'NULL'}` : `THEN NULL`} ELSE ${P_IMG_COL ? `p.${P_IMG_COL}` : 'NULL'} END AS image,
          SUM(od.${OD_QTY_COL})::int AS sold_qty,
          SUM( (od.${OD_QTY_COL}) * od.${OD_PRICE_COL} )::numeric AS revenue
        FROM orders o
        JOIN order_details od ON od.order_id = o.order_id
        LEFT JOIN products p ON p.${P_ID_COL} = od.${OD_ITEM_ID_COL} AND od.${OD_ITEM_TYPE_COL} <> 'rabbit'
        ${HAS_RABBITS ? `LEFT JOIN rabbits r ON r.${R_ID_COL} = od.${OD_ITEM_ID_COL} AND od.${OD_ITEM_TYPE_COL} = 'rabbit'` : ''}
        WHERE o.order_date >= (${sevenFrom})
          AND o.order_date <  (${sevenEnd} + INTERVAL '1 day')
          AND o.status IN ('done','shipped','ready_to_ship')
        GROUP BY 1,2,3
        ORDER BY sold_qty DESC
        LIMIT 5
      `),
    ]);

    // --------- รวมผล ---------
    const stats = {
      salesToday:   Number(salesTodayQ.rows[0]?.total || 0),
      salesMonth:   Number(salesMonthQ.rows[0]?.total || 0),
      ordersToday:  Number(ordersTodayQ.rows[0]?.cnt || 0),
      ordersMonth:  Number(ordersMonthQ.rows[0]?.cnt || 0),
      totalProducts:Number(invQ.rows[0]?.total_products || 0),
      lowStock:     Number(invQ.rows[0]?.low_stock || 0),
      totalRabbits: Number(rabbitsQ.rows[0]?.total_rabbits || 0),
    };

    const salesByDay = sales7DaysQ.rows.map(r => ({ date: r.date, total: Number(r.total || 0) }));

    const recentOrders = recentOrdersQ.rows.map(r => ({
      order_id: r.order_id,
      order_date: r.order_date,
      status: r.status,
      payment_status: r.payment_status,
      total_amount: Number(r.total_amount || 0),
      buyer_name: r.buyer_name || '—',
      items: (r.items || []).map(it => ({
        product_id: it.product_id,
        name: it.name,
        image: it.image || null,
        qty: Number(it.qty || 0),
        price: Number(it.price || 0),
      })),
    }));

    const topProducts = (topProductsQ.rows || []).map(r => ({
      product_id: r.product_id,
      name: r.product_name,
      image: r.image || null,
      sold_qty: Number(r.sold_qty || 0),
      revenue: Number(r.revenue || 0),
    }));

    res.json({ stats, salesByDay, recentOrders, topProducts });
  } catch (err) {
    console.error('admin/dashboard/stats error:', err);
    res.status(500).json({ message: 'failed to load dashboard', error: String(err?.message || err) });
  } finally {
    client.release();
  }
});

// ================================================
// =============== USERS (ADMIN) ==================
// ================================================

// GET: ดึงผู้ใช้ทั้งหมด (แมพ user_id -> id ให้ React ใช้ได้)
app.get("/api/admin/users", async (req, res) => {
  try {
    const q = `
      SELECT 
        user_id AS id,
        username,
        email,
        role,
        phone,
        address,
        profile_image,
        gender,
        email_verified
      FROM users
      ORDER BY user_id ASC
    `;
    const result = await pool.query(q);
    res.json(result.rows);
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
// DELETE: ลบผู้ใช้ตาม user_id
app.delete("/api/admin/users/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: "invalid id" });
    }

    await client.query("BEGIN");

    const delUser = await client.query(
      `DELETE FROM users WHERE user_id = $1 RETURNING user_id`,
      [id]
    );

    if (delUser.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    await client.query("COMMIT");
    return res.json({ message: "User deleted", id });
  } catch (err) {
    // ✅ ใช้ client ไม่ใช่ pool
    await client.query("ROLLBACK").catch(() => {});

    // ถ้าติด FK → แจ้ง 409 และบอกทางเลือก
    if (err?.code === "23503") {
      return res.status(409).json({
        message: "Cannot delete user: there are dependent orders referencing this user.",
        hint: "Set FK to ON DELETE CASCADE, or soft-delete the user, หรือให้ลบ orders ก่อน",
        constraint: err?.constraint,
      });
    }

    console.error("DELETE /api/admin/users/:id error:", err);
    return res.status(500).json({ message: "Server error", detail: err?.message });
  } finally {
    client.release();
  }
});

// helper แปลงยอด “1,234.50”
const parseMoney = (v) => {
  if (v == null) return null;
  const num = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
};
const ALLOWED_PM = new Set(['cod','bank_transfer','wallet','cash']);

/* ----------------------------------------------------------------
 *  Parents (พ่อ–แม่พันธุ์)  — ONE canonical definition
 * ---------------------------------------------------------------- */
app.get('/api/parents', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '12', 10), 1);
    const offset = (page - 1) * limit;

    const gender = (req.query.gender || '').toLowerCase();
    const search = (req.query.search || '').trim();

    const where = ['is_parent = TRUE'];
    const vals = [];
    if (gender === 'male' || gender === 'female') {
      vals.push(gender);
      where.push(`LOWER(gender) = $${vals.length}`);
    }
    if (search) {
      vals.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(name) LIKE $${vals.length} OR LOWER(breed) LIKE $${vals.length})`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalQ = await pool.query(`SELECT COUNT(*)::int AS total FROM rabbits ${whereSql}`, vals);
    const total = totalQ.rows[0]?.total || 0;

    vals.push(limit, offset);
    const rowsQ = await pool.query(
      `SELECT rabbit_id, name, breed, age, weight, gender,
              image_url, parent_role, available_date, price, status, stock
         FROM rabbits
       ${whereSql}
       ORDER BY rabbit_id DESC
       LIMIT $${vals.length-1} OFFSET $${vals.length}`, vals
    );

    res.json({ page, limit, total, totalPages: Math.max(1, Math.ceil(total/limit)), items: rowsQ.rows });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/parents/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const q = await pool.query(
      `SELECT rabbit_id, name, breed, age, weight, gender, price,
              image_url, status, parent_role, available_date, stock
         FROM rabbits
        WHERE is_parent = TRUE AND rabbit_id = $1`, [id]
    );
    if (!q.rowCount) return res.status(404).json({ error: 'not found' });
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

/* ----------------------------------------------------------------
 *  ลูกค้าสร้างคำขอยืม (ไม่ตัดสต๊อก ณ จุดนี้)
 * ---------------------------------------------------------------- */
app.post('/api/breeding-loans', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      rabbit_id,
      borrower_name,
      borrower_phone = null,
      borrower_address = null,
      start_date, end_date,
      notes = null,
      total_price = null,
      payment_method: pmFromBody,
      user_id: userIdFromBody,
    } = req.body || {};

    let payment_method = pmFromBody ? String(pmFromBody).toLowerCase() : null;
    if (payment_method && !ALLOWED_PM.has(payment_method)) payment_method = null;

    const borrower_user_id = Number.isFinite(Number(userIdFromBody))
      ? Number(userIdFromBody)
      : (req.user?.user_id || null);

    await client.query('BEGIN');

    // lock กระต่าย
    const rq = await client.query(
      `SELECT is_parent, COALESCE(stock,0) AS stock, status
         FROM rabbits WHERE rabbit_id=$1 FOR UPDATE`, [rabbit_id]
    );
    if (!rq.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error:'rabbit not found' }); }
    const rb = rq.rows[0];
    if (!rb.is_parent) { await client.query('ROLLBACK'); return res.status(400).json({ error:'rabbit is not marked as parent' }); }
    if (rb.status === 'out_of_stock' && rb.stock <= 0) { await client.query('ROLLBACK'); return res.status(409).json({ error:'หมดตัวแล้ว' }); }

    const ins = await client.query(
      `INSERT INTO breeding_loans
         (rabbit_id, borrower_user_id, borrower_name, borrower_phone, borrower_address,
          start_date, end_date, status, notes, total_price,
          payment_method, payment_status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'requested',$8,$9,
               $10,'pending',NOW(),NOW())
       RETURNING loan_id, payment_method`,
      [rabbit_id, borrower_user_id, borrower_name, borrower_phone, borrower_address,
       start_date, end_date, notes, total_price, payment_method]
    );

    await client.query('COMMIT');
    res.status(201).json({ loan_id: ins.rows[0].loan_id, status: 'requested', payment_method: ins.rows[0].payment_method });
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: e.message || 'Server error' });
  } finally { client.release(); }
});

/* ----------------------------------------------------------------
 *  ลูกค้าส่งสลิป/ระบุยอดชำระ
 * ---------------------------------------------------------------- */
app.post('/api/breeding-loans/:id/pay', uploadSlip.single('slip'), async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid loan id' });

    let method = (req.body?.payment_method || 'bank_transfer').toString().toLowerCase().trim();
    if (!ALLOWED_PM.has(method)) method = 'bank_transfer';

    const amount = method === 'bank_transfer' ? parseMoney(req.body?.payment_amount) : parseMoney(req.body?.payment_amount);
    if (method === 'bank_transfer' && amount === null) {
      return res.status(400).json({ error: 'payment_amount required (> 0) for bank_transfer' });
    }
    const ref = (req.body?.payment_ref || '').toString().trim() || null;
    const slipPath = req.file ? `/uploads/slips/${req.file.filename}` : null;

    await client.query('BEGIN');

    const chk = await client.query('SELECT loan_id FROM breeding_loans WHERE loan_id=$1 FOR UPDATE', [id]);
    if (!chk.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error:'not found' }); }

    const up = await client.query(
      `UPDATE breeding_loans
          SET payment_status   = 'submitted',
              payment_method   = $2,
              payment_amount   = $3,
              payment_ref      = $4,
              payment_slip_url = COALESCE($5, payment_slip_url),
              updated_at       = NOW()
        WHERE loan_id = $1
        RETURNING loan_id, payment_status, payment_method, payment_amount, payment_ref, payment_slip_url`,
      [id, method, amount, ref, slipPath]
    );

    await client.query('COMMIT');
    res.json({ ok: true, ...up.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK'); console.error('PAY ERROR:', e);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

/* ----------------------------------------------------------------
 *  My Loans (2 รูปแบบ: /me ใช้ auth, และ / แบบ dev ?user_id=|?buyer_id=)
 * ---------------------------------------------------------------- */
const selectMyLoans = `
  SELECT
    bl.loan_id, bl.rabbit_id,
    bl.borrower_name, bl.borrower_phone, bl.borrower_address,
    bl.start_date, bl.end_date, bl.status, bl.notes,
    bl.payment_status, bl.payment_method, bl.payment_amount, bl.payment_ref, bl.payment_slip_url, bl.paid_at,
    bl.total_price,
    bl.ship_carrier, bl.ship_tracking_code, bl.shipped_at,
    bl.return_requested, bl.return_requested_at,
    bl.return_method, bl.return_from_text,
    bl.return_carrier, bl.return_tracking_code, bl.pickup_time,
    bl.return_note,
    COALESCE(bl.created_at, bl.start_date, NOW()) AS created_at,
    r.name AS rabbit_name, r.image_url AS rabbit_image,
    r.breed AS rabbit_breed, r.gender AS rabbit_gender
  FROM breeding_loans bl
  JOIN rabbits r ON r.rabbit_id = bl.rabbit_id
  WHERE bl.borrower_user_id = $1
  ORDER BY bl.loan_id DESC
`;

const selectMySummary = `
  SELECT
    COUNT(*)::int AS count,
    COALESCE(SUM(total_price),0)::numeric AS total_spent,
    SUM((status='on_loan')::int)::int     AS on_loan,
    SUM((status='returned')::int)::int    AS returned,
    SUM((status='requested')::int)::int   AS requested,
    SUM((status='approved')::int)::int    AS approved,
    SUM((status='cancelled')::int)::int   AS cancelled
  FROM breeding_loans
  WHERE borrower_user_id=$1
`;

app.get('/api/my-breeding-loans/me', async (req, res) => {
  try {
    let rawUid = req.user?.user_id;
    if (!rawUid) rawUid = req.query.user_id ?? req.query.buyer_id;
    const uid = Number(rawUid);
    if (!Number.isFinite(uid)) return res.status(401).json({ error: 'unauthenticated or invalid user_id/buyer_id' });

    const [itemsQ, sumQ] = await Promise.all([
      pool.query(selectMyLoans, [uid]),
      pool.query(selectMySummary, [uid]),
    ]);
    res.json({ summary: sumQ.rows[0], items: itemsQ.rows });
  } catch (e) { console.error(e); res.status(500).json({ error:'Server error' }); }
});

app.get('/api/my-breeding-loans', async (req, res) => {
  try {
    const uid = Number(req.query.user_id ?? req.query.buyer_id);
    if (!Number.isFinite(uid)) return res.status(400).json({ message: 'invalid user_id/buyer_id' });

    const [itemsQ, sumQ] = await Promise.all([
      pool.query(selectMyLoans, [uid]),
      pool.query(selectMySummary, [uid]),
    ]);
    res.json({ summary: sumQ.rows[0], items: itemsQ.rows });
  } catch (e) { console.error(e); res.status(500).json({ message:'server error' }); }
});

// --- ลูกค้า “แจ้งคืน” ---
app.post('/api/breeding-loans/:id/return-request', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      return_method = null,      // 'ship' | 'dropoff' | 'pickup'
      return_from_text = null,
      return_carrier = null,
      return_tracking_code = null,
      pickup_time = null,        // ISO string (optional)
      return_note = null
    } = req.body || {};

    const cur = await pool.query(`SELECT status FROM breeding_loans WHERE loan_id=$1`, [id]);
    if (!cur.rowCount) return res.status(404).json({ error:'not found' });
    if (cur.rows[0].status !== 'on_loan')
      return res.status(400).json({ error:'invalid state (not on_loan)' });

    // ถ้าเลือก pickup แล้วไม่ได้ส่งเวลา → ตั้ง NOW() ให้เลย
    const up = await pool.query(
      `UPDATE breeding_loans SET
          return_requested     = TRUE,
          return_requested_at  = NOW(),
          return_method        = COALESCE($1, return_method),
          return_from_text     = COALESCE($2, return_from_text),
          return_carrier       = COALESCE($3, return_carrier),
          return_tracking_code = COALESCE($4, return_tracking_code),
          pickup_time          = COALESCE($5::timestamptz,
                                          CASE WHEN $1 = 'pickup' THEN NOW() ELSE pickup_time END),
          return_note          = COALESCE($6, return_note),
          updated_at           = NOW()
       WHERE loan_id=$7
       RETURNING loan_id, status, return_requested, return_requested_at,
                 return_method, return_from_text, return_carrier,
                 return_tracking_code, pickup_time, return_note`,
      [return_method, return_from_text, return_carrier, return_tracking_code, pickup_time, return_note, id]
    );

    res.json({ message:'return requested', loan: up.rows[0] });
  } catch (e) {
    console.error(e); res.status(500).json({ error:'Server error' });
  }
});

/* ----------------------------------------------------------------
 *  Admin
 * ---------------------------------------------------------------- */
// list + filter/paginate
app.get('/api/admin/breeding-loans', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.max(parseInt(req.query.limit || '10', 10), 1);
    const offset = (page - 1) * limit;

    const status = (req.query.status || '').toLowerCase();
    const search = (req.query.search || '').trim();

    const where = ['1=1'];
    const vals = [];
    if (status) { vals.push(status); where.push(`LOWER(bl.status) = $${vals.length}`); }
    if (search) {
      vals.push(`%${search.toLowerCase()}%`);
      where.push(`(
        LOWER(bl.borrower_name)  LIKE $${vals.length} OR
        LOWER(bl.borrower_phone) LIKE $${vals.length} OR
        LOWER(r.name)            LIKE $${vals.length}
      )`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const totalQ = await pool.query(
      `SELECT COUNT(*)::int AS total
         FROM breeding_loans bl
         JOIN rabbits r ON r.rabbit_id = bl.rabbit_id
       ${whereSql}`, vals
    );
    const total = totalQ.rows[0]?.total || 0;

    vals.push(limit, offset);
    const rowsQ = await pool.query(
      `SELECT
         bl.loan_id, bl.rabbit_id,
         bl.borrower_name, bl.borrower_phone, bl.borrower_address,
         bl.start_date, bl.end_date, bl.status, bl.notes,
         bl.total_price,

         bl.payment_status, bl.payment_method, bl.payment_amount,
         bl.payment_ref, bl.payment_slip_url, bl.paid_at,

         bl.ship_carrier, bl.ship_tracking_code, bl.shipped_at,
         bl.return_requested, bl.return_requested_at,
         bl.return_method, bl.return_from_text,
         bl.return_carrier, bl.return_tracking_code, bl.pickup_time,
         bl.return_note,

         COALESCE(bl.created_at, bl.start_date, NOW()) AS created_at,
         r.name AS rabbit_name, r.image_url AS rabbit_image,
         r.breed AS rabbit_breed, r.gender AS rabbit_gender
       FROM breeding_loans bl
       JOIN rabbits r ON r.rabbit_id = bl.rabbit_id
       ${whereSql}
       ORDER BY bl.loan_id DESC
       LIMIT $${vals.length-1} OFFSET $${vals.length}`, vals
    );

    res.json({ page, limit, total, totalPages: Math.max(1, Math.ceil(total/limit)), items: rowsQ.rows });
  } catch (e) { console.error('GET /api/admin/breeding-loans error:', e); res.status(500).json({ error: 'Server error' }); }
});

// update fields (form “บันทึก”)
app.put('/api/admin/breeding-loans/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status, borrower_name, borrower_phone, borrower_address, start_date, end_date, notes } = req.body || {};
    const q = await pool.query(
      `UPDATE breeding_loans SET
         status          = COALESCE($1, status),
         borrower_name   = COALESCE($2, borrower_name),
         borrower_phone  = COALESCE($3, borrower_phone),
         borrower_address= COALESCE($4, borrower_address),
         start_date      = COALESCE($5::date, start_date),
         end_date        = COALESCE($6::date, end_date),
         notes           = COALESCE($7, notes),
         updated_at      = NOW()
       WHERE loan_id = $8
       RETURNING *`,
      [status, borrower_name, borrower_phone, borrower_address, start_date, end_date, notes, id]
    );
    if (!q.rowCount) return res.status(404).json({ error: 'not found' });
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// approve request
app.post('/api/admin/breeding-loans/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const q = await pool.query(
      `UPDATE breeding_loans SET status='approved', updated_at=NOW()
        WHERE loan_id=$1 RETURNING *`, [id]
    );
    if (!q.rowCount) return res.status(404).json({ error:'not found' });
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// add ship tracking (เฉพาะเลข)
app.put('/api/admin/breeding-loans/:id/ship', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { ship_carrier=null, ship_tracking_code=null } = req.body || {};
    const q = await pool.query(
      `UPDATE breeding_loans
          SET ship_carrier=$2, ship_tracking_code=$3,
              shipped_at = NOW(), updated_at = NOW()
        WHERE loan_id=$1 RETURNING *`,
      [id, ship_carrier, ship_tracking_code]
    );
    if (!q.rowCount) return res.status(404).json({ error:'not found' });
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error:'Server error' }); }
});

// start (ตัดสต๊อก + เปลี่ยน on_loan) + optional mark_paid
app.post('/api/admin/breeding-loans/:id/start', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    const { ship_carrier=null, ship_tracking_code=null, mark_paid=false, paid_amount=null } = req.body || {};

    await client.query('BEGIN');

    const blQ = await client.query(
      `SELECT loan_id, rabbit_id, status, payment_status, total_price
         FROM breeding_loans WHERE loan_id=$1 FOR UPDATE`, [id]
    );
    if (!blQ.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error:'not found' }); }
    const bl = blQ.rows[0];
    if (!['requested','approved'].includes(bl.status)) { await client.query('ROLLBACK'); return res.status(400).json({ error:'invalid state to start' }); }

    const rbQ = await client.query(`SELECT COALESCE(stock,0) AS stock FROM rabbits WHERE rabbit_id=$1 FOR UPDATE`, [bl.rabbit_id]);
    const stock = rbQ.rows[0].stock;
    if (stock <= 0) { await client.query('ROLLBACK'); return res.status(409).json({ error:'หมดตัวแล้ว' }); }

    await client.query(
      `UPDATE rabbits
          SET stock=COALESCE(stock,0)-1,
              status = CASE WHEN COALESCE(stock,0)-1 <= 0 THEN 'out_of_stock' ELSE status END
        WHERE rabbit_id=$1`, [bl.rabbit_id]
    );

    await client.query(
      `UPDATE breeding_loans
          SET status='on_loan',
              ship_carrier       = COALESCE($2, ship_carrier),
              ship_tracking_code = COALESCE($3, ship_tracking_code),
              shipped_at         = CASE WHEN $2 IS NOT NULL OR $3 IS NOT NULL THEN NOW() ELSE shipped_at END,
              updated_at         = NOW()
        WHERE loan_id=$1`, [id, ship_carrier, ship_tracking_code]
    );

    if (mark_paid && bl.payment_status !== 'paid') {
      const amt = Number.isFinite(Number(paid_amount)) ? Number(paid_amount) : Number(bl.total_price || 0);
      await client.query(
        `UPDATE breeding_loans
            SET payment_status='paid', payment_amount=$2, paid_at=NOW(), updated_at=NOW()
          WHERE loan_id=$1`,
        [id, amt]
      );
    }

    const latest = await client.query(`SELECT * FROM breeding_loans WHERE loan_id=$1`, [id]);
    await client.query('COMMIT');
    res.json(latest.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error:'Server error' });
  } finally { client.release(); }
});

// cancel (คืนสต๊อกถ้าเคย on_loan)
app.post('/api/admin/breeding-loans/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    await client.query('BEGIN');

    const blQ = await client.query(`SELECT loan_id, rabbit_id, status FROM breeding_loans WHERE loan_id=$1 FOR UPDATE`, [id]);
    if (!blQ.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error:'not found' }); }
    const bl = blQ.rows[0];

    if (bl.status === 'on_loan') {
      await client.query(
        `UPDATE rabbits
            SET stock=COALESCE(stock,0)+1,
                status = CASE WHEN COALESCE(stock,0)+1 > 0 THEN 'available' ELSE status END
          WHERE rabbit_id=$1`, [bl.rabbit_id]
      );
    }

    const upQ = await client.query(
      `UPDATE breeding_loans SET status='cancelled', updated_at=NOW()
        WHERE loan_id=$1 RETURNING *`, [id]
    );

    await client.query('COMMIT');
    res.json(upQ.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); console.error(e); res.status(500).json({ error:'Server error' }); }
  finally { client.release(); }
});

// --- รับคืน (คืนสต๊อก + ปิดงานเป็น returned + ใส่ returned_at) ---
app.post('/api/admin/breeding-loans/:id/mark-returned', async (req, res) => {
  const client = await pool.connect();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });

    await client.query('BEGIN');

    const blQ = await client.query(
      `SELECT loan_id, rabbit_id, status
         FROM breeding_loans
        WHERE loan_id = $1
        FOR UPDATE`, [id]
    );
    if (!blQ.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'not found' }); }
    const bl = blQ.rows[0];

    if (!['on_loan', 'approved'].includes(bl.status)) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'invalid state to return' });
    }

    const rbQ = await client.query(
      `UPDATE rabbits
          SET stock  = COALESCE(stock,0) + 1,
              status = CASE WHEN COALESCE(stock,0) + 1 > 0 THEN 'available' ELSE status END
        WHERE rabbit_id = $1
        RETURNING rabbit_id, stock, status`,
      [bl.rabbit_id]
    );

    const upQ = await client.query(
      `UPDATE breeding_loans
          SET status = 'returned',
              returned_at = NOW(),
              updated_at = NOW()
        WHERE loan_id = $1
        RETURNING loan_id, status, returned_at`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ ok: true, loan: upQ.rows[0], rabbit: rbQ.rows[0], message: 'marked as returned and restocked' });
  } catch (e) {
    await client.query('ROLLBACK'); console.error(e);
    res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

// approve / reject payment
app.post('/api/admin/breeding-loans/:id/payment-approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const q = await pool.query(
      `UPDATE breeding_loans
         SET payment_status='paid',
             paid_at=NOW(),
             payment_amount = COALESCE(payment_amount, total_price),
             updated_at=NOW()
       WHERE loan_id=$1
       RETURNING loan_id, payment_status, payment_amount, paid_at`, [id]
    );
    if (!q.rowCount) return res.status(404).json({ error:'not found' });
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error:'Server error' }); }
});

app.post('/api/admin/breeding-loans/:id/payment-reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const q = await pool.query(
      `UPDATE breeding_loans
         SET payment_status='rejected', updated_at=NOW()
       WHERE loan_id=$1 RETURNING loan_id, payment_status`, [id]
    );
    if (!q.rowCount) return res.status(404).json({ error:'not found' });
    res.json(q.rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error:'Server error' }); }
});
/* ===================== Start server ===================== */
app.listen(port, ()=>console.log(`🐰 Server running at http://localhost:${port}`));