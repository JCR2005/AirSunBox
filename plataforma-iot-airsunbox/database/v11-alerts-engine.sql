-- v11: Motor de alertas 1.0
-- Alerta configurable: condición (variable o AQI), re-notificación, canales
-- y mensaje libre. Registro de cada disparo en alert_logs.

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS message         text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS cooldown_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS email_to        text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS webhook_url     text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS last_triggered_at timestamptz;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS trigger_count   integer NOT NULL DEFAULT 0;

-- Notificación por AQI: si variable = 'aqi', el umbral se compara contra el
-- índice (0-100) calculado para la estación (config del espacio o motor clásico).
COMMENT ON COLUMN alerts.variable IS 'variable del catálogo, o ''aqi'' para alertas por índice de calidad';

CREATE TABLE IF NOT EXISTS alert_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id    uuid REFERENCES alerts(id)    ON DELETE CASCADE,
  device_id   uuid REFERENCES devices(id)   ON DELETE CASCADE,
  variable    text,
  value       double precision,
  aqi         double precision,
  category    text,
  channel     text,
  status      text NOT NULL DEFAULT 'sent',
  message     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_alert_id   ON alert_logs(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_device_id  ON alert_logs(device_id);