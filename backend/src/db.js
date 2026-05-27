const { Pool, types } = require('pg');

// Return DATE as plain "YYYY-MM-DD" string, not a JavaScript Date object
types.setTypeParser(1082, (val) => val);
// Return TIME as plain "HH:MM:SS" string (already the default, but be explicit)
types.setTypeParser(1083, (val) => val);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'zeiterfassung',
  user: process.env.DB_USER || 'zeit',
  password: process.env.DB_PASSWORD || 'zeit',
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = { pool };
