-- Initiales Schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE master_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL CHECK (type IN ('kostenstelle', 'kostentraeger')),
  code VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(type, code)
);

CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  short_text VARCHAR(255) NOT NULL,
  long_text TEXT,
  kostenstelle VARCHAR(100),
  kostentraeger VARCHAR(100),
  is_travel BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, entry_date);

INSERT INTO master_data (type, code, label) VALUES
  ('kostenstelle', '1000', 'Allgemein'),
  ('kostenstelle', '1100', 'Entwicklung'),
  ('kostenstelle', '1200', 'Vertrieb'),
  ('kostentraeger', 'P001', 'Projekt Alpha'),
  ('kostentraeger', 'P002', 'Projekt Beta'),
  ('kostentraeger', 'INTERN', 'Intern');
