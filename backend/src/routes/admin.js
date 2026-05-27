const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');

router.use(requireAdmin);

router.get('/users', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, username, email, is_admin, is_active, created_at FROM users ORDER BY created_at'
  );
  res.json(rows);
});

router.post('/users', async (req, res) => {
  const { username, email, password, is_admin } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password too short (min 6)' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (username,email,password_hash,is_admin) VALUES ($1,$2,$3,$4) RETURNING id,username,email,is_admin,is_active,created_at',
      [username, email, hash, is_admin || false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  const { username, email, is_admin, is_active, password } = req.body;
  try {
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Password too short' });
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    }
    const { rows } = await pool.query(
      'UPDATE users SET username=$1,email=$2,is_admin=$3,is_active=$4 WHERE id=$5 RETURNING id,username,email,is_admin,is_active,created_at',
      [username, email, is_admin, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const { rowCount } = await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
