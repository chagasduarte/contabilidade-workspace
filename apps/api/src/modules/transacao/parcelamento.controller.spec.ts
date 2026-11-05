import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { TransacaoController } from './transacao.controller';
import { ParcelamentoBusiness } from './parcelamento.business';
import { TransacaoNotFoundError } from './transacao.types';
vi.mock('./parcelamento.business', () => ({
  ParcelamentoBusiness: { detalhar: vi.fn(), excluir: vi.fn() },
}));
vi.mock('./transacao.business', () => ({ TransacaoBusiness: {} }));
const grupoId = '12345678-1234-1234-1234-123456789abc';
describe('GET detalhes do parcelamento', () => {
  beforeEach(() => vi.resetAllMocks());
  async function call(
    usuarioId: number | undefined,
    origem = 'conta',
    id = grupoId,
  ) {
    const req = {
      usuarioId,
      params: { origem, grupoId: id },
    } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await TransacaoController.detalharParcelamento(
      req,
      res as unknown as Response,
    );
    return res;
  }
  it('exige autenticação e valida origem e UUID antes da consulta', async () => {
    expect((await call(undefined)).status).toHaveBeenCalledWith(401);
    expect((await call(7, 'outra')).status).toHaveBeenCalledWith(400);
    expect((await call(7, 'conta', 'invalido')).status).toHaveBeenCalledWith(
      400,
    );
    expect(ParcelamentoBusiness.detalhar).not.toHaveBeenCalled();
  });
  it('consulta com o usuário da sessão', async () => {
    vi.mocked(ParcelamentoBusiness.detalhar).mockResolvedValue({
      id: grupoId,
    } as never);
    const res = await call(7, 'cartao');
    expect(ParcelamentoBusiness.detalhar).toHaveBeenCalledWith(
      grupoId,
      'cartao',
      7,
    );
    expect(res.json).toHaveBeenCalledWith({ id: grupoId });
  });
  it('retorna 404 para registros indisponíveis e não expõe falhas internas', async () => {
    vi.mocked(ParcelamentoBusiness.detalhar)
      .mockRejectedValueOnce(new TransacaoNotFoundError())
      .mockRejectedValueOnce(new Error('SQL interno'));
    expect((await call(7)).status).toHaveBeenCalledWith(404);
    const res = await call(7);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      erro: 'Erro ao consultar parcelamento',
    });
  });
});

describe('DELETE parcelamento', () => {
  beforeEach(() => vi.resetAllMocks());
  async function excluir(usuarioId?: number, origem = 'conta', id = grupoId) {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
      send: vi.fn(),
    };
    await TransacaoController.excluirParcelamento(
      { usuarioId, params: { origem, grupoId: id } } as unknown as Request,
      res as unknown as Response,
    );
    return res;
  }
  it('exige autenticação e parâmetros válidos', async () => {
    expect((await excluir()).status).toHaveBeenCalledWith(401);
    expect((await excluir(7, 'outra')).status).toHaveBeenCalledWith(400);
    expect((await excluir(7, 'conta', 'invalido')).status).toHaveBeenCalledWith(
      400,
    );
    expect(ParcelamentoBusiness.excluir).not.toHaveBeenCalled();
  });
  it('retorna 204 após exclusão restrita ao dono', async () => {
    vi.mocked(ParcelamentoBusiness.excluir).mockResolvedValue(undefined);
    const res = await excluir(7, 'cartao');
    expect(ParcelamentoBusiness.excluir).toHaveBeenCalledWith(
      grupoId,
      'cartao',
      7,
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledOnce();
  });
  it('informa ausência e falha sem expor informações internas', async () => {
    vi.mocked(ParcelamentoBusiness.excluir)
      .mockRejectedValueOnce(new TransacaoNotFoundError())
      .mockRejectedValueOnce(new Error('SQL privado'));
    expect((await excluir(7)).status).toHaveBeenCalledWith(404);
    const res = await excluir(7);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro ao excluir compra' });
  });
});
