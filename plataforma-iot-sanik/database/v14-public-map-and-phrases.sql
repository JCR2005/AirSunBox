-- ═══════════════════════════════════════════
-- SANIK — Migración v14
--   1. Mapa público opcional para estaciones de espacios (orgs tipo B)
--   2. Frases configurables por categoría del AQI del espacio
-- ═══════════════════════════════════════════

-- 1. Las estaciones creadas en espacios NO salen en el mapa público
--    salvo que el usuario lo active explícitamente (solo espacios de aire).
ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS public_map BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Frases (una o varias) por categoría del AQI del espacio.
ALTER TABLE space_aqi_categories
  ADD COLUMN IF NOT EXISTS phrases TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: asignar la frase por defecto (coherente con HEALTH_MESSAGES
-- del frontend clásico) a las categorías que aún no tengan frases.
UPDATE space_aqi_categories
SET phrases = ARRAY[
  CASE cat_order
    WHEN 1 THEN 'El aire es ideal. No hay impacto en la salud respiratoria.'
    WHEN 2 THEN 'Calidad aceptable. Riesgo mínimo para grupos vulnerables.'
    WHEN 3 THEN 'Personas con asma deben limitar el esfuerzo prolongado.'
    WHEN 4 THEN 'Riesgo respiratorio. Reducir actividades al aire libre.'
    ELSE 'Nivel de riesgo elevado. Tomar precauciones.'
  END
]
WHERE phrases IS NULL OR cardinality(phrases) = 0;