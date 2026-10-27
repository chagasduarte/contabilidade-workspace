-- ==============================================================================
-- 007 - Unicidade case-insensitive de usuarios.nome e usuarios.email
-- Antes só era garantida pelo DDL de runtime (UserRepository.ensureTableExists).
-- Não destrutiva e idempotente: cada índice só é criado se ainda não existir E não
-- houver duplicados; com duplicados emite NOTICE (com a contagem) e segue, sem
-- abortar o migrate.sh. Para listar os duplicados:
--   SELECT LOWER(nome), COUNT(*) FROM usuarios GROUP BY 1 HAVING COUNT(*) > 1;
--   SELECT LOWER(email), COUNT(*) FROM usuarios WHERE email IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

DO $$
DECLARE
  v_dup integer;
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.idx_usuarios_nome_uniq') IS NULL THEN
    SELECT COUNT(*) INTO v_dup FROM (
      SELECT 1 FROM usuarios GROUP BY LOWER(nome) HAVING COUNT(*) > 1
    ) d;
    IF v_dup > 0 THEN
      RAISE NOTICE 'usuarios: % nome(s) duplicado(s) ignorando caixa; idx_usuarios_nome_uniq NÃO criado', v_dup;
    ELSE
      CREATE UNIQUE INDEX idx_usuarios_nome_uniq ON usuarios (LOWER(nome));
    END IF;
  END IF;

  IF to_regclass('public.idx_usuarios_email_uniq') IS NULL THEN
    SELECT COUNT(*) INTO v_dup FROM (
      SELECT 1 FROM usuarios WHERE email IS NOT NULL GROUP BY LOWER(email) HAVING COUNT(*) > 1
    ) d;
    IF v_dup > 0 THEN
      RAISE NOTICE 'usuarios: % email(s) duplicado(s) ignorando caixa; idx_usuarios_email_uniq NÃO criado', v_dup;
    ELSE
      CREATE UNIQUE INDEX idx_usuarios_email_uniq ON usuarios (LOWER(email)) WHERE email IS NOT NULL;
    END IF;
  END IF;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('007_usuarios_unicos')
ON CONFLICT (version) DO NOTHING;
