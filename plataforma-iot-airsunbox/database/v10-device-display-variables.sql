-- v10: Variables visibles en el panel principal de una estación
-- Solo lo usan orgs independientes (type B): el cliente elige qué variables
-- mostrar en grande dentro del detalle de cada estación.
-- NULL (default) → la estación no tiene selección propia (usa todas).

ALTER TABLE devices ADD COLUMN IF NOT EXISTS display_variables jsonb;