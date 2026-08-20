-- ═══════════════════════════════════════════
-- SANIK — Migración v2
-- Nuevas tablas y campos
-- ═══════════════════════════════════════════

-- ─────────────────────────────────────────
-- Actualizar roles disponibles
-- superadmin = admin central (jefe)
-- admin = administrador normal
-- worker = trabajador
-- client = cliente
-- ─────────────────────────────────────────
ALTER TABLE users 
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS temp_password TEXT;

-- ─────────────────────────────────────────
-- Actualizar organizaciones
-- ─────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS nit TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- ─────────────────────────────────────────
-- Actualizar dispositivos
-- serial = número de serie único SNK-XXX
-- status = pending | active | inactive | review
-- image_url = imagen de la estación
-- description = descripción de la estación
-- icon = icono de la estación
-- tags = etiquetas de la estación
-- ─────────────────────────────────────────
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS serial TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'map-pin',
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';

-- Generar seriales para dispositivos existentes
UPDATE devices 
SET serial = 'SNK-' || LPAD(FLOOR(RANDOM() * 900 + 100)::TEXT, 3, '0')
WHERE serial IS NULL;

-- ─────────────────────────────────────────
-- TABLA DE PAGOS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  amount        FLOAT NOT NULL,
  status        TEXT DEFAULT 'pending',  -- pending | paid
  paid_at       TIMESTAMPTZ,
  due_date      TIMESTAMPTZ NOT NULL,
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA DE SOLICITUDES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  device_name   TEXT NOT NULL,
  location      TEXT,
  quantity      INT DEFAULT 1,
  note          TEXT,
  payment_photo TEXT,            -- URL de foto de pago
  status        TEXT DEFAULT 'pending', -- pending | in_review | approved | rejected
  reviewed_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA DE INCIDENCIAS / REPORTES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID REFERENCES devices(id) ON DELETE CASCADE,
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  status        TEXT DEFAULT 'open',    -- open | in_review | resolved
  resolved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- TABLA DE VARIABLES GLOBALES
-- (el catálogo de variables disponibles)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS variable_catalog (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,        -- "Temperatura"
  label       TEXT UNIQUE NOT NULL, -- "temperatura"
  unit        TEXT,                 -- "°C"
  icon        TEXT DEFAULT 'Activity',
  description TEXT,
  data_type   TEXT DEFAULT 'number',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE variable_catalog
  ADD COLUMN IF NOT EXISTS data_type TEXT DEFAULT 'number';

-- ─────────────────────────────────────────
-- TABLA DE RELACIÓN DISPOSITIVO-VARIABLE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_variables (
  device_id      UUID REFERENCES devices(id) ON DELETE CASCADE,
  variable_label TEXT REFERENCES variable_catalog(label) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, variable_label)
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
-- SUPERADMIN POR DEFECTO
-- Cambiar contraseña después del primer login
-- Email: superadmin@sanik.io
-- Pass: Sanik2026!
-- ─────────────────────────────────────────
INSERT INTO organizations (name, slug, plan)
VALUES ('Sanik', 'sanik-internal', 'enterprise')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (org_id, email, password_hash, role, name)
SELECT 
  o.id,
  'superadmin@sanik.io',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHwf8x8ou', -- Sanik2026!
  'superadmin',
  'Super Admin'
FROM organizations o
WHERE o.slug = 'sanik-internal'
ON CONFLICT (email) DO NOTHING;
