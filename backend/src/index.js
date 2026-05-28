const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { pool } = require('./db');
const { runMigrations } = require('./migrate');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/entries',     require('./routes/entries'));
app.use('/api/masterdata',  require('./routes/masterdata'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/attachments', require('./routes/attachments'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

async function ensureAdminUser() {
  const { rows } = await pool.query("SELECT id FROM users WHERE username='admin'");
  if (rows.length === 0) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query(
      "INSERT INTO users (username,email,password_hash,is_admin) VALUES ('admin','admin@local.dev',$1,TRUE)",
      [hash]
    );
    console.log('Created default admin user: admin / admin123');
  }
}

const PORT = process.env.PORT || 3001;

async function start() {
  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch {
      retries--;
      console.log(`DB not ready, retrying... (${retries} left)`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log('Running database migrations...');
  await runMigrations();
  await ensureAdminUser();
  app.listen(PORT, () => console.log(`Backend running on :${PORT}`));
}

start().catch(console.error);
