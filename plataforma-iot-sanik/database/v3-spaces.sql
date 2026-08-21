-- ═══════════════════════════════════════════
-- SANIK — Migración v3: ESPACIOS (spaces)
-- Dos modelos de organización:
--   Tipo A: gestionada por Sanik (frontend igual que hoy, espacio oculto)
--   Tipo B: autogestionada (self-service), el cliente crea sus espacios
--           con sus variables, rangos y su propio AQI
-- ═══════════════════════════════════════════

-- ─────────────────────────────────────────
-- 1. ORGANIZACIONES: marcar el tipo
-- ─────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'A',           -- 'A' (Sanik) | 'B' (self-service)
  ADD COLUMN IF NOT EXISTS is_self_service BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────
-- 2. TABLA DE ESPACIOS
--    El "espacio" es el nivel donde el cliente define su dominio:
--    aire, agua, suelo, ruido, etc.
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- "Aire", "Calidad de agua"...
  slug        TEXT NOT NULL,                 -- "aire", "agua"
  type        TEXT NOT NULL DEFAULT 'aire',  -- aire | agua | suelo | ruido | other
  hidden      BOOLEAN DEFAULT FALSE,         -- true para el espacio interno de orgs tipo A
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, slug)
);

-- ─────────────────────────────────────────
-- 3. DISPOSITIVOS: mover de org_id a space_id
--    Se conserva org_id temporalmente (no se borra) para compatibilidad.
-- ─────────────────────────────────────────
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

-- Crear el espacio "Aire" oculto por cada organización
-- (tanto tipo A como B parten con un espacio de aire base)
INSERT INTO spaces (org_id, name, slug, type, hidden)
SELECT
  o.id,
  'Aire',
  'aire',
  'aire',
  (o.type = 'A')  -- oculto solo para orgs tipo A
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM spaces s WHERE s.org_id = o.id AND s.slug = 'aire'
);

-- Asignar los dispositivos existentes al espacio "Aire" de su organización
UPDATE devices d
SET space_id = s.id
FROM spaces s
WHERE s.org_id = d.org_id
  AND s.slug = 'aire'
  AND d.space_id IS NULL;

-- Índice para acelerar las consultas por espacio
CREATE INDEX IF NOT EXISTS idx_devices_space ON devices(space_id);
CREATE INDEX IF NOT EXISTS idx_spaces_org ON spaces(org_id);

-- ═══════════════════════════════════════════
-- 4. ESQUEMA DEL AQI CONFIGURABLE POR ESPACIO
-- El cliente define:
--   - Cuántas categorías (Bien, Precaución, Mal...) y sus colores
--   - Qué variables participan y su orden (prioridad)
--   - Los límites numéricos de cada variable para cada categoría
-- ═══════════════════════════════════════════

-- 4.1 Categorías del AQI por espacio
--     score_lo/score_hi = el tramo del índice (0-100) que ocupa cada categoría
--     Ej. 3 categorías: Bien 0-33, Precaución 34-66, Mal 67-100
CREATE TABLE IF NOT EXISTS space_aqi_categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,               -- "Bien", "Precaución", "Mal"...
  color      TEXT DEFAULT '#10B981',      -- color para el frontend
  cat_order  INT NOT NULL DEFAULT 0,      -- orden (1 = mejor calidad)
  score_lo   INT NOT NULL DEFAULT 0,      -- tramo del índice
  score_hi   INT NOT NULL DEFAULT 100,
  UNIQUE (space_id, cat_order)
);

-- 4.2 Variables que participan en el AQI del espacio, en orden de prioridad
CREATE TABLE IF NOT EXISTS space_aqi_variables (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  variable_label TEXT NOT NULL REFERENCES variable_catalog(label) ON DELETE CASCADE,
  priority       INT NOT NULL DEFAULT 0,  -- 1 = mayor peso
  UNIQUE (space_id, variable_label)
);

-- 4.3 Rangos de cada variable dentro de cada categoría del AQI
--     min_value/max_value = límites numéricos que el cliente define.
CREATE TABLE IF NOT EXISTS space_variable_ranges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id       UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  variable_label TEXT NOT NULL REFERENCES variable_catalog(label) ON DELETE CASCADE,
  cat_order      INT NOT NULL DEFAULT 0,     -- referencia a space_aqi_categories
  min_value      FLOAT NOT NULL DEFAULT 0,
  max_value      FLOAT,                      -- NULL = sin límite superior
  UNIQUE (space_id, variable_label, cat_order)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sac_space ON space_aqi_categories(space_id);
CREATE INDEX IF NOT EXISTS idx_sav_space ON space_aqi_variables(space_id);
CREATE INDEX IF NOT EXISTS idx_svr_space ON space_variable_ranges(space_id);

-- ═══════════════════════════════════════════
-- 5. PLANTILLA "AIRE" POR ESPACIO
-- Replica la configuración actual de air_quality_ranges (vía real de la DB)
-- con 5 categorías (Exc./Buena/Prec./Mala/Peligrosa) y sus prioridades,
-- para que los espacios de aire ya tengan config sin que el cliente haga nada.
-- ═══════════════════════════════════════════

-- 5.1 Categorías estándar de aire (scores 0/25/50/75/100)
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
    -- categorías (si aún no existen para ese espacio)
    IF NOT EXISTS (SELECT 1 FROM space_aqi_categories WHERE space_id = sp.id) THEN
      FOR cat IN SELECT * FROM jsonb_array_elements(cats) WITH ORDINALITY AS t(j, ord)
                 CROSS JOIN LATERAL jsonb_to_record(t.j) AS c(name text, color text, "order" int, lo int, hi int)
                 ORDER BY ord
      LOOP
        INSERT INTO space_aqi_categories (space_id, name, color, cat_order, score_lo, score_hi)
        VALUES (sp.id, cat.name, cat.color, cat."order", cat.lo, cat.hi);
      END LOOP;

      -- variables que participan (en orden de prioridad, según peso actual)
      INSERT INTO space_aqi_variables (space_id, variable_label, priority)
      SELECT sp.id, variable_label, ROW_NUMBER() OVER (ORDER BY weight DESC, variable_label)
      FROM (
        SELECT DISTINCT variable_label, MAX(weight) AS weight
        FROM air_quality_ranges
        WHERE variable_label IN ('pm25','pm10','co2','co','no2','nox','nh3','o3','so2')
        GROUP BY variable_label
      ) t
      ON CONFLICT (space_id, variable_label) DO NOTHING;

      -- rangos por variable (copiados de la config real de aire)
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
