# Zeiterfassung – Technische Projektdokumentation

## Überblick

Webbasierte Zeiterfassungsanwendung für KMUs. Docker-Compose-Stack mit drei Services.
Aktuell als Single-Tenant-System konzipiert (eine Firma pro Deployment).

**Produktiver Zugriff:** http://localhost:8090  
**Default-Login:** admin / admin123  
**Git-Repository:** https://github.com/franzreitmayer/timetracking.git

---

## Architektur

```
Browser
  └── nginx :8090 (frontend)
        └── /api/* → proxy → backend :3001
                               └── PostgreSQL :5432
```

### Services (docker-compose.yml)

| Service  | Image / Build    | Port intern | Port extern | Daten-Volume        |
|----------|------------------|-------------|-------------|---------------------|
| db       | postgres:16-alpine | 5432      | —           | pgdata              |
| backend  | ./backend        | 3001        | —           | uploads, migrations |
| frontend | ./frontend       | 80          | 8090        | —                   |

---

## Verzeichnisstruktur

```
zeiterfassung/
├── docker-compose.yml
├── CLAUDE.md                        ← diese Datei
├── db/
│   └── init.sql                     ← nur bei leerem Volume, nicht für Migrationen
├── migrations/                      ← versionierte DB-Migrationen (auto-run on startup)
│   ├── 001_initial_schema.sql
│   ├── 002_add_attachments.sql
│   ├── 003_add_is_billable.sql
│   └── 004_add_external_refs.sql
├── backend/
│   ├── Dockerfile                   ← node:20-alpine
│   ├── package.json                 ← express, pg, bcryptjs, jsonwebtoken, multer
│   └── src/
│       ├── index.js                 ← Express-App, Startup, ensureAdminUser
│       ├── db.js                    ← pg Pool + TYPE PARSER (kritisch!)
│       ├── migrate.js               ← Migration-Runner
│       └── routes/
│           ├── auth.js              ← POST /login
│           ├── entries.js           ← CRUD Zeiteinträge
│           ├── masterdata.js        ← Kostenstellen / Kostenträger
│           ├── extrefs.js           ← Ext. Ref. 1 + 2 Stammdaten
│           ├── attachments.js       ← Datei-Upload + Serve
│           └── admin.js             ← Benutzerverwaltung (Admin)
├── frontend/
│   ├── Dockerfile                   ← node:20-alpine build → nginx:alpine serve
│   ├── nginx.conf                   ← SPA-Routing + /api proxy
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                  ← Router, Shared State (dateFrom/dateTo)
│       ├── api/
│       │   └── client.ts            ← axios instance + alle TypeScript-Typen
│       ├── components/
│       │   ├── Nav.tsx              ← Navigationsleiste
│       │   ├── CalendarView.tsx     ← FullCalendar Wochenansicht
│       │   ├── ListView.tsx         ← Tagesgruppierung + Excel-Export
│       │   ├── EntryModal.tsx       ← Erstellen/Bearbeiten + Anhänge
│       │   └── Combobox.tsx         ← Generische Dropdown+Freitext-Eingabe
│       └── pages/
│           ├── Login.tsx
│           ├── Dashboard.tsx        ← Tabs: Kalender | Liste | Entwicklung
│           ├── Entwicklung.tsx      ← Diagramme (Balken + Sankey)
│           └── Admin.tsx            ← Benutzer + Stammdaten-Verwaltung
└── scripts/
    ├── deploy.sh                    ← git pull + docker compose up -d --build
    └── bootstrap-existing-db.sh    ← einmalig für Server vor Migration-System
```

---

## Datenbank-Schema

