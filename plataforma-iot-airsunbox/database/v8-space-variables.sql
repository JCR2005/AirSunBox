-- ═══════════════════════════════════════════
-- VARIABLES LOCALES POR ESPACIO (AQI)
-- Añade alcance por espacio al catálogo de variables:
--   - space_id NULL   → variable GLOBAL del sistema (todas las orgs)
--   - space_id set    → variable PRIVADA de un espacio (aislada allí)
-- Todo sigue viviendo en variable_catalog para NO romper los FK de
-- space_aqi_variables / space_variable_ranges / device_variables.
--
-- Las variables del espacio se borran solas al borrar el espacio
-- (ON DELETE CASCADE desde spaces → variable_catalog.space_id).
-- ═══════════════════════════════════════════

ALTER TABLE variable_catalog
  ADD COLUMN IF NOT EXISTS space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_vc_space ON variable_catalog(space_id);
