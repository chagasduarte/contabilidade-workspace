import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjetivosBusiness, calcularProgresso } from './objetivos.business';
import { ObjetivosRepository } from './objetivos.repository';
import { ObjetivoEntity, ObjetivoNotFoundError, ObjetivoValidationError } from './objetivos.types';

vi.mock('./objetivos.repository', () => ({
  ObjetivosRepository: {
    criar: vi.fn(),
    listar: vi.fn(),
    buscar: vi.fn(),
    atualizar: vi.fn(),
    deletar: vi.fn(),
    aportar: vi.fn(),
  },
}));

const base: ObjetivoEntity = {
  id: 1,
  usuario_id: 7,
  nome: 'Viagem',
  tipo: 'viagem',
  valor_objetivo: 12000,
  valor_mensal: 1000,
  valor_acumulado: 3000,
  data_final: '2027-06-15',
};

const valido = { nome: 'Viagem', tipo: 'viagem', valor_objetivo: 12000, valor_mensal: 1000, data_final: '2027-06-15' };

describe('ObjetivosBusiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validação', () => {
    it.each([
      [{ ...valido, valor_objetivo: 0 }, 'valor_objetivo deve ser maior que zero.'],
      [{ ...valido, valor_objetivo: 'abc' }, 'valor_objetivo deve ser um número válido.'],
      [{ ...valido, valor_mensal: -1 }, 'valor_mensal não pode ser negativo.'],
      [{ ...valido, valor_acumulado: -5 }, 'valor_acumulado não pode ser negativo.'],
      [{ ...valido, tipo: '   ' }, 'tipo é obrigatório.'],
      [{ ...valido, nome: '' }, 'nome é obrigatório.'],
      [{ ...valido, data_final: '2026-02-30' }, 'data_final deve ser uma data válida no formato YYYY-MM-DD.'],
      [{ ...valido, data_final: '15/06/2027' }, 'data_final deve ser uma data válida no formato YYYY-MM-DD.'],
    ])('rejeita %o', async (dto, mensagem) => {
      await expect(ObjetivosBusiness.criar(dto as never, 7)).rejects.toThrow(mensagem);
      expect(ObjetivosRepository.criar).not.toHaveBeenCalled();
    });

    it('aceita valores numéricos em string e normaliza', async () => {
      vi.mocked(ObjetivosRepository.criar).mockResolvedValueOnce(base);
      await ObjetivosBusiness.criar({ ...valido, valor_objetivo: '12000' as never, nome: '  Viagem ' }, 7);
      expect(ObjetivosRepository.criar).toHaveBeenCalledWith(
        expect.objectContaining({ nome: 'Viagem', valor_objetivo: 12000 }),
        7
      );
    });

    it('PUT valida só os campos enviados', async () => {
      vi.mocked(ObjetivosRepository.atualizar).mockResolvedValueOnce({ ...base, valor_acumulado: 4000 });
      await ObjetivosBusiness.atualizar('1', { valor_acumulado: 4000 }, 7);
      expect(ObjetivosRepository.atualizar).toHaveBeenCalledWith('1', { valor_acumulado: 4000 }, 7);

      await expect(ObjetivosBusiness.atualizar('1', { valor_objetivo: -1 }, 7)).rejects.toBeInstanceOf(
        ObjetivoValidationError
      );
    });
  });

  describe('dono e não encontrado', () => {
    it('buscar repassa o userid e responde 404 quando não é do usuário', async () => {
      vi.mocked(ObjetivosRepository.buscar).mockResolvedValueOnce(undefined);
      await expect(ObjetivosBusiness.buscar('1', 8)).rejects.toBeInstanceOf(ObjetivoNotFoundError);
      expect(ObjetivosRepository.buscar).toHaveBeenCalledWith('1', 8);
    });

    it('PUT e DELETE de objetivo alheio/inexistente -> 404', async () => {
      vi.mocked(ObjetivosRepository.atualizar).mockResolvedValueOnce(undefined);
      vi.mocked(ObjetivosRepository.deletar).mockResolvedValueOnce(false);
      await expect(ObjetivosBusiness.atualizar('1', { nome: 'X' }, 8)).rejects.toBeInstanceOf(ObjetivoNotFoundError);
      await expect(ObjetivosBusiness.deletar('1', 8)).rejects.toBeInstanceOf(ObjetivoNotFoundError);
    });

    it('id não numérico não chega ao banco', async () => {
      await expect(ObjetivosBusiness.buscar('abc', 7)).rejects.toBeInstanceOf(ObjetivoNotFoundError);
      expect(ObjetivosRepository.buscar).not.toHaveBeenCalled();
    });
  });

  describe('aportar (POST /objetivos/:id/aportes)', () => {
    it('soma no banco (sem ler antes) e devolve o objetivo com progresso', async () => {
      vi.mocked(ObjetivosRepository.aportar).mockResolvedValueOnce({ ...base, valor_acumulado: 3250.5 });

      const r = await ObjetivosBusiness.aportar('1', { valor: '250.50' }, 7);

      expect(ObjetivosRepository.aportar).toHaveBeenCalledWith('1', 250.5, 7);
      expect(ObjetivosRepository.buscar).not.toHaveBeenCalled();
      expect(r.valor_acumulado).toBe(3250.5);
      expect(r.progresso_percentual).toBe(27.09);
    });

    it.each([
      [{ valor: 0 }, 'valor deve ser maior que zero.'],
      [{ valor: -10 }, 'valor deve ser maior que zero.'],
      [{}, 'valor deve ser um número válido.'],
      [{ valor: 'abc' }, 'valor deve ser um número válido.'],
      [{ valor: 10.001 }, 'valor deve ter no máximo 2 casas decimais.'],
      [{ valor: 1e11 }, 'valor acima do limite permitido.'],
    ])('rejeita %o', async (dados, mensagem) => {
      await expect(ObjetivosBusiness.aportar('1', dados, 7)).rejects.toThrow(mensagem);
      expect(ObjetivosRepository.aportar).not.toHaveBeenCalled();
    });

    it('objetivo de outro usuário/inexistente -> 404', async () => {
      vi.mocked(ObjetivosRepository.aportar).mockResolvedValueOnce(undefined);
      await expect(ObjetivosBusiness.aportar('1', { valor: 10 }, 8)).rejects.toBeInstanceOf(ObjetivoNotFoundError);
    });

    it('soma que estoura NUMERIC(12,2) (22003) -> 400', async () => {
      vi.mocked(ObjetivosRepository.aportar).mockRejectedValueOnce(Object.assign(new Error('overflow'), { code: '22003' }));
      await expect(ObjetivosBusiness.aportar('1', { valor: 10 }, 7)).rejects.toThrow(
        'O valor acumulado ultrapassaria o limite permitido.'
      );
    });
  });

  describe('calcularProgresso', () => {
    const hoje = new Date(Date.UTC(2026, 9, 26)); // 2026-10-26

    it('calcula percentual, restante, meses e mensal necessário', () => {
      const p = calcularProgresso(base, hoje);
      expect(p.progresso_percentual).toBe(25);
      expect(p.valor_restante).toBe(9000);
      // 2026-10-26 -> 2027-06-15: 7 meses completos (o dia 15 vem antes do 26)
      expect(p.meses_restantes).toBe(7);
      expect(p.valor_mensal_necessario).toBe(1285.71);
    });

    it('prazo vencido: meses 0 e mensal necessário null; acima da meta: restante 0', () => {
      const p = calcularProgresso({ ...base, data_final: '2026-01-01', valor_acumulado: 15000 }, hoje);
      expect(p.meses_restantes).toBe(0);
      expect(p.valor_mensal_necessario).toBeNull();
      expect(p.valor_restante).toBe(0);
      expect(p.progresso_percentual).toBe(125);
    });
  });
});
