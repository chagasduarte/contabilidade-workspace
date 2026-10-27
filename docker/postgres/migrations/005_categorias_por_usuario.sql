-- ==============================================================================
-- 005 - Categorias e subcategorias por usuário
-- Aprovada pelo usuário em 2026-10-26.
--
-- Não destrutiva e idempotente:
--   * userid INTEGER NULL (só catálogo, sem reescrever tabela);
--     NULL = categoria padrão do sistema, visível a todos, só leitura para usuários.
--   * Nenhum dado é alterado: todas as categorias existentes continuam globais (NULL).
--   * FK NOT VALID: vale para INSERT/UPDATE novos sem varrer as linhas antigas
--     (as antigas são NULL, então VALIDATE depois é trivial).
--   * UNIQUE só é criado se não houver duplicados; senão emite NOTICE.
--
-- Regra que fica na API (não dá para expressar com CHECK simples):
--   subcategoria de categoria do usuário X deve ter userid = X;
--   subcategoria de categoria global pode ser global (NULL) ou do usuário.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version    VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE IF EXISTS categoria    ADD COLUMN IF NOT EXISTS userid INTEGER NULL;
ALTER TABLE IF EXISTS subcategoria ADD COLUMN IF NOT EXISTS userid INTEGER NULL;

DO $$
BEGIN
  -- ----------------------------------------------------------------------------
  -- categoria
  -- ----------------------------------------------------------------------------
  IF to_regclass('public.categoria') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fk_categoria_usuario' AND conrelid = 'public.categoria'::regclass
    ) THEN
      ALTER TABLE categoria ADD CONSTRAINT fk_categoria_usuario
        FOREIGN KEY (userid) REFERENCES usuarios(id) NOT VALID;
    END IF;

    -- Listagem: WHERE (userid = $1 OR userid IS NULL) [AND tipo = $2] ORDER BY nome
    -- -> BitmapOr entre os dois índices abaixo.
    CREATE INDEX IF NOT EXISTS idx_categoria_userid_tipo
      ON categoria (userid, tipo, nome) WHERE userid IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_categoria_global_tipo
      ON categoria (tipo, nome) WHERE userid IS NULL;

    -- Mesmo nome (case-insensitive) e tipo não se repetem no escopo do dono
    -- (0 = escopo global). Não impede o usuário de ter uma "Mercado" igual à global.
    IF to_regclass('public.uq_categoria_dono_nome_tipo') IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM categoria
        GROUP BY COALESCE(userid, 0), LOWER(TRIM(nome)), tipo HAVING COUNT(*) > 1
      ) THEN
        RAISE NOTICE 'categoria possui nomes duplicados; uq_categoria_dono_nome_tipo NÃO criado';
      ELSE
        CREATE UNIQUE INDEX uq_categoria_dono_nome_tipo
          ON categoria (COALESCE(userid, 0), LOWER(TRIM(nome)), tipo);
      END IF;
    END IF;
  END IF;

  -- ----------------------------------------------------------------------------
  -- subcategoria
  -- ----------------------------------------------------------------------------
  IF to_regclass('public.subcategoria') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'fk_subcategoria_usuario' AND conrelid = 'public.subcategoria'::regclass
    ) THEN
      ALTER TABLE subcategoria ADD CONSTRAINT fk_subcategoria_usuario
        FOREIGN KEY (userid) REFERENCES usuarios(id) NOT VALID;
    END IF;

    CREATE INDEX IF NOT EXISTS idx_subcategoria_userid
      ON subcategoria (userid, idcategoria) WHERE userid IS NOT NULL;
    -- idx_subcategoria_idcategoria (002) atende WHERE idcategoria = $1

    IF to_regclass('public.uq_subcategoria_dono_nome') IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM subcategoria
        GROUP BY idcategoria, COALESCE(userid, 0), LOWER(TRIM(nome)) HAVING COUNT(*) > 1
      ) THEN
        RAISE NOTICE 'subcategoria possui nomes duplicados; uq_subcategoria_dono_nome NÃO criado';
      ELSE
        CREATE UNIQUE INDEX uq_subcategoria_dono_nome
          ON subcategoria (idcategoria, COALESCE(userid, 0), LOWER(TRIM(nome)));
      END IF;
    END IF;
  END IF;
END
$$;

INSERT INTO schema_migrations (version) VALUES ('005_categorias_por_usuario')
ON CONFLICT (version) DO NOTHING;
