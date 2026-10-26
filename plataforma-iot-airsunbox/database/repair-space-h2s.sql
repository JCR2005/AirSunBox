-- repair-space-h2s.sql
--
-- Repone la configuracion por espacio que la v16 perdio por orden de pasos.
-- No forma parte de la migracion en si: solo deshace el efecto de haber
-- corrido v16-no2-to-h2s.sql con la version anterior, en la que el
-- DELETE FROM variable_catalog se llevaba por cascada las filas de
-- space_aqi_variables y space_variable_ranges antes de reinsertarlas.

BEGIN;

INSERT INTO space_aqi_variables (space_id, variable_label, priority)
SELECT DISTINCT space_id, 'h2s', 4 FROM space_aqi_variables
ON CONFLICT DO NOTHING;

INSERT INTO space_variable_ranges (space_id, variable_label, cat_order, min_value, max_value)
SELECT sp.space_id, 'h2s', t.cat_order, t.min_value, t.max_value
FROM (SELECT DISTINCT space_id FROM space_aqi_variables) sp
CROSS JOIN (VALUES
  (1, 0,  1),
  (2, 1,  5),
  (3, 5,  10),
  (4, 10, 50),
  (5, 50, 999999)
) AS t(cat_order, min_value, max_value);

COMMIT;
