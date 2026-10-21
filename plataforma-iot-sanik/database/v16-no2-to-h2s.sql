-- v16-no2-to-h2s.sql
--
-- Sustituye NO2 por H2S en todo el sistema.
--
-- Motivo: el catalogo de telemetria declaraba NO2, pero el resto del sistema
-- nunca lo contemplo. analyzeEnvironmentalImpact, repositories/reports.ts y la
-- API publica ya pedian 'h2s' con umbrales [1, 5, 10] ppb, y el seed
-- database/aqi.sql definiendo los tramos de no2 en 0-5 / 5-15 / 15-30 / 30-50
-- — una escala de H2S, no de NO2 urbano. Ademas MQ-135, el sensor de gases de
-- la flota, es un sensor de H2S.
--
-- H2S ocupa el slot exacto de NO2: mismo catalogo, mismas 10 estaciones, mismo
-- peso en el AQI y mismas 5 categorias, con los tramos reescalados al rango real
-- del sulfuro de hidrogeno. NOx se mantiene: el analisis ambiental lo usa junto
-- a h2s.
--
-- ORDEN IMPORTANTE. Estas cuatro tablas cuelgan de variable_catalog.label con
-- ON DELETE CASCADE:
--   device_variables, dots (via FK compuesta), space_aqi_variables,
--   space_variable_ranges
-- Por eso hay que capturar la configuracion por espacio ANTES de borrar la
-- entrada del catalogo, y reinsertarla despues. Borrar primero y reinsertar
-- despues es lo que deja al espacio sin la variable.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Configuracion por espacio, capturada antes de tocar nada
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _no2_spaces AS
  SELECT space_id, priority FROM space_aqi_variables WHERE variable_label = 'no2';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fuera las lecturas de septiembre de Terminal 1
--
-- Las genero tools/simulate-station.mjs con el perfil de NO2. Se borran para que
-- la regeneracion las escriba ya como h2s. El historico real de mayo se conserva
-- y se renombra en el paso 4.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM dots
WHERE variable_label = 'no2'
  AND time >= '2026-09-01';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Catalogo: alta de H2S
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO variable_catalog (name, label, unit, icon, description)
SELECT 'H₂S', 'h2s', 'ppb', 'Skull', 'Sensor MQ-135'
WHERE NOT EXISTS (SELECT 1 FROM variable_catalog WHERE label = 'h2s');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Las diez estaciones y el historico
--
-- Se copian los dispositivos que hoy tienen no2 para que su lista de variables
-- quede completa antes de borrar la entrada vieja.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO device_variables (device_id, variable_label)
SELECT dv.device_id, 'h2s'
FROM device_variables dv
WHERE dv.variable_label = 'no2'
ON CONFLICT (device_id, variable_label) DO NOTHING;

-- dots tiene dos columnas y no son equivalentes:
--   'variable'       -> la que leen TODAS las consultas de telemetria
--   'variable_label' -> la de la FK hacia device_variables
-- Hay que mover la primera en las 46,676 filas. La segunda solo en las que ya la
-- tienen: 42,298 lecturas de mayo/junio estan con variable_label NULL porque
-- son anteriores a la FK, y llenarlas de golpe las meteria bajo la FK por
-- primera vez, cambiando el ON DELETE CASCADE en las otras nueve estaciones.
UPDATE dots SET variable = 'h2s' WHERE variable = 'no2';

UPDATE dots SET variable_label = 'h2s' WHERE variable_label = 'no2';

-- Ya sin hijos, el CASCADE se lleva solo las filas por espacio. Se reponen en
-- el paso 7.
DELETE FROM variable_catalog WHERE label = 'no2';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Bandas de calidad globales
--
-- air_quality_ranges no tiene FK al catalogo, asi que no la toco la cascada.
-- Mismos score y mismo weight que tenia NO2. Los cortes derivan de los umbrales
-- [1, 5, 10] ppb que ya usa analyzeEnvironmentalImpact, para que el badge de
-- color y el analisis ambiental cuenten lo mismo.
--
-- Referencia: el limite de olor arranca en ~0.5 ppb, la OMS fija 5 ppb como
-- guia de 24 h, sobre ~10 ppb el olor es permanente y por encima de 50 ppb
-- aparecen sintomas en exposures prolongadas.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM air_quality_ranges WHERE variable_label = 'no2';

INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('h2s', 0,      1,  0,   'Excelente',  1.2),
  ('h2s', 1,      5,  25,  'Buena',      1.2),
  ('h2s', 5,      10, 50,  'Precaución', 1.2),
  ('h2s', 10,     50, 75,  'Mala',       1.2),
  ('h2s', 50,     NULL, 100, 'Peligrosa', 1.2);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Alertas historicas
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE alerts     SET variable = 'h2s' WHERE variable = 'no2';
UPDATE alert_logs SET variable = 'h2s' WHERE variable = 'no2';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Reponer la configuracion por espacio
--
-- La prioridad se conserva: no2 ocupaba el puesto 4 entre los gases. Para los
-- tramos, 999999 como banda abierta, que es la convencion que ya usa el
-- espacio "Aire".
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO space_aqi_variables (space_id, variable_label, priority)
SELECT space_id, 'h2s', priority FROM _no2_spaces
ON CONFLICT DO NOTHING;

INSERT INTO space_variable_ranges (space_id, variable_label, cat_order, min_value, max_value)
SELECT sp.space_id, 'h2s', t.cat_order, t.min_value, t.max_value
FROM _no2_spaces sp
CROSS JOIN (VALUES
  (1, 0,   1),
  (2, 1,   5),
  (3, 5,   10),
  (4, 10,  50),
  (5, 50,  999999)
) AS t(cat_order, min_value, max_value);

DROP TABLE _no2_spaces;

COMMIT;
