-- ═══════════════════════════════════════════
-- PLATAFORMA IOT — Esquema base de datos
-- TimescaleDB + PostgreSQL
-- ═══════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────
-- ORGANIZACIONES (tus clientes / municipalidades)
-- ─────────────────────────────────────────
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,       -- ej: "municipalidad-xela"
  plan        TEXT DEFAULT 'free',        -- free | pro | enterprise
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- USUARIOS
-- ─────────────────────────────────────────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id          UUID REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'viewer',  -- admin | editor | viewer
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DISPOSITIVOS (las estaciones ESP32)
-- ─────────────────────────────────────────
CREATE TABLE devices (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,             -- ej: "estacion-meteorologica"
  name        TEXT NOT NULL,             -- ej: "Estación Centro Xela"
  token       TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  lat         FLOAT,
  lng         FLOAT,
  last_seen   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, label)
);

-- ─────────────────────────────────────────
-- VARIABLES (SO₂, temperatura, PM2.5...)
-- ─────────────────────────────────────────
CREATE TABLE variables (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id   UUID REFERENCES devices(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,             -- ej: "temperatura"
  name        TEXT NOT NULL,             -- ej: "Temperatura"
  unit        TEXT,                      -- ej: "°C", "µg/m³"
  last_value  FLOAT,
  last_time   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(device_id, label)
);

-- ─────────────────────────────────────────
-- DOTS — Los datos de los sensores
-- Esta es la tabla principal, manejada por TimescaleDB
-- ─────────────────────────────────────────
CREATE TABLE dots (
  time        TIMESTAMPTZ NOT NULL,
  device_id   UUID NOT NULL,
  variable    TEXT NOT NULL,
  value       FLOAT NOT NULL,
  context     JSONB                       -- lat/lng u otros metadatos opcionales
);

-- Convertir dots en hypertable (el superpoder de TimescaleDB)
SELECT create_hypertable('dots', 'time');

-- Índices para consultas rápidas
CREATE INDEX ON dots (device_id, variable, time DESC);

-- ─────────────────────────────────────────
-- ALERTAS (configuración de umbrales)
-- ─────────────────────────────────────────
CREATE TABLE alerts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id     UUID REFERENCES devices(id) ON DELETE CASCADE,
  variable      TEXT NOT NULL,
  condition     TEXT NOT NULL,           -- ">" | "<" | "=" 
  threshold     FLOAT NOT NULL,          -- ej: 50 (para PM2.5 > 50)
  channel       TEXT NOT NULL,           -- "email" | "webhook"
  destination   TEXT NOT NULL,           -- email o URL
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- ORGANIZACIÓN DE EJEMPLO para desarrollo
-- ─────────────────────────────────────────
INSERT INTO organizations (name, slug, plan)
VALUES ('Mi Organización', 'mi-organizacion', 'pro');
