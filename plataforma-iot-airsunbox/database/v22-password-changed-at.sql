-- ═══════════════════════════════════════════
-- MIGRACIÓN v22: fecha del último cambio de contraseña
-- ═══════════════════════════════════════════
-- Idempotente. Al cambiar la contraseña se cierran las sesiones abiertas en
-- todos los dispositivos: el backend rechaza los tokens emitidos antes de
-- esta fecha (con Redis como caché de consulta rápida).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
