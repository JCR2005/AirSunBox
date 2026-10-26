-- v12 — Alertas AirSunBox · canal Telegram
-- Cada alerta puede llevar su propio bot (token + chat_id),
-- así cada organización avisa a SU grupo con SU bot.

ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT,
  ADD COLUMN IF NOT EXISTS telegram_chat_id   TEXT;
