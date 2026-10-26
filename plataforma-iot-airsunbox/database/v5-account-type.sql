-- v5: Tipo de cuenta en el registro self-service
--   · account_type : 'individual' (persona natural) | 'organizacion' (empresa, municipio, universidad...)
--   El plan inicial es el mismo para todas las independientes ('estandar');
--   el admin decide 'especial' / exoneraciones después.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='account_type') THEN
    ALTER TABLE organizations ADD COLUMN account_type text NOT NULL DEFAULT 'organizacion';
  END IF;
END $$;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_account_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_account_type_check CHECK (account_type IN ('individual','organizacion'));

-- Las org independientes existentes registradas como "persona" no distinguibles:
-- se dejan como 'organizacion' por defecto.