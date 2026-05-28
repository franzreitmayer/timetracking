const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const TABLES = { ref1: 'ext_ref1', ref2: 'ext_ref2' };

function table(type) {
  const t = TABLES[type];
  if (!t) throw new Error('Invalid type');
  return t;
}

// GET /api/extrefs/ref1  oder  /api/extrefs/ref2
router.get('/:type', requireAuth, async (req, res) => {
  try {
    const t = table(req.params.type);
    const { rows } = await pool.query(
      `SELECT * FROM ${t} WHERE is_active = TRUE ORDER BY referent`
    );
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Eintrag anlegen
router.post('/:type', requireAdmin, async (req, res) => {
  const { referent, beschreibung } = req.body;
  if (!referent?.trim()) return res.status(400).json({ error: 'referent is required' });
  try {
    const t = table(req.params.type);
    const { rows } = await pool.query(
      `INSERT INTO ${t} (referent, beschreibung) VALUES ($1, $2) RETURNING *`,
      [referent.trim(), beschreibung?.trim() || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Eintrag aktualisieren
router.put('/:type/:id', requireAdmin, async (req, res) => {
  const { referent, beschreibung, is_active } = req.body;
  if (!referent?.trim()) return res.status(400).json({ error: 'referent is required' });
  try {
    const t = table(req.params.type);
    const { rows } = await pool.query(
      `UPDATE ${t} SET referent=$1, beschreibung=$2, is_active=$3 WHERE id=$4 RETURNING *`,
      [referent.trim(), beschreibung?.trim() || null, is_active ?? true, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Eintrag löschen
router.delete('/:type/:id', requireAdmin, async (req, res) => {
  try {
    const t = table(req.params.type);
    const { rowCount } = await pool.query(`DELETE FROM ${t} WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
