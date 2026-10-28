-- Ficha técnica de la estación: datos del equipo y foto.
-- `hardware` guarda {model, firmware, installed_at, sensors, notes}; el número
-- de serie sigue en devices.serial (único). La foto va en su propia tabla para
-- que los listados de estaciones (SELECT d.*) no carguen imágenes.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS hardware JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS device_photos (
  device_id  UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
  image      TEXT NOT NULL,          -- data:image/jpeg;base64,… (comprimida en el navegador)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
