# Lançamentos e parcelamentos

O clique em uma parcela abre `/parcelamentos/:id`; lançamentos comuns abrem o formulário em `/lancamentos/:id`. Os links de cartão levam `?origem=cartao`, pois seus identificadores pertencem a `invoice_items`.

## Decisões de projeto

- Mantido o padrão Repository existente: SQL e transações ficam no repositório, validações na camada de negócio e HTTP no controller.
- Um Presenter funcional (`transaction-details.presenter.ts`) calcula totais e progresso sem depender de Angular ou HTTP. A página apenas coordena carregamento, formulário e apresentação. Não há necessidade de uma hierarquia Strategy para dois caminhos de navegação.
- Novas compras parceladas fora do cartão usam `source_type = INSTALLMENT` e o mesmo UUID em `source_id`. Esses campos e seu índice já existem no schema; não há migração. A criação é atômica e distribui diferenças de centavos entre as parcelas.
- As consultas de detalhes usam o identificador da compra e o usuário autenticado, sem filtro mensal. Compras de cartão usam o vínculo `invoice_items.transacao_id` e entram no extrato pelo vencimento da fatura.

## Regras e limites

- Parcelas do cartão são pagas quando a fatura está `PAID`. Pagamentos parciais de faturas não são distribuídos arbitrariamente pelas compras.
- Compras avulsas do cartão permitem editar descrição e valor enquanto a fatura está `OPEN`; data, tipo e status são controlados pela fatura. A atualização mantém compra e item consistentes na mesma instrução SQL.
- A edição comum preserva categoria e outros campos ausentes no formulário e restringe a atualização ao usuário autenticado.
- Parcelas antigas fora do cartão não possuem um vínculo de compra confiável. Permanecem editáveis individualmente; não são agrupadas apenas pelo texto da descrição. Reconstruir esse histórico exige identificar explicitamente quais registros pertencem à mesma compra.

## API

`GET /transacoes/:id/detalhes` retorna `{ lancamento, parcelas, parcelado }`. Para itens de cartão, usar `?origem=cartao`. A resposta é 404 quando o registro não existe para o usuário autenticado.

`PUT /transacoes/:id` atualiza o lançamento comum; `?origem=cartao` atualiza a compra avulsa elegível do cartão. Campos do formulário comum: descrição, valor, data, tipo e status.
