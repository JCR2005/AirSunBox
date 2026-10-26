-- ═══════════════════════════════════════════
-- MIGRACIÓN v21: organización interna de AirSunBox
-- ═══════════════════════════════════════════
-- Idempotente. Las bases creadas antes del cambio de nombre de la
-- plataforma tienen la organización interna con el nombre y slug viejos.
-- Se ubica por su id (el mismo en todas las instalaciones existentes) y se
-- deja con nombre "AirSunBox" y slug "airsunbox-internal", que es lo que el
-- backend usa para reconocer al equipo interno.
-- En una base nueva no hace nada: init.sql ya crea la organización así.

UPDATE organizations
SET name = 'AirSunBox', slug = 'airsunbox-internal'
WHERE id = 'd7ced3c2-9d70-4a05-b986-9d1009d7d06c'
  AND slug <> 'airsunbox-internal'
  AND NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'airsunbox-internal');

-- Correos internos autogenerados para clientes sin correo propio
UPDATE users
SET email = regexp_replace(email, '@[a-z]+\.local$', '@airsunbox.local')
WHERE email ~ '@[a-z]+\.local$' AND email NOT LIKE '%@airsunbox.local';
