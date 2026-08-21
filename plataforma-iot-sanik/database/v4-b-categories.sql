-- v4: Clasificación de organizaciones en el panel admin
--   · category       : 'dependiente' (tipo A, gestión Sanik) | 'independiente' (tipo B, autogestionada)
--   · b_category     : subcategoría de org tipo B: 'estandar' (planes normales) | 'especial' (a medida / exonerable)
--   · payment_exempt : exoneración de pago (solo la asigna el admin)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='category') THEN
    ALTER TABLE organizations ADD COLUMN category text NOT NULL DEFAULT 'dependiente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='b_category') THEN
    ALTER TABLE organizations ADD COLUMN b_category text NOT NULL DEFAULT 'estandar';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organizations' AND column_name='payment_exempt') THEN
    ALTER TABLE organizations ADD COLUMN payment_exempt boolean NOT NULL DEFAULT false;
  END IF;
END $$;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_category_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_category_check CHECK (category IN ('dependiente','independiente'));

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_b_category_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_b_category_check CHECK (b_category IN ('estandar','especial'));

-- Reclasificar existentes
UPDATE organizations SET category = 'independiente' WHERE is_self_service = TRUE OR type = 'B';
UPDATE organizations SET category = 'dependiente'   WHERE type = 'A';
UPDATE organizations SET b_category = 'estandar'    WHERE b_category IS NULL;