import {
  OrigemParcelamento,
  ParcelamentoDetalhes,
} from '@contabilidade/models';
import { ParcelamentoRepository } from './parcelamento.repository';
import { TransacaoNotFoundError } from './transacao.types';

export const ParcelamentoBusiness = {
  async excluir(
    id: string,
    origem: OrigemParcelamento,
    userid: number,
  ): Promise<void> {
    if (!(await ParcelamentoRepository.excluir(id, origem, userid)))
      throw new TransacaoNotFoundError();
  },

  async detalhar(
    id: string,
    origem: OrigemParcelamento,
    userid: number,
  ): Promise<ParcelamentoDetalhes> {
    const rows = await ParcelamentoRepository.listar(id, origem, userid);
    if (!rows.length) throw new TransacaoNotFoundError();
    const parcelas = rows.map((row) => ({
      id: row.id,
      numero: row.numero,
      valor: Number(row.valor),
      vencimento: row.vencimento,
      status: row.status,
    }));
    const totalCentavos = parcelas.reduce(
      (sum, p) => sum + Math.round(p.valor * 100),
      0,
    );
    const pagos = parcelas.filter((p) => p.status === 'pago');
    const pagoCentavos = pagos.reduce(
      (sum, p) => sum + Math.round(p.valor * 100),
      0,
    );
    const totalParcelas = rows[0].quantidade;
    const historicoCompleto =
      parcelas.length === totalParcelas &&
      parcelas.every((p, index) => p.numero === index + 1);
    return {
      id,
      origem,
      descricao: rows[0].descricao,
      totalParcelas,
      historicoCompleto,
      total: totalCentavos / 100,
      totalPago: pagoCentavos / 100,
      saldoRestante: (totalCentavos - pagoCentavos) / 100,
      parcelasPagas: pagos.length,
      parcelasPendentes: parcelas.length - pagos.length,
      progresso: totalCentavos > 0 ? (pagoCentavos / totalCentavos) * 100 : 0,
      parcelas,
    };
  },
};
