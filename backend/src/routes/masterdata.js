const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// All authenticated users can read
router.get('/:type', requireAuth, async (req, res) => {
  const { type } = req.params;
  if (!['kostenstelle', 'kostentraeger'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
  const { rows } = await pool.query(
    'SELECT * FROM master_data WHERE type=$1 AND is_active=TRUE ORDER BY code',
    [type]
  );
  res.json(rows);
});

// Admin only: create
router.post('/', requireAdmin, async (req, res) => {
  const { type, code, label } = req.body;
  if (!type || !code || !label) return res.status(400).json({ error: 'type, code, label required' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO master_data (type,code,label) VALUES ($1,$2,$3) RETURNING *',
      [type, code, label]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Code already exists for this type' });
    res.status(500).json({ error: err.message });
  }
});

// Admin only: update
router.put('/:id', requireAdmin, async (req, res) => {
  const { code, label, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE master_data SET code=$1,label=$2,is_active=$3 WHERE id=$4 RETURNING *',
      [code, label, is_active, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin only: delete
router.delete('/:id', requireAdmin, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM master_data WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
