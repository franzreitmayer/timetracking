-- Verrechenbar-Flag für Zeiteinträge
ALTER TABLE time_entries ADD COLUMN is_billable BOOLEAN DEFAULT FALSE;
