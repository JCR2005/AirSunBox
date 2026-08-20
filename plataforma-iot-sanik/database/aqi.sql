-- ═══════════════════════════════════════════
-- AirSunBox AQI — Tabla de rangos y datos
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS air_quality_ranges (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  variable_label TEXT NOT NULL,
  min_value      FLOAT NOT NULL,
  max_value      FLOAT,          -- NULL = sin límite superior (> max)
  score          INT NOT NULL,   -- 0, 25, 50, 75, 100
  category       TEXT NOT NULL,  -- Excelente, Buena, Precaución, Mala, Peligrosa
  weight         FLOAT DEFAULT 1.0
);

CREATE INDEX IF NOT EXISTS idx_aqr_label ON air_quality_ranges(variable_label);

-- ── CO ────────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('co', 0,    1,    0,   'Excelente',  1.2),
  ('co', 1,    3,    25,  'Buena',      1.2),
  ('co', 3,    6,    50,  'Precaución', 1.2),
  ('co', 6,    10,   75,  'Mala',       1.2),
  ('co', 10,   NULL, 100, 'Peligrosa',  1.2);

-- ── CO2 ───────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('co2', 0,    600,  0,   'Excelente',  1.0),
  ('co2', 600,  800,  25,  'Buena',      1.0),
  ('co2', 800,  1200, 50,  'Precaución', 1.0),
  ('co2', 1200, 2000, 75,  'Mala',       1.0),
  ('co2', 2000, NULL, 100, 'Peligrosa',  1.0);

-- ── NH3 ───────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('nh3', 0,  5,    0,   'Excelente',  1.0),
  ('nh3', 5,  10,   25,  'Buena',      1.0),
  ('nh3', 10, 20,   50,  'Precaución', 1.0),
  ('nh3', 20, 40,   75,  'Mala',       1.0),
  ('nh3', 40, NULL, 100, 'Peligrosa',  1.0);

-- ── NOX ───────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('nox', 0,  10,   0,   'Excelente',  1.1),
  ('nox', 10, 20,   25,  'Buena',      1.1),
  ('nox', 20, 40,   50,  'Precaución', 1.1),
  ('nox', 40, 60,   75,  'Mala',       1.1),
  ('nox', 60, NULL, 100, 'Peligrosa',  1.1);

-- ── NO2 ───────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('no2', 0,  5,    0,   'Excelente',  1.2),
  ('no2', 5,  15,   25,  'Buena',      1.2),
  ('no2', 15, 30,   50,  'Precaución', 1.2),
  ('no2', 30, 50,   75,  'Mala',       1.2),
  ('no2', 50, NULL, 100, 'Peligrosa',  1.2);

-- ── O3 ────────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('o3', 0,  25,   0,   'Excelente',  1.1),
  ('o3', 25, 40,   25,  'Buena',      1.1),
  ('o3', 40, 60,   50,  'Precaución', 1.1),
  ('o3', 60, 80,   75,  'Mala',       1.1),
  ('o3', 80, NULL, 100, 'Peligrosa',  1.1);

-- ── SO2 ───────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('so2', 0,  10,   0,   'Excelente',  1.1),
  ('so2', 10, 20,   25,  'Buena',      1.1),
  ('so2', 20, 40,   50,  'Precaución', 1.1),
  ('so2', 40, 60,   75,  'Mala',       1.1),
  ('so2', 60, NULL, 100, 'Peligrosa',  1.1);

-- ── PM2.5 ─────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('pm25', 0,   12,   0,   'Excelente',  1.5),
  ('pm25', 12,  25,   25,  'Buena',      1.5),
  ('pm25', 25,  55,   50,  'Precaución', 1.5),
  ('pm25', 55,  150,  75,  'Mala',       1.5),
  ('pm25', 150, NULL, 100, 'Peligrosa',  1.5);

-- ── PM10 ──────────────────────────────────
INSERT INTO air_quality_ranges (variable_label, min_value, max_value, score, category, weight) VALUES
  ('pm10', 0,   25,   0,   'Excelente',  1.3),
  ('pm10', 25,  50,   25,  'Buena',      1.3),
  ('pm10', 50,  100,  50,  'Precaución', 1.3),
  ('pm10', 100, 200,  75,  'Mala',       1.3),
  ('pm10', 200, NULL, 100, 'Peligrosa',  1.3);
