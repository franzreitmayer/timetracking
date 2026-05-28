#!/bin/bash
# Einmalig auszuführen auf Servern, die bereits vor dem
# Migrations-System liefen (vor Commit a0b0fc7).
#
# Markiert die ersten 3 Migrationen als bereits angewandt,
# damit der Backend-Start nicht versucht sie nochmal einzuspielen.

set -e

DB_CONTAINER=${1:-zeiterfassung-db-1}

echo "Bootstrapping schema_migrations on container: $DB_CONTAINER"

docker exec "$DB_CONTAINER" psql -U zeit -d zeiterfassung -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO schema_migrations (version) VALUES
  ('001_initial_schema.sql'),
  ('002_add_attachments.sql'),
  ('003_add_is_billable.sql')
ON CONFLICT DO NOTHING;
SELECT version, applied_at FROM schema_migrations ORDER BY version;
"

echo "Done. You can now run: docker compose up -d backend"
