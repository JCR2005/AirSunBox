-- ═══════════════════════════════════════════════════════════════
-- SANIK — MIGRACIÓN UNIFICADA (v3 + v4 + v5)
-- Un solo archivo idempotente que deja el esquema completo para
-- ESPACIOS + TIPOS DE ORGANIZACIÓN sobre cualquier BD en estado v2.
--
--   v3 → organizations.type (A/B) + is_self_service + tablas de espacios
--   v4 → category, b_category, payment_exempt
--   v5 → account_type
--
-- Puede ejecutarse varias veces sin romper nada (ADD COLUMN IF NOT
-- EXISTS / CREATE TABLE IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────
-- [v3] 1. ORGANIZACIONES: marcar el tipo
-- ─────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'A',           -- 'A' (Sanik) | 'B' (self-service)
  ADD COLUMN IF NOT EXISTS is_self_service BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────
-- [v3] 2. TABLA DE ESPACIOS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'aire',
  hidden      BOOLEAN DEFAULT FALSE,
  description TEXT,
  icon        TEXT DEFAULT 'map-pin',
  color       TEXT DEFAULT '#67B7E8',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

-- ─────────────────────────────────────────
-- [v3] 3. DISPOSITIVOS: mover de org_id a space_id
-- ─────────────────────────────────────────
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_devices_space ON devices(space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_org ON spaces(org_id);

-- ─────────────────────────────────────────
-- [v3] 4. ESQUEMA DEL AQI CONFIGURABLE POR ESPACIO
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

CREATE TABLE IF NOT EXISTS space_aqi_variables (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  variable_label TEXT NOT NULL REFERENCES variable_catalog(label) ON DELETE CASCADE,
  priority       INT NOT NULL DEFAULT 0,
  UNIQUE (space_id, variable_label)
);

CREATE TABLE IF NOT EXISTS space_variable_ranges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  variable_label TEXT NOT NULL REFERENCES variable_catalog(label) ON DELETE CASCADE,
  cat_order      INT NOT NULL DEFAULT 0,
  min_value      FLOAT NOT NULL DEFAULT 0,
  max_value      FLOAT,
  UNIQUE (space_id, variable_label, cat_order)
);

CREATE INDEX IF NOT EXISTS idx_sac_space ON space_aqi_categories(space_id);
CREATE INDEX IF NOT EXISTS idx_sav_space ON space_aqi_variables(space_id);
CREATE INDEX IF NOT EXISTS idx_svr_space ON space_variable_ranges(space_id);

-- ─────────────────────────────────────────
-- [v3] 5. Espacio "Aire" base por organización + plantilla AQI
-- ─────────────────────────────────────────
INSERT INTO spaces (org_id, name, slug, type, hidden)
SELECT
  o.id,
  'Aire',
  'aire',
  'aire',
  (o.type = 'A')
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM spaces s WHERE s.org_id = o.id AND s.slug = 'aire'
);

UPDATE devices d
SET space_id = s.id
FROM spaces s
WHERE s.org_id = d.org_id
  AND s.slug = 'aire'
  AND d.space_id IS NULL;

DO $$
DECLARE
  sp RECORD;
  cats JSONB := '[
    {"name":"Excelente","color":"#10B981","order":1,"lo":0,"hi":20},
    {"name":"Buena","color":"#34D399","order":2,"lo":21,"hi":40},
    {"name":"Precaución","color":"#F59E0B","order":3,"lo":41,"hi":60},
    {"name":"Mala","color":"#F97316","order":4,"lo":61,"hi":80},
    {"name":"Peligrosa","color":"#EF4444","order":5,"lo":81,"hi":100}
  ]'::jsonb;
  cat RECORD;
BEGIN
  FOR sp IN SELECT s.id FROM spaces s WHERE s.slug = 'aire' LOOP
    IF NOT EXISTS (SELECT 1 FROM space_aqi_categories WHERE space_id = sp.id) THEN
      FOR cat IN SELECT * FROM jsonb_array_elements(cats) WITH ORDINALITY AS t(j, ord)
                 CROSS JOIN LATERAL jsonb_to_record(t.j) AS c(name text, color text, "order" int, lo int, hi int)
                 ORDER BY ord
      LOOP
        INSERT INTO space_aqi_categories (space_id, name, color, cat_order, score_lo, score_hi)
        VALUES (sp.id, cat.name, cat.color, cat."order", cat.lo, cat.hi);
      END LOOP;

      INSERT INTO space_aqi_variables (space_id, variable_label, priority)
      SELECT sp.id, variable_label, ROW_NUMBER() OVER (ORDER BY weight DESC, variable_label)
      FROM (
        SELECT DISTINCT variable_label, MAX(weight) AS weight
        FROM air_quality_ranges
        WHERE variable_label IN ('pm25','pm10','co2','co','no2','nox','nh3','o3','so2')
        GROUP BY variable_label
      ) t
      ON CONFLICT (space_id, variable_label) DO NOTHING;

      INSERT INTO space_variable_ranges (space_id, variable_label, cat_order, min_value, max_value)
      SELECT
        sp.id,
        r.variable_label,
        CASE r.score WHEN 0 THEN 1 WHEN 25 THEN 2 WHEN 50 THEN 3 WHEN 75 THEN 4 ELSE 5 END,
        r.min_value,
        r.max_value
      FROM air_quality_ranges r
      WHERE r.variable_label IN ('pm25','pm10','co2','co','no2','nox','nh3','o3','so2')
      ON CONFLICT (space_id, variable_label, cat_order) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────────────────────
-- [v4] CATEGORÍAS / EXONERACIÓN DE ORGANIZACIONES
-- ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='category') THEN
    ALTER TABLE organizations ADD COLUMN category text NOT NULL DEFAULT 'dependiente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='b_category') THEN
    ALTER TABLE organizations ADD COLUMN b_category text NOT NULL DEFAULT 'estandar';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='payment_exempt') THEN
    ALTER TABLE organizations ADD COLUMN payment_exempt boolean NOT NULL DEFAULT false;
  END IF;
END $$;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_category_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_category_check CHECK (category IN ('dependiente','independiente'));

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_b_category_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_b_category_check CHECK (b_category IN ('estandar','especial'));

UPDATE organizations SET category = 'independiente' WHERE is_self_service = TRUE OR type = 'B';
UPDATE organizations SET category = 'dependiente'   WHERE type = 'A';
UPDATE organizations SET b_category = 'estandar'    WHERE b_category IS NULL;

-- ─────────────────────────────────────────
-- [v5] TIPO DE CUENTA (individual | organizacion)
-- ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='account_type') THEN
    ALTER TABLE organizations ADD COLUMN account_type text NOT NULL DEFAULT 'organizacion';
  END IF;
END $$;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_account_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_account_type_check CHECK (account_type IN ('individual','organizacion'));