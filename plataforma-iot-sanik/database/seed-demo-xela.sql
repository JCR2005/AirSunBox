-- Datos sintéticos para una prueba controlada de IoT Sanik en Quetzaltenango.
-- Solo inserta datos; no crea ni modifica usuarios u organizaciones, ni borra
-- estaciones, lecturas o configuraciones existentes.
-- Ejecutar únicamente después de verificar que la precondición de producción
-- coincide con el esquema/estado esperado por este script.

BEGIN;

-- Evita ejecuciones concurrentes del mismo seed.
SELECT pg_advisory_xact_lock(hashtext('iot-sanik-seed-demo-xela-v1')::bigint);

DO $$
DECLARE
  v_org_id uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_org_id
  FROM organizations
  WHERE slug = 'mi-organizacion';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Seed detenido: no existe organizations.slug=mi-organizacion';
  END IF;

  IF (SELECT type FROM organizations WHERE id = v_org_id) IS DISTINCT FROM 'A' THEN
    RAISE EXCEPTION 'Seed detenido: mi-organizacion no es tipo A; revisar permisos/espacios';
  END IF;

  SELECT count(*) INTO v_count
  FROM users
  WHERE org_id = v_org_id
    AND ((email = 'admin@gmail.com' AND role = 'admin')
      OR (email = 'cliente@gmail.com' AND role = 'client'));

  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Seed detenido: los dos usuarios esperados no están asociados a mi-organizacion con sus roles indicados';
  END IF;

  SELECT count(*) INTO v_count
  FROM (VALUES
    ('co', 'ppm'),
    ('mq135_adc', 'ADC'),
    ('o3', 'ppb'),
    ('h2s', 'µg/m³'),
    ('temperatura', '°C'),
    ('humedad', '%'),
    ('pm1', 'µg/m³'),
    ('pm25', 'µg/m³'),
    ('pm10', 'µg/m³')
  ) AS expected(label, unit)
  JOIN variable_catalog vc ON vc.label = expected.label AND vc.unit = expected.unit;

  IF v_count <> 9 OR EXISTS (SELECT 1 FROM variable_catalog WHERE label = 'no2') THEN
    RAISE EXCEPTION 'Seed detenido: catálogo/unidades no coinciden con H2S µg/m³ y las variables esperadas';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM devices d
    WHERE d.org_id = v_org_id
      AND ((d.label = 'estacion-centro-xela' AND d.name <> 'Estación Centro Xela')
        OR (d.label = 'estacion-zona3-xela' AND d.name <> 'Estación Zona 3 Xela')
        OR (d.name = 'Estación Centro Xela' AND d.label <> 'estacion-centro-xela')
        OR (d.name = 'Estación Zona 3 Xela' AND d.label <> 'estacion-zona3-xela'))
  ) THEN
    RAISE EXCEPTION 'Seed detenido: hay una estación con etiqueta/nombre en conflicto; revisar manualmente';
  END IF;
END $$;

-- Reutiliza las estaciones del cliente si ya existen; si falta alguna, la crea.
-- El espacio Aire existente se asocia cuando está disponible.
INSERT INTO devices (org_id, label, name, lat, lng, description, icon, tags, space_id, status)
SELECT o.id, station.label, station.name, station.lat, station.lng,
       'DEMO: estación con telemetría sintética; no representa mediciones reales.',
       'map-pin', jsonb_build_array('demo', 'simulated', 'seed-demo-xela-v1'),
       aire.id, 'active'
FROM organizations o
CROSS JOIN (VALUES
  ('estacion-centro-xela', 'Estación Centro Xela', 14.8446::double precision, -91.5232::double precision),
  ('estacion-zona3-xela', 'Estación Zona 3 Xela', 14.8375::double precision, -91.5180::double precision)
) AS station(label, name, lat, lng)
LEFT JOIN spaces aire ON aire.org_id = o.id AND aire.slug = 'aire'
WHERE o.slug = 'mi-organizacion'
  AND NOT EXISTS (
    SELECT 1 FROM devices existing
    WHERE existing.org_id = o.id AND existing.label = station.label
  )
ON CONFLICT (org_id, label) DO NOTHING;

-- No se cambian etiquetas ni configuraciones existentes; se agregan solo los
-- vínculos sensor-variable faltantes para las mediciones sintéticas de abajo.
INSERT INTO device_variables (device_id, variable_label)
SELECT d.id, sensor.variable_label
FROM organizations o
JOIN devices d ON d.org_id = o.id
CROSS JOIN (VALUES
  ('estacion-centro-xela', 'co'),
  ('estacion-centro-xela', 'mq135_adc'),
  ('estacion-centro-xela', 'h2s'),
  ('estacion-centro-xela', 'pm25'),
  ('estacion-centro-xela', 'temperatura'),
  ('estacion-zona3-xela', 'o3'),
  ('estacion-zona3-xela', 'h2s'),
  ('estacion-zona3-xela', 'pm10'),
  ('estacion-zona3-xela', 'humedad'),
  ('estacion-zona3-xela', 'pm1')
) AS sensor(device_label, variable_label)
WHERE o.slug = 'mi-organizacion'
  AND d.label = sensor.device_label
