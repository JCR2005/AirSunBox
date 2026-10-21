-- ═══════════════════════════════════════════
-- MIGRACIÓN v20: alinear una base nueva con producción
-- ═══════════════════════════════════════════
-- Idempotente. Recoge cambios que se aplicaron a mano en la base de
-- producción y no estaban en ningún archivo, para que una instalación desde
-- cero (database/initdb/00-schema.sh) quede igual. Sobre producción no cambia
-- nada.

-- Organizaciones: valores por defecto y obligatorios
UPDATE organizations SET type = 'A' WHERE type IS NULL;
UPDATE organizations SET category = 'dependiente' WHERE category IS NULL;
UPDATE organizations SET b_category = 'estandar' WHERE b_category IS NULL;
UPDATE organizations SET account_type = 'organizacion' WHERE account_type IS NULL;
UPDATE organizations SET payment_exempt = FALSE WHERE payment_exempt IS NULL;

ALTER TABLE organizations
  ALTER COLUMN type SET DEFAULT 'A',
  ALTER COLUMN category SET DEFAULT 'dependiente',
  ALTER COLUMN category SET NOT NULL,
  ALTER COLUMN b_category SET DEFAULT 'estandar',
  ALTER COLUMN b_category SET NOT NULL,
  ALTER COLUMN account_type SET DEFAULT 'organizacion',
  ALTER COLUMN account_type SET NOT NULL,
  ALTER COLUMN payment_exempt SET NOT NULL;

-- Espacios: color e ícono por defecto
ALTER TABLE spaces
  ALTER COLUMN color SET DEFAULT '#67B7E8',
  ALTER COLUMN icon SET DEFAULT 'map-pin';

-- Catálogo global: CO y CO₂ (tienen rangos en air_quality_ranges)
INSERT INTO variable_catalog (name, label, unit, icon, description)
SELECT v.* FROM (VALUES
  ('CO',  'co',  'ppm', 'Cloud', 'Sensor MQ-7'),
  ('CO₂', 'co2', 'ppm', 'Cloud', 'Sensor MQ-135')
) AS v(name, label, unit, icon, description)
WHERE NOT EXISTS (SELECT 1 FROM variable_catalog c WHERE c.label = v.label);

-- Configuración por espacio ligada al catálogo (borrar una variable del
-- catálogo borra su configuración en cada espacio)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_aqi_variables_variable_label_fkey') THEN
    ALTER TABLE space_aqi_variables
      ADD CONSTRAINT space_aqi_variables_variable_label_fkey
      FOREIGN KEY (variable_label) REFERENCES variable_catalog(label) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_variable_ranges_variable_label_fkey') THEN
    ALTER TABLE space_variable_ranges
      ADD CONSTRAINT space_variable_ranges_variable_label_fkey
      FOREIGN KEY (variable_label) REFERENCES variable_catalog(label) ON DELETE CASCADE;
  END IF;
END $$;

-- Tabla del modelo viejo, reemplazada por variable_catalog + device_variables
DROP TABLE IF EXISTS variables;