### Tabelle `users`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
username      VARCHAR(100) UNIQUE NOT NULL
email         VARCHAR(255) UNIQUE NOT NULL
password_hash TEXT NOT NULL
is_admin      BOOLEAN DEFAULT FALSE
is_active     BOOLEAN DEFAULT TRUE
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### Tabelle `time_entries`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID REFERENCES users(id) ON DELETE CASCADE
entry_date    DATE NOT NULL                    -- kommt als "YYYY-MM-DD" String an (TYPE PARSER!)
start_time    TIME NOT NULL                    -- "HH:MM:SS"
end_time      TIME NOT NULL                    -- "HH:MM:SS"
short_text    VARCHAR(255) NOT NULL
long_text     TEXT
kostenstelle  VARCHAR(50)                      -- FK-Logik nur im App-Code (kein DB-Constraint)
kostentraeger VARCHAR(50)
is_travel     BOOLEAN DEFAULT FALSE
is_billable   BOOLEAN DEFAULT FALSE
external_ref1 VARCHAR(100)
external_ref2 VARCHAR(100)
created_at    TIMESTAMPTZ DEFAULT NOW()
updated_at    TIMESTAMPTZ DEFAULT NOW()
```

### Tabelle `master_data`
```sql
id        UUID PRIMARY KEY DEFAULT gen_random_uuid()
type      VARCHAR(50) NOT NULL      -- 'kostenstelle' | 'kostentraeger'
code      VARCHAR(50) NOT NULL
label     VARCHAR(255) NOT NULL
is_active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ DEFAULT NOW()
UNIQUE(type, code)
```

### Tabelle `attachments`
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
entry_id      UUID REFERENCES time_entries(id) ON DELETE CASCADE
user_id       UUID REFERENCES users(id)
original_name VARCHAR(255) NOT NULL
stored_name   VARCHAR(255) NOT NULL
mimetype      VARCHAR(100)
size          INTEGER
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### Tabellen `ext_ref1` und `ext_ref2` (gleiche Struktur)
```sql
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
referent     VARCHAR(100) NOT NULL
beschreibung VARCHAR(255)
is_active    BOOLEAN DEFAULT TRUE
created_at   TIMESTAMPTZ DEFAULT NOW()
```

### Tabelle `schema_migrations`
```sql
version    VARCHAR(255) PRIMARY KEY    -- Dateiname der Migration, z.B. "001_initial_schema.sql"
applied_at TIMESTAMPTZ DEFAULT NOW()
```

---

## Backend – API-Endpunkte

Alle Endpunkte außer `/api/auth/login` und `/api/attachments/file/:id` erfordern:
```
Authorization: Bearer <JWT-Token>
```
JWT-Payload: `{ id, username, is_admin }`, Gültigkeit 8 Stunden.

### Auth
```
POST /api/auth/login
  Body: { username, password }
  → { token, user: { id, username, email, is_admin } }
```

### Zeiteinträge (`requireAuth`, user-isoliert)
```
GET    /api/entries?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
POST   /api/entries
  Body: { entry_date, start_time, end_time, short_text, long_text?,
          kostenstelle?, kostentraeger?, is_travel?, is_billable?,
          external_ref1?, external_ref2? }
PUT    /api/entries/:id     (gleiche Body-Felder wie POST)
DELETE /api/entries/:id
```

### Stammdaten (`requireAuth` GET, `requireAdmin` POST/PUT/DELETE)
```
GET    /api/masterdata/:type        -- type = 'kostenstelle' | 'kostentraeger'
POST   /api/masterdata/:type        -- Body: { code, label }
PUT    /api/masterdata/:type/:id    -- Body: { code, label, is_active }
DELETE /api/masterdata/:type/:id
```

### Externe Referenzen (`requireAuth` GET, `requireAdmin` POST/PUT/DELETE)
```
GET    /api/extrefs/:type           -- type = 'ref1' | 'ref2'
POST   /api/extrefs/:type           -- Body: { referent, beschreibung? }
PUT    /api/extrefs/:type/:id       -- Body: { referent, beschreibung?, is_active? }
DELETE /api/extrefs/:type/:id
```

### Anhänge (`requireAuth`)
```
GET    /api/attachments/entry/:entryId
POST   /api/attachments/entry/:entryId   -- multipart/form-data, field: "file", max 20MB
GET    /api/attachments/file/:id         -- auch per ?token=<jwt> (für <img src>)
                                         -- ?download=1 → Content-Disposition: attachment
