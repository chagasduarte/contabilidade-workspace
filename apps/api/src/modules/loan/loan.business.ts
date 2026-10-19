import {
  CreateLoanDto,
  RegisterPaymentDto,
  LoanSummaryDto,
} from './loan.dto';
import {
  LoanEntity,
  LoanInstallmentEntity,
} from './loan.entity';
import {
  LoanRepository,
  CreateInstallmentInput,
  normalizeUserIdToUuid,
} from './loan.repository';
import {
  LoanPaymentRepository,
  RegisterPaymentResult,
} from './loan-payment.repository';

export class LoanValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanValidationError';
  }
}

export class LoanNotFoundError extends Error {
  constructor(message = 'Empréstimo não encontrado.') {
    super(message);
    this.name = 'LoanNotFoundError';
  }
}

export class InstallmentNotFoundError extends Error {
  constructor(message = 'Parcela não encontrada para este empréstimo.') {
    super(message);
    this.name = 'InstallmentNotFoundError';
  }
}

/**
 * Calcula a data de vencimento da parcela k com tratamento seguro de viradas de mês/ano
 * e limites de dias (ex: 31 de janeiro -> 28/29 de fevereiro).
 */
export function calcularDataVencimento(primeiroVencimentoIso: string, parcelaIndex: number): Date {
  const parts = primeiroVencimentoIso.split('-').map(Number);
  const anoInicial = parts[0];
  const mesInicial = parts[1] - 1; // 0-indexed no JS Date
  const diaDesejado = parts[2];

  const anoAlvo = anoInicial + Math.floor((mesInicial + parcelaIndex) / 12);
  const mesAlvo = (mesInicial + parcelaIndex) % 12;

  // Dia 0 do mês seguinte obtém o último dia do mês alvo
  const ultimoDiaMesAlvo = new Date(Date.UTC(anoAlvo, mesAlvo + 1, 0)).getUTCDate();
  const diaFinal = Math.min(diaDesejado, ultimoDiaMesAlvo);

  return new Date(Date.UTC(anoAlvo, mesAlvo, diaFinal));
}

