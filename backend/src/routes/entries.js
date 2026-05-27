const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { date_from, date_to } = req.query;
  try {
    let query = `SELECT * FROM time_entries WHERE user_id = $1`;
    const params = [req.user.id];
    if (date_from) { params.push(date_from); query += ` AND entry_date >= $${params.length}`; }
    if (date_to)   { params.push(date_to);   query += ` AND entry_date <= $${params.length}`; }
    query += ' ORDER BY entry_date, start_time';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { entry_date, start_time, end_time, short_text, long_text, kostenstelle, kostentraeger, is_travel, is_billable } = req.body;
  if (!entry_date || !start_time || !end_time || !short_text) {
    return res.status(400).json({ error: 'entry_date, start_time, end_time, short_text are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO time_entries (user_id, entry_date, start_time, end_time, short_text, long_text, kostenstelle, kostentraeger, is_travel, is_billable)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, entry_date, start_time, end_time, short_text, long_text || null, kostenstelle || null, kostentraeger || null, is_travel || false, is_billable || false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { entry_date, start_time, end_time, short_text, long_text, kostenstelle, kostentraeger, is_travel, is_billable } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE time_entries SET
        entry_date=$1, start_time=$2, end_time=$3, short_text=$4,
        long_text=$5, kostenstelle=$6, kostentraeger=$7, is_travel=$8, is_billable=$9, updated_at=NOW()
       WHERE id=$10 AND user_id=$11 RETURNING *`,
      [entry_date, start_time, end_time, short_text, long_text || null, kostenstelle || null, kostentraeger || null, is_travel || false, is_billable || false, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM time_entries WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
