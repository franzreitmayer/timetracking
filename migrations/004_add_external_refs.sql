-- Externe Referenzen an Zeiteinträgen
ALTER TABLE time_entries ADD COLUMN external_ref1 VARCHAR(100);
ALTER TABLE time_entries ADD COLUMN external_ref2 VARCHAR(100);

-- Stammdaten-Tabelle für Externe Referenz 1
CREATE TABLE ext_ref1 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referent VARCHAR(100) NOT NULL,
  beschreibung VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stammdaten-Tabelle für Externe Referenz 2
CREATE TABLE ext_ref2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referent VARCHAR(100) NOT NULL,
  beschreibung VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