ON CONFLICT (device_id, variable_label) DO NOTHING;

-- Cinco filas por estación con cinco horas distintas. Los valores ya están en
-- las unidades del catálogo; mq135_adc es lectura cruda, no CO2. El marcador
-- en context evita duplicados incluso si el script se repite en otro momento.
WITH samples(station_slot, device_label, sample_no, variable, value, unit, sensor) AS (
  VALUES
    ('centro', 'estacion-centro-xela', 1, 'co',          0.8,  'ppm',    'MQ-7'),
    ('centro', 'estacion-centro-xela', 2, 'mq135_adc', 920.0, 'ADC',    'MQ-135 crudo'),
    ('centro', 'estacion-centro-xela', 3, 'h2s',         2.4,  'µg/m³', 'MQ-136'),
    ('centro', 'estacion-centro-xela', 4, 'pm25',       17.8,  'µg/m³', 'PMS5003'),
    ('centro', 'estacion-centro-xela', 5, 'temperatura',20.4,  '°C',    'DHT11'),
    ('zona3',  'estacion-zona3-xela',  1, 'o3',         42.0,  'ppb',   'MQ-131'),
    ('zona3',  'estacion-zona3-xela',  2, 'h2s',         1.6,  'µg/m³', 'MQ-136'),
    ('zona3',  'estacion-zona3-xela',  3, 'pm10',       31.5,  'µg/m³', 'PMS5003'),
    ('zona3',  'estacion-zona3-xela',  4, 'humedad',    62.0,  '%',     'DHT11'),
    ('zona3',  'estacion-zona3-xela',  5, 'pm1',         9.3,  'µg/m³', 'PMS5003')
)
INSERT INTO dots (time, device_id, variable, value, context)
SELECT date_trunc('hour', transaction_timestamp())
         + (samples.sample_no - 5) * INTERVAL '1 hour',
       d.id, samples.variable, samples.value,
       jsonb_build_object(
         'simulated', true,
         'demo_seed', 'iot-sanik-demo-xela-v1',
         'station_slot', samples.station_slot,
         'sample_no', samples.sample_no,
         'sensor', samples.sensor,
         'unit', samples.unit
       )
FROM organizations o
JOIN devices d ON d.org_id = o.id
JOIN samples ON samples.device_label = d.label
WHERE o.slug = 'mi-organizacion'
  AND NOT EXISTS (
    SELECT 1 FROM dots existing
    WHERE existing.device_id = d.id
      AND existing.context->>'demo_seed' = 'iot-sanik-demo-xela-v1'
      AND existing.context->>'station_slot' = samples.station_slot
      AND existing.context->>'sample_no' = samples.sample_no::text
  );

-- Alerta inactiva: queda visible para probar configuración, sin poder notificar.
INSERT INTO alerts (device_id, variable, condition, threshold, channel, destination, active, message)
SELECT d.id, 'pm25', '>', 55, 'email', 'demo-disabled@invalid.example', FALSE,
       'DEMO SIMULADO: alerta inactiva para prueba; no enviar notificaciones.'
FROM organizations o
JOIN devices d ON d.org_id = o.id AND d.label = 'estacion-centro-xela'
WHERE o.slug = 'mi-organizacion'
  AND NOT EXISTS (
    SELECT 1 FROM alerts a
    WHERE a.device_id = d.id
      AND a.variable = 'pm25'
      AND a.message = 'DEMO SIMULADO: alerta inactiva para prueba; no enviar notificaciones.'
  );

-- Incidente ya resuelto para que aparezca en el historial sin dejar una alerta
-- operativa ni cambiar el estado de la estación.
INSERT INTO incidents (device_id, org_id, reason, status, resolved_at, notes)
SELECT d.id, o.id, 'DEMO SIMULADO: verificación de estación en Xela', 'resolved',
       transaction_timestamp(), 'Registro sintético de prueba; no corresponde a un incidente real.'
FROM organizations o
JOIN devices d ON d.org_id = o.id AND d.label = 'estacion-centro-xela'
WHERE o.slug = 'mi-organizacion'
  AND NOT EXISTS (
    SELECT 1 FROM incidents i
    WHERE i.org_id = o.id
      AND i.device_id = d.id
      AND i.reason = 'DEMO SIMULADO: verificación de estación en Xela'
  );

COMMIT;
