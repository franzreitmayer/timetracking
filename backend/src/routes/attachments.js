const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth, SECRET } = require('../middleware/auth');

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/uploads';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, req.params.entryId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});

// List attachments for an entry
router.get('/entry/:entryId', requireAuth, async (req, res) => {
  const { rows: entries } = await pool.query(
    'SELECT id FROM time_entries WHERE id=$1 AND user_id=$2',
    [req.params.entryId, req.user.id]
  );
  if (!entries[0]) return res.status(404).json({ error: 'Entry not found' });

  const { rows } = await pool.query(
    'SELECT * FROM attachments WHERE entry_id=$1 ORDER BY created_at',
    [req.params.entryId]
  );
  res.json(rows);
});

// Upload attachment
router.post('/entry/:entryId', requireAuth, upload.single('file'), async (req, res) => {
  const { rows: entries } = await pool.query(
    'SELECT id FROM time_entries WHERE id=$1 AND user_id=$2',
    [req.params.entryId, req.user.id]
  );
  if (!entries[0]) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(404).json({ error: 'Entry not found' });
  }
  if (!req.file) return res.status(400).json({ error: 'No file' });

  const { rows } = await pool.query(
    'INSERT INTO attachments (entry_id,user_id,original_name,stored_name,mimetype,size) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [req.params.entryId, req.user.id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]
  );
  res.status(201).json(rows[0]);
});

// Serve file — accepts token via query string so <img src> works without extra headers
router.get('/file/:id', async (req, res) => {
  let userId;
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    try { userId = jwt.verify(authHeader.split(' ')[1], SECRET).id; } catch {}
  }
  if (!userId && req.query.token) {
    try { userId = jwt.verify(req.query.token, SECRET).id; } catch {}
  }
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { rows } = await pool.query(
    'SELECT * FROM attachments WHERE id=$1 AND user_id=$2',
    [req.params.id, userId]
  );
  const att = rows[0];
  if (!att) return res.status(404).json({ error: 'Not found' });

  const filePath = path.join(UPLOAD_DIR, att.entry_id, att.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

  res.setHeader('Content-Type', att.mimetype || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `${req.query.download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(att.original_name)}"`
  );
  res.sendFile(path.resolve(filePath));
});

// Delete attachment
router.delete('/:id', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM attachments WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]
  );
  const att = rows[0];
  if (!att) return res.status(404).json({ error: 'Not found' });

  try { fs.unlinkSync(path.join(UPLOAD_DIR, att.entry_id, att.stored_name)); } catch {}
  await pool.query('DELETE FROM attachments WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
