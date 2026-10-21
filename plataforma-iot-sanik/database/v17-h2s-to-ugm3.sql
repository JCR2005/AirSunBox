-- v17-h2s-to-ugm3.sql
--
-- Cambia la unidad de H2S de ppb a ug/m3.
--
-- FACTOR. H2S pesa 34.08 g/mol. A 25 C y 1 atm el volumen molar son 24.465 L,
-- de modo que 1 ppb = 34.08/24.465 = 1.3927 ug/m3. Se redondea el factor a
-- 1.3927 y se documenta aqui para que la conversion sea reversible.
--
-- ALCANCE. Solo afecta a h2s. NOx, O3 y SO2 se quedan en ppb: son gases
-- referencia de la red de monitoreo y su convencion internacional es ppb.
-- NH3, CO y CO2 se quedan en ppm. Mezclar unidades dentro del mismo reporte es
-- correcto siempre que cada celda lleve la suya, y el PDF lo hace.
--
-- BANDAS. Se reescalan los mismos cinco cortes de la v16. El corte de
-- Precaucion se ancla en 7 ug/m3, que es la guia de 24 h de la OMS para H2S
-- (5 ug/m3 como promedio diario, con 7 como umbral de accion). Los otros
-- conservan la proporcion de los cortes en ppb.
--
--   0 - 1.4  Excelente   antes 0 - 1   ppb
--   1.4 - 7  Buena       antes 1 - 5   ppb
--   7 - 14   Precaucion  antes 5 - 10  ppb
--   14 - 70  Mala        antes 10 - 50 ppb
--   70 -     Peligrosa   antes 50 -    ppb

BEGIN;

-- ── Datos historicos y de septiembre ──────────────────────────────────────────
-- dots.value es double precision, y round() no acepta double precision con
-- precision: se multiplica en numeric y se vuelve a castear.
UPDATE dots SET value = round((value * 1.3927)::numeric, 2)::double precision
WHERE variable = 'h2s';

-- ── Catalogo ──────────────────────────────────────────────────────────────────
UPDATE variable_catalog SET unit = 'µg/m³' WHERE label = 'h2s';

-- ── Bandas globales ───────────────────────────────────────────────────────────
DELETE FROM air_quality_ranges WHERE variable_label = 'h2s';

INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('h2s', 0,    1.4,  0,   'Excelente',  1.2),
  ('h2s', 1.4,  7,    25,  'Buena',      1.2),
  ('h2s', 7,    14,   50,  'Precaución', 1.2),
  ('h2s', 14,   70,   75,  'Mala',       1.2),
  ('h2s', 70,   NULL, 100, 'Peligrosa',  1.2);

-- ── Bandas por espacio ────────────────────────────────────────────────────────
-- Se reescalan en el sitio con el mismo factor, en vez de borrarlas y
-- reinsertarlas: el id de cada fila se conserva y no hay que volver a capturarlos.
UPDATE space_variable_ranges
SET min_value = round((min_value * 1.3927)::numeric, 2),
    max_value = CASE WHEN max_value IS NULL OR max_value > 900
                     THEN 999999
                     ELSE round((max_value * 1.3927)::numeric, 2)
                END
WHERE variable_label = 'h2s';

COMMIT;