DELETE /api/attachments/:id
```

### Administration (`requireAdmin`)
```
GET    /api/admin/users
POST   /api/admin/users          -- Body: { username, email, password, is_admin? }
PUT    /api/admin/users/:id      -- Body: { username, email, password?, is_admin, is_active }
DELETE /api/admin/users/:id
```

---

## Frontend – Komponenten & Seiten

### `App.tsx`
- Hält den globalen Datumszustand (`dateFrom`, `dateTo`) — wird an Dashboard und Entwicklung weitergegeben
- Default: erster bis letzter Tag des aktuellen Monats (`toLocaleDateString('sv')` = YYYY-MM-DD)
- Routen: `/login`, `/` (Dashboard), `/admin`

### `pages/Dashboard.tsx`
Props: `{ dateFrom, dateTo, onDateFromChange, onDateToChange }`
- Drei Tabs: **Kalenderansicht** | **Listenansicht** | **Entwicklung**
- Lädt Einträge und alle Stammdaten (kostenstellen, kostentraeger, extRef1Items, extRef2Items)
- Hält EntryModal-State

### `pages/Entwicklung.tsx`
Props: `{ dateFrom, dateTo }`
- Lädt eigene Einträge + Stammdaten (unabhängig von Dashboard)
- Steuerelement: Diagrammtyp (Balken/Sankey), Aggregation (Tag/Woche/Monat/Quartal), Gruppierung (Kostenstelle/Kostenträger/Ext.Ref.1/Ext.Ref.2), Stunden-Labels ein/aus, PNG-Export
- Balkendiagramm: Recharts `BarChart` + `LabelList`
- Sankey: Recharts `Sankey` mit custom Node-Renderer (Funktion, nicht Element!) und farbigen Links
- Legende unterhalb des Sankey-Diagramms
- PNG-Export: `html-to-image` toPng, pixelRatio: 2

### `pages/Admin.tsx`
- Tabs: Benutzer | Stammdaten
- Stammdaten-Sub-Tabs: kostenstelle | kostentraeger | ref1 | ref2
- Ext. Refs haben Felder Referent + Beschreibung, Stammdaten Code + Bezeichnung

### `components/CalendarView.tsx`
- FullCalendar v6: timeGridWeek (default), dayGridMonth, timeGridDay
- Locale: de, firstDay: 1 (Montag)
- `selectable`, `editable` (drag & drop + resize)
- Event drop/resize → sofortiges `api.put`
- **Kritisch:** `entry_date.slice(0, 10)` immer verwenden (DB gibt reinen String, aber defensiv)

### `components/ListView.tsx`
Props: `{ entries, onEdit, dateFrom?, dateTo?, kostenstellen?, kostentraeger?, extRef1Items?, extRef2Items? }`
- Gruppierung nach Datum, sortiert absteigend
- Tagesheader mit Gesamt- und Verrechenbar-Stunden
- Excel-Export: SheetJS, getrennte Spalten für Code und Labeltext:
  - "Kostenstelle" + "Kostenstelle Text"
  - "Kostenträger" + "Kostenträger Text"
  - "Ext. Ref. 1" + "Ext. Ref. 1 Text"
  - "Ext. Ref. 2" + "Ext. Ref. 2 Text"

### `components/EntryModal.tsx`
- Erstellen und Bearbeiten von Zeiteinträgen
- Clipboard-Paste (Strg+V) für Screenshots → File `screenshot-<ISO>.png`
- Drag & Drop Zone für Dateianhänge
- Anhänge: Bildvorschau per `attachmentUrl()`, Download-Link
- Pending Files werden nach dem Speichern des Eintrags hochgeladen
- `empty()` nutzt `new Date().toLocaleDateString('sv')` für lokales YYYY-MM-DD

### `components/Combobox.tsx`
Generische Komponente für Dropdown + Freitext-Eingabe.
```typescript
interface ComboOption { id: string; value: string; primary: string; secondary?: string; }
// Helper-Funktionen:
masterDataToOptions(items: MasterDataItem[]): ComboOption[]
extRefToOptions(items: ExtRefItem[]): ComboOption[]
```

### `api/client.ts` – TypeScript-Typen
```typescript
type TimeEntry = {
  id, user_id, entry_date, start_time, end_time,
  short_text, long_text: string | null,
  kostenstelle: string | null, kostentraeger: string | null,
  is_travel: boolean, is_billable: boolean,
  external_ref1: string | null, external_ref2: string | null,
  created_at, updated_at
}
type MasterDataItem = { id, type: 'kostenstelle'|'kostentraeger', code, label, is_active }
type ExtRefItem     = { id, referent, beschreibung: string | null, is_active, created_at }
type Attachment     = { id, entry_id, original_name, stored_name, mimetype, size, created_at }
type User           = { id, username, email, is_admin, is_active, created_at }

