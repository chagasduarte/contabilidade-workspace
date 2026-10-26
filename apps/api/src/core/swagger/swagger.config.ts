// swagger.config.ts
// Especificação OpenAPI 3.0.3 completa para a Contabilidade API

export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Contabilidade API',
    version: '2.0.0',
    description: `API de Gestão Financeira Pessoal e Contabilidade.
Permite o controle integral de fluxo de caixa, cartões de crédito com faturas automáticas, contratos de empréstimo e amortização antecipada com desconto, orçamentos, metas financeiras e inteligência artificial financeira.`,
    contact: {
      name: 'Suporte Técnico',
      email: 'suporte@contabilidade.com',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Servidor Atual (Raiz ou Prefixo /api)',
    },
    {
      url: 'http://localhost:3000',
      description: 'Ambiente de Desenvolvimento Local',
    },
    {
      url: 'https://novasapi.vercel.app',
      description: 'Ambiente de Produção (Vercel)',
    },
  ],
  tags: [
    {
      name: 'Autenticação',
      description: 'Endpoints de login e emissão de tokens JWT',
    },
    {
      name: 'Usuários',
      description: 'Cadastro de usuários e gerenciamento de perfil e avatar',
    },
    {
      name: 'Cartões de Crédito',
      description: 'Gestão de cartões, limites disponíveis/comprometidos, compras parceladas e liquidação de faturas',
    },
    {
      name: 'Empréstimos',
      description: 'Controle de contratos, projeção de amortização vs. juros e pagamento antecipado com desconto',
    },
    {
      name: 'Transações',
      description: 'Lançamento e consulta de receitas, despesas, parcelamentos e extratos',
    },
    {
      name: 'Dashboard',
      description: 'Resumos consolidados, gráficos de evolução e projeções anuais',
    },
    {
      name: 'Categorias',
      description: 'Classificação de receitas e despesas com cores e ícones',
    },
    {
      name: 'Subcategorias',
      description: 'Subdivisão de categorias para maior granularidade',
    },
    {
      name: 'Planejamento',
      description: 'Definição de tetos de gastos e orçamentos mensais por categoria',
    },
    {
      name: 'Objetivos',
      description: 'Metas de economia e acompanhamento de progresso financeiro',
    },
    {
      name: 'Inteligência Artificial',
      description: 'Assistente financeiro conversacional alimentado pelo Groq Llama',
    },
    {
      name: 'Cartões (Legado)',
      description: 'Compatibilidade com o módulo de cartões da versão anterior',
    },
    {
      name: 'Transações Planejadas',
      description: 'Lançamentos previstos/avulsos de receitas e despesas com recorrência e projeções financeiras',
    },
    {
      name: 'Previsão de Fluxo de Caixa',
      description: 'Motor de inteligência financeira: projeção diária e mensal, margem Safe to Spend e simulação de metas/compras',
    },
  ],
  paths: {
    // -------------------------------------------------------------------------
    // AUTENTICAÇÃO
    // -------------------------------------------------------------------------
    '/auth/login': {
      post: {
        tags: ['Autenticação'],
        summary: 'Autenticação de usuário',
        description: 'Autentica o usuário via e-mail ou nome de usuário e senha, retornando o token JWT e dados do usuário.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
              example: {
                email: 'usuario@exemplo.com',
                senha: 'senhaSegura123',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Autenticado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthResponse' },
              },
            },
          },
          400: {
            description: 'Dados incompletos',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          401: {
            description: 'Credenciais inválidas',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // USUÁRIOS
    // -------------------------------------------------------------------------
    '/user': {
      post: {
        tags: ['Usuários'],
        summary: 'Cadastrar novo usuário',
        description: 'Cria uma nova conta de usuário no sistema com senha criptografada (bcrypt). Aceita upload opcional de foto de avatar em multipart/form-data.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['nome', 'email', 'senha'],
                properties: {
                  nome: { type: 'string', example: 'João Silva' },
                  email: { type: 'string', format: 'email', example: 'joao@email.com' },
                  senha: { type: 'string', format: 'password', example: 'MinhaSenhaForte123' },
                  avatar: { type: 'string', format: 'binary', description: 'Imagem de perfil (opcional)' },
                },
              },
            },
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'email', 'senha'],
                properties: {
                  nome: { type: 'string', example: 'João Silva' },
                  email: { type: 'string', format: 'email', example: 'joao@email.com' },
                  senha: { type: 'string', format: 'password', example: 'MinhaSenhaForte123' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Usuário cadastrado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          400: {
            description: 'E-mail já cadastrado ou validação inválida',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/user/me': {
      get: {
        tags: ['Usuários'],
        summary: 'Perfil do usuário autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Perfil', content: { 'application/json': { schema: { $ref: '#/components/schemas/Perfil' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Usuários'],
        summary: 'Atualizar nome e/ou e-mail',
        description: 'nome: 2–255 caracteres; email válido (salvo em minúsculas). Já usado por outro usuário (sem diferenciar maiúsculas) -> 409.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  nome: { type: 'string', minLength: 2, maxLength: 255, example: 'Ana Paula' },
                  email: { type: 'string', format: 'email', example: 'ana@exemplo.com' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Perfil atualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Perfil' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          409: { description: 'Nome de usuário ou e-mail já em uso', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroPadrao' } } } },
        },
      },
    },
    '/user/avatar': {
      get: {
        tags: ['Usuários'],
        summary: 'Obter avatar do usuário autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'URL ou binário do avatar',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    avatar: { type: 'string', example: '/uploads/1729000000-avatar.png' },
                  },
                },
              },
            },
          },
          401: { description: 'Não autorizado' },
        },
      },
    },
    '/user/{id}/avatar': {
      post: {
        tags: ['Usuários'],
        summary: 'Atualizar avatar de usuário específico',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['avatar'],
                properties: {
                  avatar: { type: 'string', format: 'binary' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Avatar atualizado com sucesso' },
          401: { description: 'Não autorizado' },
        },
      },
      get: {
        tags: ['Usuários'],
        summary: 'Consultar avatar de usuário por ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Avatar retornado com sucesso' },
          404: { description: 'Usuário não encontrado' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // CARTÕES DE CRÉDITO (MÓDULO MODERNO)
    // -------------------------------------------------------------------------
    '/cards': {
      get: {
        tags: ['Cartões de Crédito'],
        summary: 'Listar cartões com limites consolidados',
        description: 'Retorna a lista de cartões de crédito do usuário, calculando o limite total, limite comprometido em faturas não pagas e limite disponível em tempo real.',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Lista de cartões com métricas de limite',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CardDetailsResponse' },
                },
              },
            },
          },
          401: { description: 'Não autorizado' },
        },
      },
      post: {
        tags: ['Cartões de Crédito'],
        summary: 'Cadastrar novo cartão de crédito',
        description: 'Cadastra um cartão com limites, dia de fechamento, dia de vencimento e cor personalizada.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCardDto' },
            },
          },
        },
        responses: {
          201: {
            description: 'Cartão criado com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreditCard' },
              },
            },
          },
          400: { description: 'Dados inválidos' },
        },
      },
    },
    '/cards/{id}': {
      get: {
        tags: ['Cartões de Crédito'],
        summary: 'Obter detalhes de um cartão',
        description: 'Retorna os dados do cartão, limites e a relação de faturas.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CardDetailsResponse' },
              },
            },
          },
          404: { description: 'Cartão não encontrado' },
        },
      },
    },
    '/cards/transacoes': {
      post: {
        tags: ['Cartões de Crédito'],
        summary: 'Lançar compra no cartão de crédito',
        description: 'Realiza uma compra à vista ou parcelada (1 a N). Valida o limite disponível e distribui automaticamente as parcelas nas faturas correspondentes com base no dia de fechamento.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCardTransactionDto' },
            },
          },
        },
        responses: {
          201: {
            description: 'Transação lançada e parcelas alocadas nas faturas com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    transacao: { $ref: '#/components/schemas/CardTransaction' },
                    itens: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/InvoiceItem' },
                    },
                    cartaoAtualizado: { $ref: '#/components/schemas/CardDetailsResponse' },
                  },
                },
              },
            },
          },
          400: { description: 'Limite insuficiente ou dados inválidos' },
        },
      },
    },
    '/cards/{id}/faturas': {
      get: {
        tags: ['Cartões de Crédito'],
        summary: 'Listar histórico de faturas do cartão',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'ano', in: 'query', required: false, schema: { type: 'integer', example: 2026 } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/CardInvoice' },
                },
              },
            },
          },
        },
      },
    },
    '/cards/faturas/{faturaId}': {
      get: {
        tags: ['Cartões de Crédito'],
        summary: 'Detalhes da fatura e itens lançados',
        description: 'Retorna a fatura com todas as suas parcelas de compras (invoice_items).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'faturaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/InvoiceDetailsResponse' },
              },
            },
          },
          404: { description: 'Fatura não encontrada' },
        },
      },
    },
    '/cards/faturas/{faturaId}/pagar': {
      post: {
        tags: ['Cartões de Crédito'],
        summary: 'Liquidar fatura de cartão de crédito',
        description: 'Marca a fatura como PAID, registra valor pago e data de pagamento, restaurando imediatamente o limite disponível do cartão.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'faturaId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/PayInvoiceDto' },
            },
          },
        },
        responses: {
          200: {
            description: 'Fatura liquidada e limite restaurado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    fatura: { $ref: '#/components/schemas/CardInvoice' },
                    cartaoAtualizado: { $ref: '#/components/schemas/CardDetailsResponse' },
                  },
                },
              },
            },
          },
          400: { description: 'Fatura já liquidada ou inválida' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // EMPRÉSTIMOS E AMORTIZAÇÃO
    // -------------------------------------------------------------------------
    '/loans': {
      get: {
        tags: ['Empréstimos'],
        summary: 'Listar contratos de empréstimos',
        description:
          'Lista os contratos do usuário autenticado (contracted_at DESC, created_at DESC). Paginação keyset opcional.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Paginado' },
          { $ref: '#/components/parameters/Cursor' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          200: {
            description: 'Contratos de empréstimo. Sem ?paginado/?cursor: array completo (formato antigo). Com paginação: { items, next_cursor }.',
            headers: { 'X-Next-Cursor': { $ref: '#/components/headers/XNextCursor' } },
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { type: 'array', items: { $ref: '#/components/schemas/Loan' } },
                    {
                      type: 'object',
                      properties: {
                        items: { type: 'array', items: { $ref: '#/components/schemas/Loan' } },
                        next_cursor: { type: 'string', nullable: true, description: 'Cursor opaco da próxima página; null na última.' },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'cursor, limit, mes ou ano inválido' },
        },
      },
      post: {
        tags: ['Empréstimos'],
        summary: 'Cadastrar contrato de empréstimo',
        description: 'Cadastra o contrato e gera de forma transacional todas as cotas do cronograma com segregação de principal e juros.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateLoanDto' },
            },
          },
        },
        responses: {
          201: {
            description: 'Contrato e parcelas criados',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    loan: { $ref: '#/components/schemas/Loan' },
                    installments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/LoanInstallment' },
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Parâmetros inválidos' },
        },
      },
    },
    '/loans/{id}': {
      get: {
        tags: ['Empréstimos'],
        summary: 'Buscar empréstimo por ID com cronograma',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    loan: { $ref: '#/components/schemas/Loan' },
                    installments: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/LoanInstallment' },
                    },
                  },
                },
              },
            },
          },
          404: { description: 'Empréstimo não encontrado' },
        },
      },
    },
    '/loans/{id}/resumo': {
      get: {
        tags: ['Empréstimos'],
        summary: 'Resumo financeiro e economia acumulada',
        description: 'Consolida total desembolsado, total economizado em descontos obtidos e saldo devedor restante projetado.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoanSummary' },
              },
            },
          },
          404: { description: 'Empréstimo não encontrado' },
        },
      },
    },
    '/loans/pagamentos': {
      post: {
        tags: ['Empréstimos'],
        summary: 'Liquidar / amortizar parcela com desconto',
        description: 'Registra o pagamento da cota validando a integridade (valor_pago = valor_original - desconto + multa), marcando como PAID e atualizando o status do contrato para PAID_OFF quando todas estiverem quitadas.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoanPaymentDto' },
            },
          },
        },
        responses: {
          200: {
            description: 'Pagamento registrado com sucesso',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    payment: { $ref: '#/components/schemas/LoanPayment' },
                    loan_status: { type: 'string', example: 'ACTIVE' },
                  },
                },
              },
            },
          },
          400: { description: 'Valor inconsistente ou parcela já quitada' },
        },
      },
    },

    '/api/loans/installments/{id}/settle': {
      post: {
        tags: ['Empréstimos'],
        summary: 'Efetivar liquidação de parcela de empréstimo',
        description: 'Efetiva de forma atômica (ACID) a quitação de uma parcela de empréstimo, atualizando seu status para PAID e registrando a despesa na tabela contábil real transacoes.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID da parcela do empréstimo (UUID)',
            schema: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SettleLoanInstallmentDto' },
            },
          },
        },
        responses: {
          200: {
            description: 'Parcela liquidada e transação contábil registrada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SettleLoanInstallmentResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Conflito: parcela não está com status PENDING' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // TRANSAÇÕES
    // -------------------------------------------------------------------------
    '/transacoes': {
      get: {
        tags: ['Transações'],
        summary: 'Listar transações filtradas',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', example: 10 } },
          { name: 'ano', in: 'query', schema: { type: 'integer', example: 2026 } },
          { name: 'cardId', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Transacao' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Transações'],
        summary: 'Criar nova transação simples',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransacaoDto' },
            },
          },
        },
        responses: {
          201: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transacao' },
              },
            },
          },
        },
      },
    },
    '/transacoes/{id}': {
      get: {
        tags: ['Transações'],
        summary: 'Buscar transação por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Transacao' },
              },
            },
          },
          404: { description: 'Transação não encontrada' },
        },
      },
      put: {
        tags: ['Transações'],
        summary: 'Atualizar transação',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransacaoDto' },
            },
          },
        },
        responses: {
          200: { description: 'Transação atualizada' },
        },
      },
      delete: {
        tags: ['Transações'],
        summary: 'Excluir transação',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          204: { description: 'Transação excluída com sucesso' },
        },
      },
    },
    '/transacoes/parceladas': {
      get: {
        tags: ['Transações'],
        summary: 'Listar despesas parceladas do mês',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Lista de parcelamentos' },
        },
      },
      post: {
        tags: ['Transações'],
        summary: 'Lançar despesa parcelada recorrente',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTransacaoParceladaDto' },
            },
          },
        },
        responses: {
          201: { description: 'Parcelas criadas com sucesso' },
        },
      },
    },
    '/transacoes/extrato': {
      get: {
        tags: ['Transações'],
        summary: 'Extrato consolidado do período',
        description:
          'Extrato por competência (cartão -> pagamento, conta -> data), ordenado por data DESC, id DESC. Paginação keyset opcional; cursor no formato YYYY-MM-DD_id (trate como opaco).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
          { $ref: '#/components/parameters/Paginado' },
          { $ref: '#/components/parameters/Cursor' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          200: {
            description: 'Extrato financeiro. Sem ?paginado/?cursor: array completo (formato antigo). Com paginação: { items, next_cursor }.',
            headers: { 'X-Next-Cursor': { $ref: '#/components/headers/XNextCursor' } },
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { type: 'array', items: { $ref: '#/components/schemas/Transacao' } },
                    {
                      type: 'object',
                      properties: {
                        items: { type: 'array', items: { $ref: '#/components/schemas/Transacao' } },
                        next_cursor: { type: 'string', nullable: true, description: 'Cursor opaco da próxima página; null na última.' },
                        totais: {
                          type: 'object',
                          description:
                            'Só na 1ª página paginada (sem cursor): totais do período inteiro (mesmos filtros mes/ano), independentes da página.',
                          properties: {
                            entradas: { type: 'number', description: "Soma dos valores com tipo 'entrada'" },
                            saidas: { type: 'number', description: "Soma dos valores dos demais tipos ('saida', 'cartao')" },
                            pendentes: { type: 'integer', description: "QUANTIDADE de lançamentos com status 'pendente'" },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'cursor, limit, mes ou ano inválido' },
        },
      },
    },
    '/transacoes/agrupadaPorTipos': {
      get: {
        tags: ['Transações'],
        summary: 'Transações agrupadas por tipo/categoria',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
          { name: 'tipo', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Agrupamento retornado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    soma: { type: 'object', properties: { soma: { type: 'number' } } },
                    agrupamento: { type: 'array', items: { $ref: '#/components/schemas/AgrupamentoTipoItem' } },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/transacoes/entradas': {
      get: {
        tags: ['Transações'],
        summary: 'Listar receitas / entradas do mês',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Lista de receitas' } },
      },
    },
    '/transacoes/despesa': {
      get: {
        tags: ['Transações'],
        summary: 'Listar despesas / saídas do mês',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Lista de despesas' } },
      },
    },
    '/transacoes/topago/{id}': {
      get: {
        tags: ['Transações'],
        summary: 'Alternar status de pagamento da transação',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Status atualizado' } },
      },
    },
    '/transacoes/linhatemporal': {
      get: {
        tags: ['Transações'],
        summary: 'Evolução temporal de transações',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Dados de linha do tempo' } },
      },
    },
    '/transacoes/pordia': {
      get: {
        tags: ['Transações'],
        summary: 'Consolidado de transações por dia',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Totais por dia' } },
      },
    },

    // -------------------------------------------------------------------------
    // DASHBOARD
    // -------------------------------------------------------------------------
    '/dashboard/resumo': {
      get: {
        tags: ['Dashboard'],
        summary: 'Resumo financeiro mensal',
        description: 'Total de receitas, despesas, saldo líquido, economia prevista e transações recentes.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', example: 10 } },
          { name: 'ano', in: 'query', schema: { type: 'integer', example: 2026 } },
        ],
        responses: {
          200: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardResumo' },
              },
            },
          },
        },
      },
    },
    '/dashboard/transacoes': {
      get: {
        tags: ['Dashboard'],
        summary: 'Transações filtradas para gráficos',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer' } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
          { name: 'tipo', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Transações para exibição no dashboard' } },
      },
    },
    '/dashboard/projecao': {
      get: {
        tags: ['Dashboard'],
        summary: 'Projeção orçamentária anual',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'ano', in: 'query', schema: { type: 'integer', example: 2026 } },
        ],
        responses: { 200: { description: 'Projeção mensal de receitas e despesas' } },
      },
    },
    '/dashboard/agrupamento': {
      get: {
        tags: ['Dashboard'],
        summary: 'Despesas do ano agrupadas por categoria',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'ano', in: 'query', schema: { type: 'integer' } }],
        responses: {
          200: {
            description: 'Agrupamento para gráfico de rosca/pizza',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/AgrupamentoCategoria' } },
              },
            },
          },
        },
      },
    },

    // -------------------------------------------------------------------------
    // CATEGORIAS & SUBCATEGORIAS
    // -------------------------------------------------------------------------
    '/categorias': {
      get: {
        tags: ['Categorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Listar todas as categorias',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Categoria' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Categorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Criar nova categoria',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateCategoriaDto' },
            },
          },
        },
        responses: {
          201: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Categoria' },
              },
            },
          },
        },
      },
    },
    '/categorias/{id}': {
      get: {
        tags: ['Categorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Buscar categoria por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Categoria encontrada' }, 404: { description: 'Não encontrada' } },
      },
      delete: {
        tags: ['Categorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Deletar categoria',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Categoria deletada' } },
      },
    },
    '/subcategorias': {
      get: {
        tags: ['Subcategorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Listar subcategorias',
        responses: {
          200: {
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Subcategoria' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Subcategorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Criar nova subcategoria',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateSubcategoriaDto' },
            },
          },
        },
        responses: { 201: { description: 'Subcategoria criada' } },
      },
    },
    '/subcategorias/categoria/{idcategoria}': {
      get: {
        tags: ['Subcategorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Listar subcategorias de uma categoria',
        parameters: [{ name: 'idcategoria', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Subcategorias vinculadas' } },
      },
    },
    '/subcategorias/{id}': {
      get: {
        tags: ['Subcategorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Buscar subcategoria por ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Subcategoria encontrada' } },
      },
      delete: {
        tags: ['Subcategorias'],
        security: [{ bearerAuth: [] }],
        summary: 'Deletar subcategoria',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Subcategoria removida' } },
      },
    },

    // -------------------------------------------------------------------------
    // PLANEJAMENTO E OBJETIVOS
    // -------------------------------------------------------------------------
    '/planejamento': {
      get: {
        tags: ['Planejamento'],
        summary: 'Listar planejamentos (orçamentos) do usuário',
        description: 'Sem mes/ano lista todos; com ano filtra o ano; com mes+ano filtra o mês. Valores como number.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Planejamentos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Planejamento' } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Planejamento'],
        summary: 'Criar planejamento do mês',
        description:
          'Categoria precisa ser do usuário ou global (senão 400). Nomes de categoria/subcategoria vêm do banco. Se já existe planejamento do mesmo mês/tipo/categoria/subcategoria, o valor é SOMADO nele (responde o registro atualizado).',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreatePlanejamentoDto' } } },
        },
        responses: {
          201: { description: 'Planejamento criado (ou somado ao existente)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Planejamento' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/planejamento/agrupados': {
      get: {
        tags: ['Planejamento'],
        summary: 'Planejamento agrupado por tipo e categoria',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: { description: 'Agrupamento', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PlanejamentoAgrupadoTipo' } } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/planejamento/resumo': {
      get: {
        tags: ['Planejamento'],
        summary: 'Planejado x realizado por categoria no mês',
        description:
          'Por categoria: planejado, realizado_pago e realizado_pendente (separados; o front decide como somar). Realizado = lançamentos do mês na conta por competência (cartão legado -> vencimento; conta -> data) + parcelas de cartão das faturas de referência do mês (só despesa). Pagamento de fatura gravado como lançamento (source_type CREDIT_CARD_INVOICE_PAYMENT) é excluído para não contar duas vezes. Padrão: mês corrente, tipo despesa.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'mes', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
          { name: 'ano', in: 'query', schema: { type: 'integer' } },
          { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['despesa', 'receita'], default: 'despesa' } },
        ],
        responses: {
          200: { description: 'Resumo do mês', content: { 'application/json': { schema: { $ref: '#/components/schemas/ResumoPlanejamento' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/planejamento/{id}': {
      get: {
        tags: ['Planejamento'],
        summary: 'Buscar planejamento por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Planejamento', content: { 'application/json': { schema: { $ref: '#/components/schemas/Planejamento' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Planejamento'],
        summary: 'Atualizar planejamento (parcial)',
        description: 'Campos ausentes mantêm o valor atual; o mês não muda. Trocar a categoria sem informar subcategoria limpa a subcategoria.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdatePlanejamentoDto' } } },
        },
        responses: {
          200: { description: 'Planejamento atualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Planejamento' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Planejamento'],
        summary: 'Excluir planejamento',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: 'Excluído' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/objetivos': {
      get: {
        tags: ['Objetivos'],
        summary: 'Listar objetivos (metas) com progresso',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Objetivos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Objetivo' } } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Objetivos'],
        summary: 'Criar objetivo',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateObjetivoDto' } } },
        },
        responses: {
          201: { description: 'Objetivo criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Objetivo' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/objetivos/{id}': {
      get: {
        tags: ['Objetivos'],
        summary: 'Buscar objetivo (com progresso)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          200: { description: 'Objetivo', content: { 'application/json': { schema: { $ref: '#/components/schemas/Objetivo' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Objetivos'],
        summary: 'Atualizar objetivo (parcial)',
        description: 'Envie só os campos a alterar. Para registrar o quanto já foi guardado, atualize valor_acumulado.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateObjetivoDto' } } },
        },
        responses: {
          200: { description: 'Objetivo atualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Objetivo' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Objetivos'],
        summary: 'Excluir objetivo',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          204: { description: 'Excluído' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/objetivos/{id}/aportes': {
      post: {
        tags: ['Objetivos'],
        summary: 'Registrar aporte (guardar dinheiro)',
        description:
          'Soma valor ao valor_acumulado de forma ATÔMICA no banco (UPDATE ... SET valor_acumulado = valor_acumulado + valor). Use no lugar de ler + PUT valor_acumulado: aportes simultâneos (vários aparelhos) não se perdem. Devolve o objetivo com o progresso recalculado.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['valor'],
                properties: {
                  valor: { type: 'number', exclusiveMinimum: true, minimum: 0, multipleOf: 0.01, example: 250.5 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Objetivo atualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Objetivo' } } } },
          400: { description: 'valor ausente, <= 0, com mais de 2 casas ou soma acima do limite', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroPadrao' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // ASSISTENTE DE INTELIGÊNCIA ARTIFICIAL
    // -------------------------------------------------------------------------
    '/ai/chat': {
      post: {
        tags: ['Inteligência Artificial'],
        summary: 'Extrair uma transação de texto ou de foto de recibo',
        description:
          'Interpreta a mensagem e/ou a foto e devolve uma transação estruturada (NÃO grava nada; o front confirma e chama POST /transacoes). Com foto, message é opcional. Imagem: base64 cru ou data URL, JPEG/PNG/WEBP (detectado pelos bytes), até AI_MAX_IMAGE_MB (padrão 4 MB, limite da Groq). Corpo total até 10 MB.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', maxLength: 2000, example: 'Gastei 87,50 no mercado hoje' },
                  base64Image: { type: 'string', description: 'Foto do recibo em base64 ou data URL (data:image/jpeg;base64,...)' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Transação extraída (não gravada)', content: { 'application/json': { schema: { $ref: '#/components/schemas/TransacaoExtraidaIA' } } } },
          400: { description: 'Sem mensagem e sem foto, mensagem longa demais ou base64 inválido', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          413: { description: 'Foto acima do limite (IMAGEM_GRANDE)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
          415: { description: 'Formato de imagem não suportado (IMAGEM_FORMATO)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
          422: { description: 'A IA não identificou uma transação (IA_SEM_RESULTADO); peça foto mais nítida', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
          429: { description: 'Limite de uso do provedor de IA (IA_LIMITE)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
          502: { description: 'Falha do provedor de IA (IA_INDISPONIVEL)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
          503: { description: 'IA ou leitura de fotos não configurada / timeout (IA_INDISPONIVEL)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroIA' } } } },
        },
      },
    },

    // -------------------------------------------------------------------------
    // CARTÃO LEGADO
    // -------------------------------------------------------------------------
    '/cartao': {
      get: {
        tags: ['Cartões (Legado)'],
        summary: 'Listar cartões legados',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Lista de cartões legado' } },
      },
      post: {
        tags: ['Cartões (Legado)'],
        summary: 'Criar cartão legado',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['nome', 'dia_fatura', 'limite'],
                properties: {
                  nome: { type: 'string', example: 'Nubank Legado' },
                  dia_fatura: { type: 'integer', example: 5 },
                  limite: { type: 'number', example: 5000 },
                },
              },
            },
          },
        },
        responses: { 201: { description: 'Cartão criado' } },
      },
    },

    // -------------------------------------------------------------------------
    // TRANSAÇÕES PLANEJADAS (RECEITAS E DESPESAS PREVISTAS)
    // -------------------------------------------------------------------------
    '/api/planned-transactions': {
      get: {
        tags: ['Transações Planejadas'],
        summary: 'Listar transações planejadas',
        description: 'Retorna a lista de transações planejadas do usuário autenticado com filtros de status, tipo, datas e categoria.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            description: 'Filtrar por status (PENDING, SETTLED, SKIPPED, CANCELLED ou múltiplos separados por vírgula)',
            schema: { type: 'string', example: 'PENDING' },
          },
          {
            name: 'tipo',
            in: 'query',
            description: 'Filtrar por tipo',
            schema: { type: 'string', enum: ['RECEITA', 'DESPESA'], example: 'DESPESA' },
          },
          {
            name: 'dataInicio',
            in: 'query',
            description: 'Data inicial prevista (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date', example: '2026-11-01' },
          },
          {
            name: 'dataFim',
            in: 'query',
            description: 'Data final prevista (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date', example: '2026-11-30' },
          },
          {
            name: 'idcategoria',
            in: 'query',
            description: 'ID da categoria vinculada',
            schema: { type: 'integer', example: 1 },
          },
          { $ref: '#/components/parameters/Paginado' },
          { $ref: '#/components/parameters/Cursor' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          200: {
            description:
              'Transações planejadas (data_prevista, created_at, id ASC). Sem ?paginado/?cursor: array completo (formato antigo). Com paginação: { items, next_cursor }.',
            headers: { 'X-Next-Cursor': { $ref: '#/components/headers/XNextCursor' } },
            content: {
              'application/json': {
                schema: {
                  oneOf: [
                    { type: 'array', items: { $ref: '#/components/schemas/PlannedTransaction' } },
                    {
                      type: 'object',
                      properties: {
                        items: { type: 'array', items: { $ref: '#/components/schemas/PlannedTransaction' } },
                        next_cursor: { type: 'string', nullable: true, description: 'Cursor opaco da próxima página; null na última.' },
                      },
                    },
                  ],
                },
              },
            },
          },
          400: { description: 'cursor ou limit inválido' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Transações Planejadas'],
        summary: 'Cadastrar nova transação planejada',
        description: 'Cadastra uma receita ou despesa prevista para projeções financeiras futuras sem misturar com o extrato consolidado.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreatePlannedTransactionDto' },
            },
          },
        },
        responses: {
          201: {
            description: 'Transação planejada criada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PlannedTransaction' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },

    '/api/planned-transactions/{id}': {
      get: {
        tags: ['Transações Planejadas'],
        summary: 'Obter transação planejada por ID',
        description: 'Retorna os detalhes de uma transação planejada pertencente ao usuário.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID da transação planejada (UUID)',
            schema: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
          },
        ],
        responses: {
          200: {
            description: 'Transação planejada encontrada',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PlannedTransaction' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Transações Planejadas'],
        summary: 'Atualizar transação planejada',
        description: 'Atualiza parcialmente os campos ou status da transação planejada existente.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID da transação planejada (UUID)',
            schema: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdatePlannedTransactionDto' },
            },
          },
        },
        responses: {
          200: {
            description: 'Transação planejada atualizada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PlannedTransaction' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Transações Planejadas'],
        summary: 'Excluir transação planejada',
        description: 'Exclui a transação planejada física ou logicamente (?soft=true).',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID da transação planejada (UUID)',
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'soft',
            in: 'query',
            description: 'Se true, cancela logicamente mantendo status CANCELLED em vez de deletar fisicamente.',
            schema: { type: 'boolean', default: false },
          },
        ],
        responses: {
          200: {
            description: 'Transação planejada excluída ou cancelada com sucesso',
            content: {
              'application/json': {
                example: {
                  message: 'Transação planejada excluída com sucesso.',
                  id: '123e4567-e89b-12d3-a456-426614174000',
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    '/api/planned-transactions/{id}/settle': {
      post: {
        tags: ['Transações Planejadas'],
        summary: 'Efetivar / liquidar transação planejada',
        description: 'Efetiva de forma atômica (ACID) o pagamento/recebimento de uma obrigação prevista, atualizando status para SETTLED e inserindo a transação contábil na tabela transacoes com source_type PLANNED.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'ID da transação planejada (UUID)',
            schema: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
          },
        ],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SettlePlannedTransactionDto' },
            },
          },
        },
        responses: {
          200: {
            description: 'Transação planejada efetivada e registrada no extrato real',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SettlePlannedTransactionResponse' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Conflito: transação planejada não está com status PENDING' },
        },
      },
    },

    // -------------------------------------------------------------------------
    // PREVISÃO DE FLUXO DE CAIXA (CASH FLOW FORECASTING)
    // -------------------------------------------------------------------------
    '/api/forecast': {
      get: {
        tags: ['Previsão de Fluxo de Caixa'],
        summary: 'Projeção de fluxo de caixa e simulação de compras',
        description: 'Calcula a curva de evolução diária e mensal de saldo com base no saldo real consolidado e obrigações pendentes (planejamento, empréstimos e faturas). Retorna margem segura para gastar hoje (Safe to Spend) e avalia viabilidade de compra simulada.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'months',
            in: 'query',
            description: 'Número de meses à frente para projeção (default: 3, min: 1, max: 24)',
            schema: { type: 'integer', default: 3, minimum: 1, maximum: 24, example: 3 },
          },
          {
            name: 'targetExpenseAmount',
            in: 'query',
            description: 'Valor de uma despesa/compra simulada para avaliar viabilidade',
            schema: { type: 'number', example: 2500.0 },
          },
          {
            name: 'targetExpenseDate',
            in: 'query',
            description: 'Data prevista para a compra simulada (YYYY-MM-DD)',
            schema: { type: 'string', format: 'date', example: '2026-12-15' },
          },
        ],
        responses: {
          200: {
            description: 'Projeção financeira calculada com sucesso',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ForecastResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
  },
  components: {
    parameters: {
      Paginado: {
        name: 'paginado',
        in: 'query',
        description:
          'Opcional. true = resposta paginada { items, next_cursor }. Sem este parâmetro (e sem cursor) a resposta é o array completo, como antes.',
        schema: { type: 'boolean' },
      },
      Cursor: {
        name: 'cursor',
        in: 'query',
        description: 'Opcional. Valor de next_cursor (ou do header X-Next-Cursor) da página anterior. Implica paginado=true.',
        schema: { type: 'string' },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Itens por página quando paginado (padrão 50, máximo 200).',
        schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
    },
    responses: {
      BadRequest: {
        description: 'Requisição inválida',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroPadrao' } } },
      },
      Unauthorized: {
        description: 'Token ausente, inválido ou expirado (401)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroPadrao' } } },
      },
      NotFound: {
        description: 'Recurso não encontrado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErroPadrao' } } },
      },
    },
    headers: {
      XNextCursor: {
        description: 'Cursor da próxima página (ausente na última). Exposto via CORS.',
        schema: { type: 'string' },
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT gerado no endpoint /auth/login. Envie no formato: Bearer <seu_token>',
      },
    },
    schemas: {
      ErroPadrao: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Mensagem de erro' },
          error: { type: 'string', example: 'Mensagem de erro' },
        },
      },
      // -----------------------------------------------------------------------
      // SCHEMAS GERAIS E AUTH
      // -----------------------------------------------------------------------
      ErrorResponse: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Descrição da mensagem de erro' },
          error: { type: 'string', example: 'Descrição da mensagem de erro' },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['senha'],
        properties: {
          email: { type: 'string', format: 'email', example: 'usuario@exemplo.com' },
          nome: { type: 'string', example: 'usuario123' },
          senha: { type: 'string', format: 'password', example: 'senhaSegura123' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          usuario: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              nome: { type: 'string', example: 'João Silva' },
              email: { type: 'string', example: 'joao@email.com' },
              avatar: { type: 'string', nullable: true, example: '/uploads/avatar.png' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'João Silva' },
          email: { type: 'string', example: 'joao@email.com' },
          avatar: { type: 'string', nullable: true, example: '/uploads/avatar.png' },
          criado_em: { type: 'string', format: 'date-time' },
        },
      },

      // -----------------------------------------------------------------------
      // CARTÕES DE CRÉDITO (MODERNO)
      // -----------------------------------------------------------------------
      CreditCard: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' },
          usuario_id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Nubank Ultravioleta' },
          bandeira: { type: 'string', example: 'Mastercard' },
          limite_total: { type: 'number', example: 10000.0 },
          dia_fechamento: { type: 'integer', example: 20 },
          dia_vencimento: { type: 'integer', example: 27 },
          cor_identificacao: { type: 'string', example: '#820AD1' },
          ativo: { type: 'boolean', example: true },
          criado_em: { type: 'string', format: 'date-time' },
          atualizado_em: { type: 'string', format: 'date-time' },
        },
      },
      CreateCardDto: {
        type: 'object',
        required: ['nome', 'bandeira', 'limite_total', 'dia_fechamento', 'dia_vencimento', 'cor_identificacao'],
        properties: {
          nome: { type: 'string', example: 'Nubank Ultravioleta' },
          bandeira: { type: 'string', example: 'Mastercard' },
          limite_total: { type: 'number', minimum: 0, example: 10000.0 },
          dia_fechamento: { type: 'integer', minimum: 1, maximum: 31, example: 20 },
          dia_vencimento: { type: 'integer', minimum: 1, maximum: 31, example: 27 },
          cor_identificacao: { type: 'string', example: '#820AD1' },
        },
      },
      CardInvoice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          cartao_id: { type: 'string', format: 'uuid' },
          mes_referencia: { type: 'integer', example: 10 },
          ano_referencia: { type: 'integer', example: 2026 },
          data_fechamento: { type: 'string', format: 'date', example: '2026-10-20' },
          data_vencimento: { type: 'string', format: 'date', example: '2026-10-27' },
          status: { type: 'string', enum: ['OPEN', 'CLOSED', 'PAID', 'OVERDUE'], example: 'OPEN' },
          data_pagamento: { type: 'string', format: 'date', nullable: true },
          valor_pago: { type: 'number', nullable: true },
          total_fatura: { type: 'number', example: 1250.0 },
        },
      },
      CardTransaction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          cartao_id: { type: 'string', format: 'uuid' },
          categoria_id: { type: 'integer', nullable: true },
          descricao: { type: 'string', example: 'Notebook Gamer' },
          valor_total: { type: 'number', example: 3000.0 },
          quantidade_parcelas: { type: 'integer', example: 10 },
          data_compra: { type: 'string', format: 'date', example: '2026-10-15' },
          criado_em: { type: 'string', format: 'date-time' },
        },
      },
      InvoiceItem: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fatura_id: { type: 'string', format: 'uuid' },
          transacao_id: { type: 'string', format: 'uuid' },
          numero_parcela: { type: 'integer', example: 1 },
          valor_parcela: { type: 'number', example: 300.0 },
          descricao: { type: 'string', example: 'Notebook Gamer' },
          quantidade_parcelas: { type: 'integer', example: 10 },
          data_compra: { type: 'string', format: 'date', example: '2026-10-15' },
        },
      },
      CreateCardTransactionDto: {
        type: 'object',
        required: ['cartao_id', 'descricao', 'valor_total', 'quantidade_parcelas', 'data_compra'],
        properties: {
          cartao_id: { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' },
          descricao: { type: 'string', example: 'Notebook Gamer' },
          valor_total: { type: 'number', minimum: 0.01, example: 3000.0 },
          quantidade_parcelas: { type: 'integer', minimum: 1, example: 10 },
          data_compra: { type: 'string', format: 'date', example: '2026-10-15' },
          categoria_id: { type: 'integer', nullable: true, example: 3 },
        },
      },
      PayInvoiceDto: {
        type: 'object',
        properties: {
          valor_pago: { type: 'number', example: 1250.0 },
          data_pagamento: { type: 'string', format: 'date', example: '2026-10-25' },
        },
      },
      CardDetailsResponse: {
        type: 'object',
        properties: {
          cartao: { $ref: '#/components/schemas/CreditCard' },
          limite_total: { type: 'number', example: 10000.0 },
          limite_comprometido: { type: 'number', example: 3000.0 },
          limite_disponivel: { type: 'number', example: 7000.0 },
          faturas: {
            type: 'array',
            items: { $ref: '#/components/schemas/CardInvoice' },
          },
        },
      },
      InvoiceDetailsResponse: {
        type: 'object',
        properties: {
          fatura: { $ref: '#/components/schemas/CardInvoice' },
          cartao: { $ref: '#/components/schemas/CreditCard' },
          itens: {
            type: 'array',
            items: { $ref: '#/components/schemas/InvoiceItem' },
          },
        },
      },

      // -----------------------------------------------------------------------
      // EMPRÉSTIMOS
      // -----------------------------------------------------------------------
      Loan: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          institution_name: { type: 'string', example: 'Banco Santander' },
          principal_amount: { type: 'number', example: 15000.0 },
          monthly_interest_rate: { type: 'number', example: 0.021 },
          status: { type: 'string', enum: ['ACTIVE', 'PAID_OFF', 'DEFAULTED'], example: 'ACTIVE' },
          contracted_at: { type: 'string', format: 'date', example: '2026-01-10' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      LoanInstallment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          loan_id: { type: 'string', format: 'uuid' },
          installment_number: { type: 'integer', example: 1 },
          due_date: { type: 'string', format: 'date', example: '2026-02-10' },
          original_amount: { type: 'number', example: 1450.0 },
          principal_component: { type: 'number', example: 1135.0 },
          interest_component: { type: 'number', example: 315.0 },
          status: { type: 'string', enum: ['PENDING', 'PAID', 'PARTIALLY_PAID'], example: 'PENDING' },
        },
      },
      LoanPayment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          loan_id: { type: 'string', format: 'uuid' },
          installment_id: { type: 'string', format: 'uuid' },
          payment_date: { type: 'string', format: 'date', example: '2026-02-05' },
          amount_paid: { type: 'number', example: 1320.0 },
          discount_amount: { type: 'number', example: 130.0 },
          penalty_interest: { type: 'number', example: 0.0 },
          payment_method: { type: 'string', example: 'PIX' },
        },
      },
      CreateLoanDto: {
        type: 'object',
        required: [
          'institution_name',
          'principal_amount',
          'monthly_interest_rate',
          'total_installments',
          'installment_amount',
          'first_due_date',
        ],
        properties: {
          institution_name: { type: 'string', example: 'Banco Santander' },
          principal_amount: { type: 'number', minimum: 1, example: 15000.0 },
          monthly_interest_rate: { type: 'number', example: 0.021 },
          total_installments: { type: 'integer', minimum: 1, example: 12 },
          installment_amount: { type: 'number', minimum: 1, example: 1450.0 },
          first_due_date: { type: 'string', format: 'date', example: '2026-02-10' },
        },
      },
      LoanPaymentDto: {
        type: 'object',
        required: ['loan_id', 'installment_id', 'amount_paid', 'payment_method'],
        properties: {
          loan_id: { type: 'string', format: 'uuid' },
          installment_id: { type: 'string', format: 'uuid' },
          amount_paid: { type: 'number', example: 1320.0 },
          discount_amount: { type: 'number', default: 0, example: 130.0 },
          penalty_interest: { type: 'number', default: 0, example: 0.0 },
          payment_method: { type: 'string', enum: ['PIX', 'TED', 'DEBIT', 'BOLETO'], example: 'PIX' },
          payment_date: { type: 'string', format: 'date', example: '2026-02-05' },
        },
      },
      LoanSummary: {
        type: 'object',
        properties: {
          loan: { $ref: '#/components/schemas/Loan' },
          installments: {
            type: 'array',
            items: { $ref: '#/components/schemas/LoanInstallment' },
          },
          total_paid: { type: 'number', example: 2640.0 },
          total_discounts: { type: 'number', example: 260.0 },
          remaining_balance: { type: 'number', example: 12360.0 },
        },
      },

      // -----------------------------------------------------------------------
      // TRANSAÇÕES E DASHBOARD
      // -----------------------------------------------------------------------
      Transacao: {
        type: 'object',
        description:
          'Lançamento em transacoes. categoria_nome/subcategoria_nome vêm sempre (null quando não houver). Campos numéricos legados podem chegar como string (numeric do Postgres).',
        properties: {
          id: { type: 'integer', example: 101 },
          tipo: { type: 'string', enum: ['entrada', 'saida', 'cartao'], example: 'saida' },
          descricao: { type: 'string', example: 'Supermercado Mensal' },
          valor: { oneOf: [{ type: 'number' }, { type: 'string' }], example: '450.50' },
          data: { type: 'string', format: 'date', example: '2026-10-14' },
          pagamento: { type: 'string', format: 'date', nullable: true, description: 'Vencimento/competência' },
          status: { type: 'string', enum: ['pendente', 'pago'], example: 'pendente' },
          idcategoria: { type: 'integer', nullable: true, example: 2 },
          idsubcategoria: { type: 'integer', nullable: true, example: 5 },
          categoria_nome: { type: 'string', nullable: true, example: 'Casa' },
          subcategoria_nome: { type: 'string', nullable: true, example: 'Energia' },
          categoria: {
            type: 'integer',
            nullable: true,
            deprecated: true,
            description: 'LEGADO: subcategoria ou a própria categoria. Use idsubcategoria e os nomes.',
          },
          ispaycart: { type: 'boolean' },
          cartaoid: { type: 'integer', nullable: true },
          parcela_grupo_id: { type: 'string', format: 'uuid', nullable: true },
          parcela_numero: { type: 'integer', nullable: true },
          parcela_total: { type: 'integer', nullable: true },
          source_type: { type: 'string', nullable: true, example: 'PLANNED' },
          source_id: { type: 'string', nullable: true },
        },
      },
      CreateTransacaoDto: {
        type: 'object',
        required: ['tipo', 'descricao', 'valor', 'data'],
        properties: {
          tipo: {
            type: 'string',
            enum: ['entrada', 'saida', 'cartao'],
            description: "'cartao' (ou ispaycart/cartaoid) desvia a compra para o modelo de cartão (card_transactions).",
          },
          descricao: { type: 'string', example: 'Supermercado Mensal' },
          valor: { type: 'number', example: 450.5 },
          data: { type: 'string', format: 'date', example: '2026-10-14' },
          pagamento: { type: 'string', format: 'date', nullable: true },
          status: { type: 'string', enum: ['pendente', 'pago'], default: 'pendente' },
          idcategoria: {
            type: 'integer',
            nullable: true,
            description: 'Categoria do usuário ou global; senão 400 "Categoria não encontrada."',
          },
          idsubcategoria: {
            type: 'integer',
            nullable: true,
            description:
              'Opcional. Subcategoria visível ao usuário e pertencente a idcategoria; senão 400 "Subcategoria não encontrada." Tem prioridade sobre categoria.',
          },
          categoria: {
            type: 'integer',
            nullable: true,
            deprecated: true,
            description:
              'LEGADO (fase 1, ainda aceito): se for subcategoria válida de idcategoria vira idsubcategoria; igual a idcategoria = sem subcategoria; qualquer outro valor é ignorado.',
          },
          ispaycart: { type: 'boolean', default: false },
          cartaoid: { oneOf: [{ type: 'integer' }, { type: 'string', format: 'uuid' }], nullable: true },
        },
      },
      CreateTransacaoParceladaDto: {
        type: 'object',
        required: ['descricao', 'valor', 'data', 'parcelas'],
        properties: {
          descricao: { type: 'string', example: 'Smartphone Novo' },
          valor: { type: 'number', description: 'Valor total', example: 2400.0 },
          data: { type: 'string', format: 'date', example: '2026-10-15' },
          parcelado: { type: 'boolean', example: true },
          tipo: { type: 'string', enum: ['saida', 'cartao'] },
          ispaycart: { type: 'boolean' },
          cartaoid: { oneOf: [{ type: 'integer' }, { type: 'string', format: 'uuid' }], nullable: true },
          idcategoria: { type: 'integer', nullable: true },
          idsubcategoria: { type: 'integer', nullable: true, description: 'Mesmas regras de CreateTransacaoDto' },
          categoria: { type: 'integer', nullable: true, deprecated: true },
          parcelas: {
            type: 'object',
            required: ['QtdParcelas'],
            properties: {
              QtdParcelas: { type: 'integer', minimum: 1, maximum: 420, example: 12 },
              Valor: { type: 'number', description: 'Valor de cada parcela (tolerância de 0,05)', example: 200 },
            },
          },
        },
      },
      AgrupamentoTipoItem: {
        type: 'object',
        properties: {
          total_tipo: { type: 'string', example: '350.00' },
          idcategoria: { type: 'integer', nullable: true },
          subcategoria: { type: 'integer', nullable: true, deprecated: true, description: 'LEGADO: valor da coluna categoria' },
          idsubcategoria: { type: 'integer', nullable: true },
          categoria_nome: { type: 'string', nullable: true },
          subcategoria_nome: { type: 'string', nullable: true },
        },
      },
      AgrupamentoCategoria: {
        type: 'object',
        properties: {
          categoria: { type: 'integer', nullable: true, deprecated: true, description: 'LEGADO: valor da coluna categoria' },
          media_mensal: { type: 'string', example: '1200.00' },
          idcategoria: { type: 'integer', nullable: true },
          idsubcategoria: { type: 'integer', nullable: true },
          categoria_nome: { type: 'string', nullable: true },
          subcategoria_nome: { type: 'string', nullable: true },
        },
      },
      DashboardResumo: {
        type: 'object',
        properties: {
          receitas: { type: 'number', example: 8500.0 },
          despesas: { type: 'number', example: 4200.0 },
          saldo: { type: 'number', example: 4300.0 },
          transacoesRecentes: {
            type: 'array',
            items: { $ref: '#/components/schemas/Transacao' },
          },
        },
      },

      // -----------------------------------------------------------------------
      // CATEGORIAS, SUBCATEGORIAS, PLANEJAMENTO E OBJETIVOS
      // -----------------------------------------------------------------------
      Categoria: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          descricao: { type: 'string', example: 'Alimentação' },
          tipo: { type: 'string', enum: ['receita', 'despesa'], example: 'despesa' },
          cor: { type: 'string', example: '#10B981' },
          icone: { type: 'string', example: 'restaurant-outline' },
        },
      },
      CreateCategoriaDto: {
        type: 'object',
        required: ['descricao', 'tipo'],
        properties: {
          descricao: { type: 'string', example: 'Alimentação' },
          tipo: { type: 'string', enum: ['receita', 'despesa'], example: 'despesa' },
          cor: { type: 'string', example: '#10B981' },
          icone: { type: 'string', example: 'restaurant-outline' },
        },
      },
      Subcategoria: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10 },
          descricao: { type: 'string', example: 'Restaurante & Delivery' },
          idcategoria: { type: 'integer', example: 1 },
        },
      },
      CreateSubcategoriaDto: {
        type: 'object',
        required: ['descricao', 'idcategoria'],
        properties: {
          descricao: { type: 'string', example: 'Restaurante & Delivery' },
          idcategoria: { type: 'integer', example: 1 },
        },
      },
      Planejamento: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          categoriaid: { type: 'integer' },
          categoria: { type: 'string', description: 'Nome da categoria (vem do banco)', example: 'Mercado' },
          subcategoriaid: { type: 'integer', nullable: true },
          subcategoria: { type: 'string', nullable: true, description: 'Nome da subcategoria' },
          tipo: { type: 'string', enum: ['despesa', 'receita'] },
          valor: { type: 'number', example: 800 },
          data: { type: 'string', format: 'date', description: 'Mês de referência', example: '2026-11-01' },
          userid: { type: 'integer' },
        },
      },
      CreatePlanejamentoDto: {
        type: 'object',
        required: ['categoriaid', 'valor', 'data'],
        properties: {
          categoriaid: { type: 'integer', example: 3 },
          subcategoriaid: { type: 'integer', nullable: true, description: 'Precisa pertencer à categoria' },
          valor: { type: 'number', exclusiveMinimum: true, minimum: 0, example: 800 },
          tipo: { type: 'string', enum: ['despesa', 'receita'], description: 'Opcional: padrão = tipo da categoria' },
          data: { type: 'string', format: 'date', example: '2026-11-01' },
        },
      },
      UpdatePlanejamentoDto: {
        type: 'object',
        description: 'Parcial; o mês (data) não muda.',
        properties: {
          categoriaid: { type: 'integer' },
          subcategoriaid: { type: 'integer', nullable: true },
          valor: { type: 'number', exclusiveMinimum: true, minimum: 0 },
          tipo: { type: 'string', enum: ['despesa', 'receita'] },
        },
      },
      PlanejamentoAgrupadoTipo: {
        type: 'object',
        properties: {
          tipo: { type: 'string' },
          soma: { type: 'number' },
          agrupamentoTipo: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                categoria: { type: 'string' },
                categoriaid: { type: 'integer' },
                soma: { type: 'number' },
                planejamento: { type: 'array', items: { $ref: '#/components/schemas/Planejamento' } },
              },
            },
          },
        },
      },
      ResumoPlanejamento: {
        type: 'object',
        properties: {
          mes: { type: 'integer' },
          ano: { type: 'integer' },
          tipo: { type: 'string', enum: ['despesa', 'receita'] },
          totais: { $ref: '#/components/schemas/ResumoPlanejamentoValores' },
          categorias: {
            type: 'array',
            items: {
              allOf: [
                {
                  type: 'object',
                  properties: {
                    idcategoria: { type: 'integer' },
                    categoria_nome: { type: 'string', nullable: true },
                  },
                },
                { $ref: '#/components/schemas/ResumoPlanejamentoValores' },
              ],
            },
          },
        },
      },
      ResumoPlanejamentoValores: {
        type: 'object',
        properties: {
          planejado: { type: 'number' },
          realizado_pago: { type: 'number', description: "Transações 'pago' + parcelas de faturas 'PAID'" },
          realizado_pendente: { type: 'number', description: 'Transações pendentes + parcelas de faturas não pagas' },
        },
      },
      Objetivo: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          usuario_id: { type: 'integer' },
          nome: { type: 'string', example: 'Reserva de emergência' },
          tipo: { type: 'string', example: 'reserva' },
          valor_objetivo: { type: 'number', example: 12000 },
          valor_mensal: { type: 'number', example: 1000 },
          valor_acumulado: { type: 'number', example: 3000 },
          data_final: { type: 'string', format: 'date', example: '2027-06-15' },
          criado_em: { type: 'string', format: 'date-time' },
          progresso_percentual: { type: 'number', example: 25, description: 'Pode passar de 100' },
          valor_restante: { type: 'number', example: 9000 },
          meses_restantes: { type: 'integer', example: 7 },
          valor_mensal_necessario: { type: 'number', nullable: true, example: 1285.71, description: 'null se o prazo já passou' },
        },
      },
      CreateObjetivoDto: {
        type: 'object',
        required: ['nome', 'tipo', 'valor_objetivo', 'data_final'],
        properties: {
          nome: { type: 'string', maxLength: 255 },
          tipo: { type: 'string', maxLength: 50, description: 'Texto livre (ex.: reserva, viagem, compra)' },
          valor_objetivo: { type: 'number', exclusiveMinimum: true, minimum: 0 },
          valor_mensal: { type: 'number', minimum: 0, default: 0 },
          valor_acumulado: { type: 'number', minimum: 0, default: 0 },
          data_final: { type: 'string', format: 'date' },
        },
      },
      UpdateObjetivoDto: {
        type: 'object',
        description: 'Parcial: mesmas regras de CreateObjetivoDto para os campos enviados.',
        properties: {
          nome: { type: 'string', maxLength: 255 },
          tipo: { type: 'string', maxLength: 50 },
          valor_objetivo: { type: 'number', exclusiveMinimum: true, minimum: 0 },
          valor_mensal: { type: 'number', minimum: 0 },
          valor_acumulado: { type: 'number', minimum: 0 },
          data_final: { type: 'string', format: 'date' },
        },
      },
      Perfil: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          nome: { type: 'string' },
          email: { type: 'string', nullable: true },
          avatar: { type: 'string', nullable: true, description: 'Caminho relativo' },
          avatarUrl: { type: 'string', description: 'URL pública (ou imagem padrão)' },
        },
      },
      TransacaoExtraidaIA: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['entrada', 'saida'] },
          descricao: { type: 'string', example: 'Mercado' },
          valor: { type: 'number', example: 87.5 },
          categoria: { type: 'string', description: 'Nome sugerido pela IA (não é id)', example: 'Alimentação' },
          data: { type: 'string', format: 'date' },
          ispaycart: { type: 'boolean' },
        },
      },
      ErroIA: {
        type: 'object',
        properties: {
          erro: { type: 'string', description: 'Mensagem amigável, pode ser exibida ao usuário' },
          error: { type: 'string' },
          codigo: {
            type: 'string',
            enum: ['MENSAGEM_INVALIDA', 'IMAGEM_INVALIDA', 'IMAGEM_FORMATO', 'IMAGEM_GRANDE', 'IA_INDISPONIVEL', 'IA_LIMITE', 'IA_SEM_RESULTADO'],
          },
        },
      },
      PlannedTransaction: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
          userid: { type: 'integer', example: 1 },
          descricao: { type: 'string', example: 'Salário Mensal Previsto' },
          tipo: { type: 'string', enum: ['RECEITA', 'DESPESA'], example: 'RECEITA' },
          valor: { type: 'number', example: 5000.0 },
          data_prevista: { type: 'string', format: 'date', example: '2026-11-05' },
          idcategoria: { type: 'integer', nullable: true, example: 1 },
          categoria_nome: { type: 'string', nullable: true, example: 'Salário' },
          categoria_icone: { type: 'string', nullable: true, example: 'cash-outline' },
          recorrencia: { type: 'string', enum: ['NONE', 'MENSAL', 'SEMANAL', 'ANUAL'], example: 'MENSAL' },
          data_limite_recorrencia: { type: 'string', format: 'date', nullable: true, example: null },
          status: { type: 'string', enum: ['PENDING', 'SETTLED', 'SKIPPED', 'CANCELLED'], example: 'PENDING' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreatePlannedTransactionDto: {
        type: 'object',
        required: ['descricao', 'tipo', 'valor', 'data_prevista'],
        properties: {
          descricao: { type: 'string', example: 'Boleto de Internet' },
          tipo: { type: 'string', enum: ['RECEITA', 'DESPESA'], example: 'DESPESA' },
          valor: { type: 'number', example: 129.9 },
          data_prevista: { type: 'string', format: 'date', example: '2026-11-15' },
          idcategoria: { type: 'integer', nullable: true, example: 3 },
          recorrencia: { type: 'string', enum: ['NONE', 'MENSAL', 'SEMANAL', 'ANUAL'], default: 'NONE', example: 'MENSAL' },
          data_limite_recorrencia: { type: 'string', format: 'date', nullable: true, example: '2027-11-15' },
          status: { type: 'string', enum: ['PENDING', 'SETTLED', 'SKIPPED', 'CANCELLED'], default: 'PENDING', example: 'PENDING' },
        },
      },
      UpdatePlannedTransactionDto: {
        type: 'object',
        properties: {
          descricao: { type: 'string', example: 'Boleto de Internet com Desconto' },
          tipo: { type: 'string', enum: ['RECEITA', 'DESPESA'], example: 'DESPESA' },
          valor: { type: 'number', example: 119.9 },
          data_prevista: { type: 'string', format: 'date', example: '2026-11-14' },
          idcategoria: { type: 'integer', nullable: true, example: 3 },
          recorrencia: { type: 'string', enum: ['NONE', 'MENSAL', 'SEMANAL', 'ANUAL'], example: 'MENSAL' },
          data_limite_recorrencia: { type: 'string', format: 'date', nullable: true, example: '2027-11-14' },
          status: { type: 'string', enum: ['PENDING', 'SETTLED', 'SKIPPED', 'CANCELLED'], example: 'SETTLED' },
        },
      },
      SettlePlannedTransactionDto: {
        type: 'object',
        properties: {
          valor_pago: { type: 'number', description: 'Valor efetivamente pago/recebido (default: valor original)', example: 129.9 },
          data_pagamento: { type: 'string', format: 'date', description: 'Data da liquidação (default: data atual)', example: '2026-11-15' },
          idcategoria: { type: 'integer', nullable: true, description: 'Categoria opcional para ajuste na quitação', example: 3 },
          descricao: { type: 'string', description: 'Descrição customizada opcional', example: 'Boleto de Internet Pago' },
        },
      },
      SettlePlannedTransactionResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Transação planejada efetivada com sucesso.' },
          transacao: { $ref: '#/components/schemas/Transacao' },
          planned_transaction: { $ref: '#/components/schemas/PlannedTransaction' },
        },
      },
      SettleLoanInstallmentDto: {
        type: 'object',
        properties: {
          valor_pago: { type: 'number', description: 'Valor desembolsado para quitar a parcela (default: original_amount)', example: 450.0 },
          data_pagamento: { type: 'string', format: 'date', description: 'Data do pagamento (default: data atual)', example: '2026-11-15' },
          idcategoria: { type: 'integer', nullable: true, description: 'Categoria financeira associada', example: 8 },
          descricao: { type: 'string', description: 'Descrição customizada opcional', example: 'Parcela Empréstimo #1 - Banco Inter' },
        },
      },
      SettleLoanInstallmentResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Parcela de empréstimo liquidada com sucesso.' },
          transacao: { $ref: '#/components/schemas/Transacao' },
          installment: { $ref: '#/components/schemas/LoanInstallment' },
          loan_paid_off: { type: 'boolean', description: 'True se todas as parcelas foram pagas e o contrato foi quitado', example: false },
        },
      },
      ForecastTimelineEvent: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', example: '2026-11-05' },
          description: { type: 'string', example: 'Salário Mensal' },
          amount: { type: 'number', example: 5000.0 },
          type: { type: 'string', enum: ['RECEITA', 'DESPESA'], example: 'RECEITA' },
          origin: { type: 'string', enum: ['PLANNED', 'LOAN', 'CREDIT_CARD'], example: 'PLANNED' },
          originId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          idcategoria: { type: 'integer', nullable: true, description: 'Só eventos PLANNED; null para LOAN/CREDIT_CARD' },
          categoria_nome: { type: 'string', nullable: true },
        },
      },
      DailyForecastPoint: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', example: '2026-11-05' },
          totalIncome: { type: 'number', example: 5000.0 },
          totalExpense: { type: 'number', example: 0 },
          projectedBalance: { type: 'number', example: 7000.0 },
        },
      },
      MonthlyForecastSummary: {
        type: 'object',
        properties: {
          month: { type: 'string', example: '2026-11' },
          initialBalance: { type: 'number', example: 2000.0 },
          totalIncome: { type: 'number', example: 5000.0 },
          totalExpense: { type: 'number', example: 3000.0 },
          finalBalance: { type: 'number', example: 4000.0 },
          minimumBalance: { type: 'number', example: 2000.0 },
        },
      },
      ForecastSimulationResult: {
        type: 'object',
        properties: {
          isAffordable: { type: 'boolean', example: true },
          projectedBalanceAtTargetDate: { type: 'number', example: 4500.0 },
          remainingMarginAfterTarget: { type: 'number', example: 2000.0 },
          targetAmount: { type: 'number', example: 2500.0 },
          targetDate: { type: 'string', format: 'date', example: '2026-12-15' },
        },
      },
      ForecastResponse: {
        type: 'object',
        properties: {
          currentBalance: { type: 'number', example: 2000.0 },
          finalProjectedBalance: { type: 'number', example: 4000.0 },
          minimumProjectedBalance: { type: 'number', example: 2000.0 },
          safeToSpendToday: { type: 'number', example: 2000.0 },
          simulationResult: { $ref: '#/components/schemas/ForecastSimulationResult' },
          monthlySummaries: {
            type: 'array',
            items: { $ref: '#/components/schemas/MonthlyForecastSummary' },
          },
          events: {
            type: 'array',
            items: { $ref: '#/components/schemas/ForecastTimelineEvent' },
          },
          dailyPoints: {
            type: 'array',
            items: { $ref: '#/components/schemas/DailyForecastPoint' },
          },
        },
      },
    },
  },
};

