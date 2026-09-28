-- ═══════════════════════════════════════════
-- PLATAFORMA IOT — Esquema base de datos
-- TimescaleDB + PostgreSQL
-- ═══════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────
-- ORGANIZACIONES (tus clientes / municipalidades)
-- ─────────────────────────────────────────
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  plan            TEXT DEFAULT 'free',
  phone           TEXT,
  location        TEXT,
  status          TEXT DEFAULT 'active',
  paid_until      TIMESTAMPTZ,
  notes           TEXT,
  nit             TEXT,
  contact_name    TEXT,
  type            TEXT,
  category        TEXT,
  b_category      TEXT,
  payment_exempt  BOOLEAN DEFAULT FALSE,
  account_type    TEXT,
  is_self_service BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USUARIOS
-- ─────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'client',  -- superadmin | admin | worker | client
  name            TEXT,
  phone           TEXT,
  status          TEXT DEFAULT 'active',
  temp_password   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DISPOSITIVOS (las estaciones ESP32)
-- ─────────────────────────────────────────
CREATE TABLE devices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,             -- ej: "estacion-meteorologica"
  name        TEXT NOT NULL,             -- ej: "Estación Centro Xela"
  token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  lat         FLOAT,
  lng         FLOAT,
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, label)
);

-- ─────────────────────────────────────────
-- VARIABLES (SO₂, temperatura, PM2.5...)
-- ─────────────────────────────────────────
CREATE TABLE variables (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID REFERENCES devices(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,             -- ej: "temperatura"
  name        TEXT NOT NULL,             -- ej: "Temperatura"
  unit        TEXT,                      -- ej: "°C", "µg/m³"
  last_value  FLOAT,
  last_time   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, label)
);

-- ─────────────────────────────────────────
-- DOTS — Los datos de los sensores
-- Esta es la tabla principal, manejada por TimescaleDB
-- ─────────────────────────────────────────
CREATE TABLE dots (
  time        TIMESTAMPTZ NOT NULL,
  device_id   UUID NOT NULL,
  variable    TEXT NOT NULL,
  value       FLOAT NOT NULL,
  context     JSONB                       -- lat/lng u otros metadatos opcionales
);

-- Convertir dots en hypertable (el superpoder de TimescaleDB)
SELECT create_hypertable('dots', 'time');

-- Índices para consultas rápidas
CREATE INDEX ON dots (device_id, variable, time DESC);

-- ─────────────────────────────────────────
-- ALERTAS (configuración de umbrales)
-- ─────────────────────────────────────────
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID REFERENCES devices(id) ON DELETE CASCADE,
  variable      TEXT NOT NULL,
  condition     TEXT NOT NULL,           -- ">" | "<" | "=" 
  threshold     FLOAT NOT NULL,          -- ej: 50 (para PM2.5 > 50)
  channel       TEXT NOT NULL,           -- "email" | "webhook"
  destination   TEXT NOT NULL,           -- email o URL
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ESPACIOS (spaces) - para orgs tipo B (self-service)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'aire',
  hidden      BOOLEAN DEFAULT FALSE,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  accent_color TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_spaces_org ON spaces(org_id);

-- ─────────────────────────────────────────
-- SPACE AQI CATEGORIES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS space_aqi_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT DEFAULT '#10B981',
  cat_order  INT NOT NULL DEFAULT 0,
  score_lo   INT NOT NULL DEFAULT 0,
  score_hi   INT NOT NULL DEFAULT 100,
  UNIQUE (space_id, cat_order)
);

-- ─────────────────────────────────────────
-- SPACE AQI VARIABLES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS space_aqi_variables (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  variable_label TEXT NOT NULL,
  priority       INT NOT NULL DEFAULT 0,
  UNIQUE (space_id, variable_label)
);

-- ─────────────────────────────────────────
-- SPACE VARIABLE RANGES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS space_variable_ranges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  variable_label TEXT NOT NULL,
  cat_order      INT NOT NULL DEFAULT 0,
  min_value      FLOAT NOT NULL DEFAULT 0,
  max_value      FLOAT,
  UNIQUE (space_id, variable_label, cat_order)
);

CREATE INDEX IF NOT EXISTS idx_sac_space ON space_aqi_categories(space_id);
CREATE INDEX IF NOT EXISTS idx_sav_space ON space_aqi_variables(space_id);
CREATE INDEX IF NOT EXISTS idx_svr_space ON space_variable_ranges(space_id);