// Helper:
attachmentUrl(att: Attachment, download?: boolean): string
// → /api/attachments/file/:id?token=<jwt>[&download=1]
```

---

## Kritische technische Entscheidungen / Gotchas

### 1. PostgreSQL DATE-Typ-Parser (UNBEDINGT beachten!)
```javascript
// backend/src/db.js
types.setTypeParser(1082, (val) => val);  // DATE → "YYYY-MM-DD" String, nicht JS Date
types.setTypeParser(1083, (val) => val);  // TIME → "HH:MM:SS" String
```
**Ohne diesen Patch** gibt pg DATE-Felder als JS Date-Objekte zurück (`"2026-05-27T00:00:00.000Z"`), was FullCalendar-Events unsichtbar macht (ungültiger ISO-String).

### 2. Datum-Handling im Frontend
- Immer `entry_date.slice(0, 10)` verwenden (defensive Normalisierung)
- Zeitzone-sichere Erzeugung: `new Date().toLocaleDateString('sv')` = `"YYYY-MM-DD"` in Lokalzeit

### 3. Recharts Sankey – `node` als Funktion, nicht Element
```tsx
// RICHTIG:
node={(props: any) => <SankeyNode {...props} periodsCount={periodsCount} />}
// FALSCH (unzuverlässig in Recharts v2):
node={<SankeyNode periodsCount={periodsCount} />}
```

### 4. Anhänge: Token per Query-Param
`GET /api/attachments/file/:id?token=<jwt>` erlaubt `<img src="...">` ohne Custom-Header.

### 5. Migrations-System
- `backend/src/migrate.js` liest alle `.sql`-Dateien aus `MIGRATIONS_DIR` alphabetisch
- Jede Migration läuft in einer Transaktion
- Bereits angewandte Versionen stehen in `schema_migrations`
- **Neue Migration:** neue Datei `005_beschreibung.sql` in `migrations/` anlegen, beim nächsten Backend-Start automatisch angewandt

---

## Frontend-Bibliotheken

| Paket | Version | Zweck |
|---|---|---|
| react + react-dom | ^18.2 | UI-Framework |
| react-router-dom | ^6.22 | Routing |
| axios | ^1.6 | HTTP-Client |
| @fullcalendar/* | ^6.1.11 | Kalenderansicht |
| xlsx | ^0.18.5 | Excel-Export (SheetJS) |
| recharts | ^2.12.7 | Balken- & Sankey-Diagramm |
| html-to-image | ^1.11.11 | PNG-Export der Diagramme |
| vite | ^5.1 | Build-Tool |
| typescript | ^5.3 | Typprüfung |

## Backend-Bibliotheken

| Paket | Zweck |
|---|---|
| express | HTTP-Framework |
| pg | PostgreSQL-Client |
| bcryptjs | Passwort-Hashing |
| jsonwebtoken | JWT (8h Gültigkeit) |
| multer | Datei-Upload (max 20 MB) |
| cors | CORS-Middleware |

---

## Deployment

### Normaler Update-Workflow
```bash
# Auf dem Server:
./scripts/deploy.sh             # backend + frontend
./scripts/deploy.sh frontend    # nur frontend
```
Entspricht: `git pull origin main && docker compose up -d --build <services>`

**Wichtig:** `docker compose up -d` ohne `--build` baut KEINE neuen Images!

### Neue Migration deployen
1. SQL-Datei in `migrations/` anlegen (Namensschema: `005_feature.sql`)
2. `./scripts/deploy.sh backend` ausführen
3. Migration wird beim Backend-Start automatisch angewandt

### Ersteinrichtung auf neuem Server (leere DB)
```bash
docker compose up -d
# init.sql wird von PostgreSQL automatisch ausgeführt (leeres Volume)
# Migrationen werden vom Backend beim Start ausgeführt
# Admin-User admin/admin123 wird angelegt
```

### Bestehender Server vor dem Migrations-System
```bash
./scripts/bootstrap-existing-db.sh [container-name]
# Markiert 001-003 als bereits angewandt
docker compose up -d backend
```

---

## Entwicklungsstand & offene Themen

### Implementiert ✓
- Zeiteinträge (CRUD) mit allen Feldern
- Kalenderansicht (FullCalendar, Drag & Drop, Resize)
- Listenansicht (Tagesgruppierung, Stundensummen gesamt + verrechenbar)
- Excel-Export (Code + Labeltext getrennte Spalten)
- Dateianhänge (Upload, Clipboard-Paste, Vorschau, Download)
- Benutzerverwaltung (Multi-User, Admin-Panel)
- Stammdaten (Kostenstellen, Kostenträger, Ext. Ref. 1+2)
- Diagrammseite "Entwicklung" (Balken + Sankey, Aggregation, Gruppierung, Labels, PNG-Export)
- Versioniertes Migrations-System

### Nicht implementiert (mögliche nächste Features)
- Start/Stop-Timer (Live-Zeiterfassung)
- Soll-Stunden / Arbeitszeitkonto / Überstunden
- Urlaubs- und Abwesenheitsverwaltung
- Genehmigungsworkflow für Einträge
- PDF-Berichte
- Mobile-optimiertes UI / PWA
- DATEV / Lexoffice Export
- Self-Service Registrierung + Team-Einladung
- 2-Faktor-Authentifizierung
- Browser-Terminal (Stempeln per Tablet)
- Projektverwaltung mit Budget-Tracking
- Mandantenfähigkeit (aktuell: eine Firma pro Deployment)
- Tenant-Konfiguration / Feature-Flags
- Custom Fields

---

## Umgebungsvariablen

| Variable | Default | Beschreibung |
|---|---|---|
| `JWT_SECRET` | `change-me-in-production` | **In Produktion ändern!** |
| `DB_HOST` | `localhost` | PostgreSQL-Host |
| `DB_PORT` | `5432` | PostgreSQL-Port |
| `DB_NAME` | `zeiterfassung` | Datenbankname |
| `DB_USER` | `zeit` | DB-Benutzer |
| `DB_PASSWORD` | `zeit` | DB-Passwort |
| `PORT` | `3001` | Backend-Port |
| `UPLOAD_DIR` | `/uploads` | Dateipfad für Anhänge |
| `MIGRATIONS_DIR` | `/migrations` | Pfad zu den SQL-Migrations |
