-- ============================================================
-- v13: Color de acento por espacio
-- Permite que cada espacio tenga su propio color (chip y acentos
-- en la lista, detalle y configuración AQI). No afecta a las
-- organizaciones dependientes: solo suma una columna con default.
-- Idempotente: seguro re-aplicar.
-- ============================================================

ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#67B7E8';