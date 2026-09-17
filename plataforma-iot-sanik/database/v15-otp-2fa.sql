-- ═══════════════════════════════════════════
-- MIGRACIÓN v15: OTP 2FA por Email
-- ═══════════════════════════════════════════

-- USERS: campos OTP
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS otp_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;

-- ORGANIZATIONS: política 2FA
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS two_fa_policy TEXT DEFAULT 'optional'
    CHECK (two_fa_policy IN ('optional', 'required_admins', 'required_all'));