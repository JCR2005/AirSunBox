-- ═══════════════════════════════════════════
-- MIGRACIÓN v19: compresión de la hypertable dots
-- ═══════════════════════════════════════════
-- Idempotente. dots crece sin límite; los chunks de más de 7 días casi no se
-- escriben (la ingesta usa la hora actual) y se leen por device + variable,
-- así que se comprimen segmentando por esas columnas (típicamente 90%+ menos
-- espacio y lecturas más rápidas en rangos largos).
--
-- No se borra ningún dato: no hay política de retención. Para revertir:
--   SELECT remove_compression_policy('dots');
--   SELECT decompress_chunk(c, true) FROM show_chunks('dots') c;
--   ALTER TABLE dots SET (timescaledb.compress = false);

ALTER TABLE dots SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id, variable',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('dots', INTERVAL '7 days', if_not_exists => TRUE);
