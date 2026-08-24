-- ═══════════════════════════════════════════
-- RECUPERACIÓN DE CONTRASEÑA
-- Agrega soporte de "olvidé mi contraseña":
--   - reset_token_hash     → bcrypt del token enviado por email (no se
--                            guarda el token en claro)
--   - reset_token_expires_at → expiración (60 min por defecto)
-- Cubre tanto cuentas individuales como organizaciones
-- autogestionadas (todas viven en la tabla users).
-- ═══════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS reset_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);