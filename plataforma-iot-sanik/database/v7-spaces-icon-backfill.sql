-- ============================================================
-- v7: Backfill de iconos en espacios
-- Causa: los espacios se creaban con icon 'map-pin' (por defecto
-- del backend) o 'Type' (default viejo del modal). Ninguno existe
-- en el mapa de iconos del frontend, por lo que la tarjeta caía
-- siempre a Layers y nunca se veía el icono del tipo.
-- Acá se normaliza el valor de `icon` según el `type` del espacio.
-- Idempotente: seguro re-aplicar.
-- ============================================================

UPDATE spaces
SET icon = CASE type
  WHEN 'aire'  THEN 'aire'
  WHEN 'agua'  THEN 'agua'
  WHEN 'suelo' THEN 'suelo'
  WHEN 'ruido' THEN 'ruido'
  ELSE 'otro'
END
WHERE icon IN ('map-pin', 'Type') OR icon IS NULL;