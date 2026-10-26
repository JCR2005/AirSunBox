-- ═══════════════════════════════════════════
-- MIGRACIÓN v18: bandera de 2FA y fin de contraseñas en claro
-- ═══════════════════════════════════════════
-- Idempotente.
--
-- 1. El login usaba otp_code_hash como "2FA activado", pero ese campo es
--    el código pendiente y se borra al verificarlo, así que el 2FA nunca se
--    volvía a pedir. Ahora la marca es explícita.
-- 2. temp_password guardaba la contraseña inicial del cliente en texto
--    plano. La contraseña solo se muestra una vez al crearla o
--    restablecerla; la columna queda vacía y sin uso.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Quien llegó a activar 2FA con el flujo anterior tiene backup codes
UPDATE users SET two_fa_enabled = TRUE
WHERE two_fa_enabled = FALSE AND cardinality(backup_codes) > 0;

UPDATE users SET temp_password = NULL WHERE temp_password IS NOT NULL;
