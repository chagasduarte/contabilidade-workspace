import { describe, it, expect, vi } from 'vitest';
import {
  lerPaginacao,
  codificarCursor,
  decodificarCursor,
  responderPaginado,
  PaginacaoInvalidaError,
  PAGINACAO_LIMIT_MAX,
} from './paginacao';

describe('paginacao', () => {
  describe('lerPaginacao', () => {
    it('sem parâmetros não pagina (resposta continua sendo o array completo)', () => {
      expect(lerPaginacao({})).toEqual({ paginado: false, cursor: null, limit: null });
      // limit sozinho não liga a paginação
      expect(lerPaginacao({ limit: '10' }).paginado).toBe(false);
    });

    it('?paginado=true usa limite padrão 50; ?cursor implica paginado', () => {
      expect(lerPaginacao({ paginado: 'true' })).toEqual({ paginado: true, cursor: null, limit: 50 });
      expect(lerPaginacao({ cursor: 'abc', limit: '10' })).toEqual({ paginado: true, cursor: 'abc', limit: 10 });
    });

    it('limita a página ao máximo e rejeita limit inválido', () => {
      expect(lerPaginacao({ paginado: 'true', limit: '5000' }).limit).toBe(PAGINACAO_LIMIT_MAX);
      expect(() => lerPaginacao({ paginado: 'true', limit: '0' })).toThrow(PaginacaoInvalidaError);
      expect(() => lerPaginacao({ paginado: 'true', limit: 'abc' })).toThrow(PaginacaoInvalidaError);
    });
  });

  describe('cursor', () => {
    it('ida e volta preserva a chave (inclusive microssegundos em texto)', () => {
      const chave = { data_prevista: '2026-02-10', created_at: '2026-02-01 10:00:00.123456+00', id: 'x' };
      expect(decodificarCursor(codificarCursor(chave), ['data_prevista', 'created_at', 'id'])).toEqual(chave);
    });

    it('rejeita cursor malformado ou sem os campos esperados', () => {
      expect(() => decodificarCursor('%%%nao-base64', ['id'])).toThrow(PaginacaoInvalidaError);
      expect(() => decodificarCursor(codificarCursor({ outro: 1 }), ['id'])).toThrow(PaginacaoInvalidaError);
    });
  });

  describe('responderPaginado', () => {
    const fakeRes = () => {
      const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
      res.status.mockReturnValue(res);
      return res;
    };

    it('não paginado devolve o array puro', () => {
      const res = fakeRes();
      responderPaginado(res as never, [1, 2], null, false);
      expect(res.json).toHaveBeenCalledWith([1, 2]);
      expect(res.setHeader).not.toHaveBeenCalled();
    });

    it('paginado devolve { items, next_cursor } e o header X-Next-Cursor', () => {
      const res = fakeRes();
      responderPaginado(res as never, [1], 'c1', true);
      expect(res.json).toHaveBeenCalledWith({ items: [1], next_cursor: 'c1' });
      expect(res.setHeader).toHaveBeenCalledWith('X-Next-Cursor', 'c1');
    });

    it('extras (ex.: totais) só aparecem no formato paginado', () => {
      const paginado = fakeRes();
      responderPaginado(paginado as never, [1], null, true, { totais: { entradas: 1 } });
      expect(paginado.json).toHaveBeenCalledWith({ items: [1], next_cursor: null, totais: { entradas: 1 } });

      const array = fakeRes();
      responderPaginado(array as never, [1], null, false, { totais: { entradas: 1 } });
      expect(array.json).toHaveBeenCalledWith([1]);
    });
  });
});
