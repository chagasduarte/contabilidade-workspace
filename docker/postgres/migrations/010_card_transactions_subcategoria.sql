-- Subcategoria opcional das compras; preserva todos os registros existentes.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE IF EXISTS card_transactions ADD COLUMN IF NOT EXISTS subcategoria_id INTEGER NULL;

DO $$
BEGIN
  IF to_regclass('public.card_transactions') IS NULL OR to_regclass('public.subcategoria') IS NULL THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_card_transactions_subcategoria'
      AND conrelid = 'public.card_transactions'::regclass
  ) THEN
    ALTER TABLE card_transactions ADD CONSTRAINT fk_card_transactions_subcategoria
      FOREIGN KEY (subcategoria_id) REFERENCES subcategoria(id) ON DELETE SET NULL NOT VALID;
  END IF;
  CREATE INDEX IF NOT EXISTS idx_card_transactions_subcategoria
    ON card_transactions (subcategoria_id) WHERE subcategoria_id IS NOT NULL;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('010_card_transactions_subcategoria')
ON CONFLICT (version) DO NOTHING;
