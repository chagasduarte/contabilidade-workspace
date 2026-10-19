import { DashboardRepository } from './dashboard.repository';
import {
  DashboardResumoDto,
  ProjecaoMensalDto,
  AgrupamentoCategoriaDto,
  DashboardDespesaItemDto,
} from './dashboard.types';
import { TransacaoEntity } from '../transacao/transacao.types';
import { PlannedTransactionBusiness } from '../planned-transaction/planned-transaction.business';

export const DashboardBusiness = {
  /**
   * Consolida o resumo financeiro mensal unificando:
   * 1. transacoes: apenas o que foi liquidado/pago em conta corrente + pendentes
   * 2. planned_transactions: previsões pendentes (status = 'PENDING') no período
   * 3. loan_installments: parcelas de empréstimo pendentes com vencimento no período
   * 4. card_invoices: faturas de cartão de crédito pendentes no período
   */
  async calcularResumoFinanceiro(
    mes: number,
    ano: number,
    userid: number
  ): Promise<DashboardResumoDto> {
    const dataAtual = new Date();
    const mesAtual = dataAtual.getMonth() + 1;
    const anoAtual = dataAtual.getFullYear();

    // Mantém a janela deslizante de recorrências provisionada
    try {
      await PlannedTransactionBusiness.ensureRollingWindow(userid, 3);
    } catch (err) {
      console.warn('[DashboardBusiness] Erro ao executar ensureRollingWindow:', err);
    }

    // 1. Saldo atual liquidado na conta corrente
    const saldo_atual = await DashboardRepository.getSaldoAtual(mesAtual, anoAtual, userid);

    // 2. Transações de conta corrente do período (pagas e pendentes)
    const transacoesMes = await DashboardRepository.getTransacoesMes(mes, ano, userid);

    let receita_realizada = 0;
    let receita_trans_pendente = 0;
    let gastos_realizados = 0;
    let gastos_trans_pendente = 0;
    let gastos_cartao_trans = 0;

    const despesasLista: DashboardDespesaItemDto[] = [];

    for (const t of transacoesMes) {
      const tipoLower = String(t.tipo || '').toLowerCase();
      const statusLower = String(t.status || '').toLowerCase();
      const valor = Number(t.valor || 0);
      const isPago = statusLower === 'pago' || statusLower === 'paid' || statusLower === 'settled';

      if (tipoLower === 'entrada' || tipoLower === 'receita') {
        if (isPago) {
          receita_realizada += valor;
        } else {
          receita_trans_pendente += valor;
        }
      } else {
        // Despesa ou saída de conta corrente / cartão
        if (isPago) {
          gastos_realizados += valor;
        } else {
          gastos_trans_pendente += valor;
        }

        if (tipoLower === 'cartao' || t.cartaoid) {
          gastos_cartao_trans += valor;
        }

        despesasLista.push({
          id: t.id,
          descricao: t.descricao || 'Despesa',
          tipo: tipoLower === 'cartao' ? 'cartao' : 'saida',
          valor,
          categoria: (t as unknown as { categoria?: string }).categoria || 'Geral',
          data: String(t.data),
          status: isPago ? 'pago' : 'pendente',
          origem: 'CONTA',
          origem_rotulo: 'Conta Corrente',
          target_id: String(t.id),
        });
      }
    }

    // 3. Planned Transactions pendentes no período
    const plannedMes = await DashboardRepository.getPlannedTransactionsMes(mes, ano, userid);
    let planned_receita_pendente = 0;
    let planned_despesa_pendente = 0;

    for (const p of plannedMes) {
      const tipoUpper = String(p.tipo || '').toUpperCase();
      if (tipoUpper === 'RECEITA') {
        planned_receita_pendente += p.valor;
      } else {
        planned_despesa_pendente += p.valor;
        const isRecorrente = p.recorrencia === 'MENSAL' || Boolean(p.parent_recurrence_id);
        despesasLista.push({
          id: `plan-${p.id}`,
          descricao: p.descricao,
          tipo: 'saida',
          valor: p.valor,
          categoria: p.categoria_nome || (isRecorrente ? 'Despesa Fixa' : 'Planejado Avulso'),
          data: p.data_prevista,
          status: 'pendente',
          origem: 'AVULSO',
          origem_rotulo: isRecorrente ? 'Recorrente' : 'Avulso',
          target_id: String(p.id),
          recorrencia: p.recorrencia,
          parent_recurrence_id: p.parent_recurrence_id,
          is_recorrente: isRecorrente,
        });
      }
    }

    // 4. Loan Installments pendentes com vencimento no período
    const loansMes = await DashboardRepository.getLoanInstallmentsMes(mes, ano, userid);
    let loan_despesa_pendente = 0;

    for (const l of loansMes) {
      loan_despesa_pendente += l.valor;
      despesasLista.push({
        id: `loan-${l.id}`,
        descricao: `Parcela ${l.installment_number} - ${l.institution_name}`,
        tipo: 'saida',
        valor: l.valor,
        categoria: 'Empréstimos',
        data: l.due_date,
        status: 'pendente',
        origem: 'EMPRESTIMO',
        origem_rotulo: 'Empréstimo',
        target_id: String(l.id),
        detalhes: {
          numero_parcela: l.installment_number,
          instituicao: l.institution_name,
        },
      });
    }

    // 5. Faturas de Cartão de Crédito pendentes no período
    const invoicesMes = await DashboardRepository.getCardInvoicesMes(mes, ano, userid);
    let invoices_pendente = 0;

    for (const inv of invoicesMes) {
      invoices_pendente += inv.valor_restante;
      despesasLista.push({
        id: `card-${inv.id}`,
        descricao: `Fatura ${inv.nome_cartao} (${inv.mes_referencia}/${inv.ano_referencia})`,
        tipo: 'cartao',
        valor: inv.valor_restante,
        categoria: 'Cartão de Crédito',
        data: inv.data_vencimento,
        status: 'pendente',
        origem: 'CARTAO',
        origem_rotulo: 'Cartão',
        target_id: String(inv.id),
        detalhes: {
          cartao_nome: inv.nome_cartao,
          mes_referencia: inv.mes_referencia,
          ano_referencia: inv.ano_referencia,
        },
      });
    }

    // Ordena lista unificada de despesas e dívidas por data decrescente
    despesasLista.sort((a, b) => {
      const timeA = new Date(a.data).getTime();
      const timeB = new Date(b.data).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeB - timeA;
      }
      return String(b.id).localeCompare(String(a.id));
    });

    // Consolidação dos Totais Unificados
    const receita_mensal_pendente = Number((receita_trans_pendente + planned_receita_pendente).toFixed(2));
    const receita_mensal = Number((receita_realizada + receita_mensal_pendente).toFixed(2));

    const total_dividas_mes = Number(
      (gastos_trans_pendente + planned_despesa_pendente + loan_despesa_pendente + invoices_pendente).toFixed(2)
    );
    const gastos_mensal_pendente = total_dividas_mes;
    const gastos_mensal = Number((gastos_realizados + total_dividas_mes).toFixed(2));

    const gastos_cartao = Number((gastos_cartao_trans + invoices_pendente).toFixed(2));

    // Saldo projetado = Saldo atual em conta corrente + Receitas previstas pendentes - Total de dívidas pendentes
    const saldo_projetado = Number((saldo_atual + receita_mensal_pendente - total_dividas_mes).toFixed(2));
    const saldo_acumulado = saldo_projetado;

    const hasSome =
      saldo_atual > 0 ||
      gastos_mensal > 0 ||
      receita_mensal > 0 ||
      total_dividas_mes > 0 ||
      saldo_projetado !== 0 ||
      gastos_cartao > 0 ||
      despesasLista.length > 0;

    return {
      saldo_atual: Number(saldo_atual.toFixed(2)),
      gastos_mensal,
      receita_mensal,
      gastos_mensal_pendente,
      receita_mensal_pendente,
      saldo_acumulado,
      saldo_projetado,
      total_dividas_mes,
      gastos_cartao,
      hasSome,
      despesas_mes: despesasLista,
    };
  },

  async listarDespesasUnificadas(
    mes: number,
    ano: number,
    userid: number
  ): Promise<DashboardDespesaItemDto[]> {
    const resumo = await this.calcularResumoFinanceiro(mes, ano, userid);
    return resumo.despesas_mes ?? [];
  },

  async filtrarTransacoes(
    tipo?: string | null,
    status?: string | null,
    userid?: number
  ): Promise<TransacaoEntity[]> {
    return await DashboardRepository.getTransacoes(tipo, status, userid);
  },

  async buscaProjecao(ano: number | string, userid: number): Promise<ProjecaoMensalDto[]> {
    try {
      await PlannedTransactionBusiness.ensureRollingWindow(userid, 3);
    } catch (err) {
      console.warn('[DashboardBusiness] Erro ao executar ensureRollingWindow em buscaProjecao:', err);
    }
    return await DashboardRepository.getProjecaoMensal(ano, userid);
  },

  async getAgrupamentoCategorias(ano: number | string, userid: number): Promise<AgrupamentoCategoriaDto[]> {
    return await DashboardRepository.getAgrupamentoCategoria(ano, userid);
  },
};
