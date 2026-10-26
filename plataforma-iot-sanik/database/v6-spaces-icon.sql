-- ============================================================
-- v6: Persistir el icono seleccionado en los espacios
-- Causa raíz del bug "los custom no muestran su icono":
--   la tabla spaces NO tenía columna icon → el backend INSERT
--   la descartaba → s.icon llegaba undefined → las tarjetas custom
--   caían a Layers. (El ADD COLUMN icon de v2 era de devices; la
--   tabla spaces nunca la tuvo.)
-- Idempotente: seguro re-aplicar.
-- ============================================================

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'map-pin';