export const LoanBusiness = {
  /**
   * Cria um contrato de empréstimo e gera seu cronograma de parcelas separando
   * os componentes de amortização do principal e a projeção de juros.
   */
  async criarEmprestimo(
    dto: CreateLoanDto
  ): Promise<{ emprestimo: LoanEntity; parcelas: LoanInstallmentEntity[] }> {
    const userId = dto.user_id ?? dto.usuario_id;
    const institutionName = (dto.institution_name ?? dto.instituicao ?? '').trim();
    const principalAmount = Number(dto.principal_amount ?? dto.valor_principal);
    const quantity = Number(dto.total_installments ?? dto.quantidade_parcelas);
    const installmentAmount = Number(dto.installment_amount ?? dto.valor_parcela);
    const monthlyRate = Number(dto.monthly_interest_rate ?? dto.taxa_juros_mensal);
    const firstDueDate = dto.first_due_date ?? dto.primeiro_vencimento;

    if (!userId || (typeof userId === 'number' && userId <= 0)) {
      throw new LoanValidationError('Usuário inválido ou não informado.');
    }
    if (!institutionName) {
      throw new LoanValidationError('Instituição financeira é obrigatória.');
    }
    if (isNaN(principalAmount) || principalAmount <= 0) {
      throw new LoanValidationError('O valor principal deve ser maior que zero.');
    }
    if (isNaN(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
      throw new LoanValidationError(
        'A quantidade de parcelas deve ser um número inteiro maior ou igual a 1.'
      );
    }
    if (isNaN(installmentAmount) || installmentAmount <= 0) {
      throw new LoanValidationError('O valor da parcela deve ser maior que zero.');
    }
    if (isNaN(monthlyRate) || monthlyRate < 0) {
      throw new LoanValidationError('A taxa de juros mensal não pode ser negativa.');
    }
    if (!firstDueDate || isNaN(Date.parse(firstDueDate))) {
      throw new LoanValidationError('Data do primeiro vencimento inválida.');
    }

    // Normaliza taxa: se maior ou igual a 1, assume percentual (ex: 2.5% = 0.025)
    const taxaDecimal = monthlyRate >= 1 ? monthlyRate / 100 : monthlyRate;

    let saldoDevedor = principalAmount;
    const parcelasInput: CreateInstallmentInput[] = [];

    for (let i = 1; i <= quantity; i++) {
      const dataVencimento = calcularDataVencimento(firstDueDate, i - 1);

      let valorJuros = 0;
      let valorAmortizacao = 0;

      if (taxaDecimal > 0) {
        valorJuros = Number((saldoDevedor * taxaDecimal).toFixed(2));
        valorAmortizacao = Number((installmentAmount - valorJuros).toFixed(2));

        if (valorAmortizacao < 0) {
          valorAmortizacao = 0;
          valorJuros = installmentAmount;
        }

        // Na última parcela ou se a amortização superar o saldo restante, ajusta para zerar o saldo
        if (i === quantity || valorAmortizacao > saldoDevedor) {
          valorAmortizacao = Number(saldoDevedor.toFixed(2));
          valorJuros = Number(Math.max(0, installmentAmount - valorAmortizacao).toFixed(2));
        }
      } else {
        // Sem incidência de juros
        valorJuros = 0;
        valorAmortizacao = Number(
          (i === quantity
            ? saldoDevedor
            : installmentAmount
          ).toFixed(2)
        );
      }

      saldoDevedor = Math.max(0, Number((saldoDevedor - valorAmortizacao).toFixed(2)));

      parcelasInput.push({
        installment_number: i,
        due_date: dataVencimento,
        original_amount: installmentAmount,
        principal_component: valorAmortizacao,
        interest_component: valorJuros,
        status: 'PENDING',

        // Aliases para compatibilidade
        numero_parcela: i,
        data_vencimento: dataVencimento,
        valor_original: installmentAmount,
        valor_amortizacao: valorAmortizacao,
        valor_juros: valorJuros,
      });
    }

    const userUuid = normalizeUserIdToUuid(userId);

    return await LoanRepository.criarComParcelas(
      {
        user_id: userUuid,
        institution_name: institutionName,
        principal_amount: principalAmount,
        monthly_interest_rate: monthlyRate,
        status: 'ACTIVE',
        contracted_at: new Date(),

        // Aliases
        usuario_id: userId,
        instituicao: institutionName,
        valor_principal: principalAmount,
        taxa_juros_mensal: monthlyRate,
        data_contratacao: new Date(),
      },
      parcelasInput
    );
  },

  /**
   * Efetua o pagamento/amortização de uma parcela com validações financeiras rígidas:
   * - Impede liquidação de parcelas já quitadas
   * - Garante integridade: amount_paid === original_amount - discount_amount + penalty_interest
   * - Atualiza atomicamente a parcela e encerra o empréstimo se for a última
   */
  async registrarPagamento(dto: RegisterPaymentDto): Promise<RegisterPaymentResult> {
    const loanId = (dto.loan_id ?? dto.emprestimo_id ?? '').trim();
    const installmentId = (dto.installment_id ?? dto.parcela_id ?? '').trim();
    const amountPaid = Number(dto.amount_paid ?? dto.valor_pago);
    const discountAmount = Number(dto.discount_amount ?? dto.valor_desconto ?? 0);
    const penaltyInterest = Number(dto.penalty_interest ?? dto.multa_juros ?? 0);
    const paymentMethod = (dto.payment_method ?? dto.metodo_pagamento ?? '').trim();
    const paymentDateRaw = dto.payment_date ?? dto.data_pagamento;
    const paymentDate = paymentDateRaw ? new Date(paymentDateRaw) : new Date();

    if (!loanId) {
      throw new LoanValidationError('ID do empréstimo é obrigatório.');
    }
    if (!installmentId) {
      throw new LoanValidationError('ID da parcela é obrigatório.');
    }
    if (isNaN(amountPaid) || amountPaid <= 0) {
      throw new LoanValidationError('Valor pago deve ser maior que zero.');
    }
    if (!paymentMethod) {
      throw new LoanValidationError('Método de pagamento é obrigatório.');
    }
    if (discountAmount < 0) {
      throw new LoanValidationError('O valor de desconto não pode ser negativo.');
    }
    if (penaltyInterest < 0) {
      throw new LoanValidationError('O valor de multa/juros não pode ser negativo.');
    }

    const emprestimo = await LoanRepository.buscarPorId(loanId);
    if (!emprestimo) {
      throw new LoanNotFoundError('Empréstimo não encontrado.');
    }

    const parcela = await LoanRepository.buscarParcelaPorId(installmentId);
    if (!parcela || (parcela.loan_id !== loanId && parcela.emprestimo_id !== loanId)) {
      throw new InstallmentNotFoundError('Parcela não encontrada para este empréstimo.');
    }

    if (parcela.status === 'PAID') {
      throw new LoanValidationError('Esta parcela já foi quitada.');
    }

    const valorOriginal = Number(parcela.original_amount ?? parcela.valor_original);
    const valorEsperado = Number((valorOriginal - discountAmount + penaltyInterest).toFixed(2));

    if (Math.abs(amountPaid - valorEsperado) > 0.01) {
      throw new LoanValidationError(
        `Inconsistência financeira: o valor pago (R$ ${amountPaid.toFixed(
          2
        )}) deve corresponder exatamente a: valor original (R$ ${valorOriginal.toFixed(
          2
        )}) - desconto (R$ ${discountAmount.toFixed(2)}) + multa/juros (R$ ${penaltyInterest.toFixed(
          2
        )}) = R$ ${valorEsperado.toFixed(2)}.`
      );
    }

    return await LoanPaymentRepository.registrarPagamento({
      loan_id: loanId,
      installment_id: installmentId,
      payment_date: paymentDate,
      amount_paid: amountPaid,
      discount_amount: discountAmount,
      penalty_interest: penaltyInterest,
      payment_method: paymentMethod,

      // Aliases
      emprestimo_id: loanId,
      parcela_id: installmentId,
      data_pagamento: paymentDate,
      valor_pago: amountPaid,
      valor_desconto: discountAmount,
      multa_juros: penaltyInterest,
      metodo_pagamento: paymentMethod,
    });
  },

  /**
   * Gera o consolidado financeiro do empréstimo:
   * - Total desembolsado até o momento
   * - Total economizado com abatimento de juros/descontos
   * - Saldo devedor restante projetado das parcelas pendentes
   */
  async obterResumo(
    loanId: string,
    userId?: number | string
  ): Promise<LoanSummaryDto> {
    if (!loanId || !loanId.trim()) {
      throw new LoanValidationError('ID do empréstimo é obrigatório.');
    }

    const emprestimo = await LoanRepository.buscarPorId(loanId, userId);
    if (!emprestimo) {
      throw new LoanNotFoundError('Empréstimo não encontrado.');
    }

    const [parcelas, pagamentos] = await Promise.all([
      LoanRepository.listarParcelas(loanId),
      LoanPaymentRepository.listarPagamentosPorEmprestimo(loanId),
    ]);

    const totalDesembolsado = pagamentos.reduce(
      (acc, p) => acc + Number(p.amount_paid ?? p.valor_pago ?? 0),
      0
    );

    const totalDescontos = pagamentos.reduce(
      (acc, p) => acc + Number(p.discount_amount ?? p.valor_desconto ?? 0),
      0
    );

    const saldoDevedorRestante = parcelas
      .filter((p) => p.status !== 'PAID')
      .reduce((acc, p) => acc + Number(p.original_amount ?? p.valor_original ?? 0), 0);

    return {
      loan: emprestimo,
      installments: parcelas,
      total_paid: Number(totalDesembolsado.toFixed(2)),
      total_discounts: Number(totalDescontos.toFixed(2)),
      remaining_balance: Number(saldoDevedorRestante.toFixed(2)),

      // Aliases para compatibilidade
      emprestimo,
      parcelas,
      total_desembolsado: Number(totalDesembolsado.toFixed(2)),
      total_descontos: Number(totalDescontos.toFixed(2)),
      saldo_devedor_restante: Number(saldoDevedorRestante.toFixed(2)),
    };
  },

  /**
   * Lista todos os empréstimos de um determinado usuário.
   */
  async listarPorUsuario(userId: number | string): Promise<LoanEntity[]> {
    if (!userId || (typeof userId === 'number' && userId <= 0)) {
      throw new LoanValidationError('Usuário inválido.');
    }
    return await LoanRepository.listarPorUsuario(userId);
  },

  /**
   * Busca um empréstimo por ID com validação de permissão de usuário.
   */
  async buscarPorId(
    loanId: string,
    userId?: number | string
  ): Promise<{
    loan: LoanEntity;
    installments: LoanInstallmentEntity[];
    emprestimo: LoanEntity;
    parcelas: LoanInstallmentEntity[];
  }> {
    const emprestimo = await LoanRepository.buscarPorId(loanId, userId);
    if (!emprestimo) {
      throw new LoanNotFoundError('Empréstimo não encontrado.');
    }

    const parcelas = await LoanRepository.listarParcelas(loanId);
    return {
      loan: emprestimo,
      installments: parcelas,
      emprestimo,
      parcelas,
    };
  },
};
