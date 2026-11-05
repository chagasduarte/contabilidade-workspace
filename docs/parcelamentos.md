# Detalhes de parcelamento

Implementação sobre o modelo de parcelas da migration existente `004_transacoes_parcelas`.

- Lançamentos de conta e contas planejadas editáveis abrem o **TransactionModal existente** ao clicar na linha.
- Compras com grupo explícito e mais de uma parcela abrem `/parcelamentos/:origem/:grupoId`. O teclado Enter/Espaço oferece a mesma ação; botões internos de pagar, editar e excluir continuam independentes.
- Cartões avulsos e empréstimos preservam a navegação para sua origem. Lançamentos efetivados que já eram somente leitura continuam protegidos.

## Estrutura

A função pura `resolverAcaoLancamento` resolve a ação de cada item (parcelamento, edição, origem ou nenhuma) e pode ser testada sem Angular. Não foi criada uma hierarquia Strategy: os caminhos atuais são resolvidos por uma união discriminada, sem estado ou algoritmos intercambiáveis que justifiquem classes adicionais.

O Repository consulta os dados de cada origem; a camada de negócio calcula o resumo financeiro em centavos; controller e serviço Angular tratam HTTP. A página usa OnPush, signals e switchMap para cancelar consultas antigas na troca de rota.

## Contrato

`GET /transacoes/parcelamentos/:origem/:grupoId`, autenticado:

- `origem=conta`: `transacoes.parcela_grupo_id`, limitado a `userid`.
- `origem=cartao`: `card_transactions.id`, limitado ao proprietário do cartão.
- Retorna descrição, quantidade esperada, parcelas ordenadas, total, total pago, saldo, contagens, progresso e `historicoCompleto`.
- Não depende do mês nem do cursor do extrato. Pagamento de parcela de cartão acompanha a fatura `PAID`; pagamentos parciais não são distribuídos artificialmente entre compras.

O extrato mantém paginação, totais e identificadores. Foram adicionados apenas `parcela_grupo_id`, `parcela_numero` e `parcela_total` aos registros das origens de conta e cartão.

## Histórico

Sem migration nova ou preenchimento de dados históricos. Registros antigos sem grupo explícito não são associados pela descrição. O backfill manual existente continua separado desta feature.

Se alguma parcela foi removida, a resposta sinaliza histórico incompleto; a tela identifica os valores como parciais e não anuncia quitação. A navegação de volta preserva o mês em memória nos serviços existentes.
