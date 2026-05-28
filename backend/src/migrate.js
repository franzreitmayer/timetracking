const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

// In Docker: /migrations (Volume-Mount), lokal: ../../migrations
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(__dirname, '../../migrations');

async function runMigrations() {
  // Migrations-Tabelle anlegen falls nicht vorhanden
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Bereits angewendete Migrationen laden
  const { rows } = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  const applied = new Set(rows.map(r => r.version));

  // Alle .sql-Dateien aus migrations/ einlesen und sortieren
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    console.log(`  → Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

    // Jede Migration in einer Transaktion ausführen
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran++;
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${file} failed: ${err.message}`);
    } finally {
      client.release();
    }
  }

  if (ran === 0) {
    console.log('  ✓ Database up to date, no migrations needed');
  } else {
    console.log(`  ✓ Applied ${ran} migration(s)`);
  }
}

module.exports = { runMigrations };
