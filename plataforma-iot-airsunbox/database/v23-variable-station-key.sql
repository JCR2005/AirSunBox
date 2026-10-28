-- Nombre con el que la estación envía cada variable, único por espacio.
-- `label` sigue siendo la clave interna única de todo el catálogo (la usan
-- dots, rangos y relaciones); `station_key` es lo que va en el JSON de la
-- estación. Para las variables globales y las ya existentes ambos coinciden.
ALTER TABLE variable_catalog ADD COLUMN IF NOT EXISTS station_key TEXT;

UPDATE variable_catalog SET station_key = label WHERE station_key IS NULL;

-- Variables de espacio que recibieron un sufijo para no chocar con otro
-- identificador (p. ej. temperatura-2): la estación vuelve a enviar
-- «temperatura», siempre que ese nombre esté libre dentro del espacio.
UPDATE variable_catalog v
SET station_key = regexp_replace(v.label, '-[0-9]+$', '')
WHERE v.space_id IS NOT NULL
  AND v.label ~ '-[0-9]+$'
  AND v.station_key = v.label
  AND EXISTS (SELECT 1 FROM variable_catalog o
              WHERE o.label = regexp_replace(v.label, '-[0-9]+$', ''))
  AND NOT EXISTS (SELECT 1 FROM variable_catalog s
                  WHERE s.space_id = v.space_id
                    AND s.station_key = regexp_replace(v.label, '-[0-9]+$', ''));

-- Sin NOT NULL: la migración se aplica antes del deploy y el código anterior
-- inserta variables sin station_key. Las consultas usan COALESCE(station_key, label).

CREATE UNIQUE INDEX IF NOT EXISTS ux_vc_space_station_key
  ON variable_catalog (space_id, station_key)
  WHERE space_id IS NOT NULL;