-- ─────────────────────────────────────────
-- DISPOSITIVOS: agregar space_id
-- ─────────────────────────────────────────
ALTER TABLE devices ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_devices_space ON devices(space_id);

-- ─────────────────────────────────────────
-- VARIABLE CATALOG (must be before device_variables)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS variable_catalog (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  label       TEXT UNIQUE NOT NULL,
  unit        TEXT,
  icon        TEXT DEFAULT 'Activity',
  description TEXT,
  data_type   TEXT DEFAULT 'number',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Variables por defecto
INSERT INTO variable_catalog (name, label, unit, icon, description, data_type) VALUES
  ('Temperatura',  'temperatura',  '°C',     'Thermometer', 'Temperatura ambiental del aire', 'number'),
  ('Humedad',      'humedad',      '%',      'Droplets',    'Humedad relativa del aire',      'number'),
  ('SO₂',          'so2',          'ppb',    'Cloud',       'Dióxido de azufre',              'number'),
  ('PM2.5',        'pm25',         'µg/m³',  'Wind',        'Material particulado 2.5 micras', 'number'),
  ('PM1',          'pm1',          'µg/m³',  'Wind',        'Material particulado 1 micra',   'number'),
  ('PM10',         'pm10',         'µg/m³',  'Wind',        'Material particulado 10 micras', 'number'),
  ('O₃',           'o3',           'ppb',    'Sun',         'Ozono troposférico',             'number'),
  ('NOx',          'nox',          'ppb',    'Flame',       'Óxidos de nitrógeno',           'number'),
  ('NH₃',          'nh3',          'ppb',    'Activity',    'Amoniaco',                       'number'),
  ('MQ135 ADC',    'mq135_adc',    'ADC',    'Activity',    'Lectura analógica sensor MQ135', 'number')
ON CONFLICT (label) DO NOTHING;

-- ─────────────────────────────────────────
-- TABLA DE RELACIÓN DISPOSITIVO-VARIABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_variables (
  device_id      UUID REFERENCES devices(id) ON DELETE CASCADE,
  variable_label TEXT REFERENCES variable_catalog(label) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, variable_label)
);

-- ─────────────────────────────────────────
-- ORGANIZACIÓN DE EJEMPLO para desarrollo
-- ─────────────────────────────────────────
INSERT INTO organizations (name, slug, plan)
VALUES ('Mi Organización', 'mi-organizacion', 'pro');

-- ─────────────────────────────────────────
-- SUPERADMIN POR DEFECTO
-- Email: superadmin@sanik.io
-- Pass: Sanik2026!
-- ─────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan, phone, location, status, contact_name, nit, account_type)
VALUES ('f51dec7f-fb2c-460a-9a9d-b4edc510fe38', 'Sanik', 'sanik-internal', 'enterprise', NULL, NULL, 'active', NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (org_id, email, password_hash, role, name, status, temp_password)
SELECT 
  o.id,
  'superadmin@sanik.io',
  '$2b$10$9KSrWSrJpq2Mz6gw5fAOJOq.0uFeJYWT7adPq5c9Xp3XKUUwZzcQC', -- Sanik2026!
  'superadmin',
  'Super Admin',
  'active',
  NULL
FROM organizations o
WHERE o.slug = 'sanik-internal'
ON CONFLICT (email) DO NOTHING;

-- ─────────────────────────────────────────
-- USUARIO: charlyrodrilop@gmail.com (password: 123456)
-- ─────────────────────────────────────────
INSERT INTO organizations (id, name, slug, plan, phone, location, status, contact_name, nit, account_type, type, category, created_at)
VALUES ('2c0202a4-6cba-476f-b984-2656e48cc4d0', 'Centro Universitario de Occidente (CUNOC)', 'centro-universitario-de-occidente-cunoc', 'pro', '7827-1827', 'Quetzaltenango, Quetzaltenango.', 'active', 'Carlos Rodriguez', '1234567-8', 'Convenio', NULL, NULL, '2026-05-30 16:18:20.104852+00')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, org_id, email, password_hash, role, name, status, temp_password, created_at)
VALUES ('5c354ca3-c0ba-40da-9aee-cf6b2b23b54b', '2c0202a4-6cba-476f-b984-2656e48cc4d0', 'charlyrodrilop@gmail.com', '$2b$10$K2wa8wr0xPEJ1tkm8H1IkOvz7o54kN8X0QUP5PMAIrZ5ESQzIVQ2m', 'client', NULL, 'active', NULL, '2026-05-30 16:18:20.104852+00')
ON CONFLICT (email) DO NOTHING;
