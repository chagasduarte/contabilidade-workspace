import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RateLimitError } from 'groq-sdk';
import { AiBusiness, prepararImagem } from './ai.business';
import { AiError } from './ai.types';
import { ENV } from '../../core/config/env';

const create = vi.fn();

vi.mock('groq-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('groq-sdk')>();
  class GroqFake {
    chat = { completions: { create } };
  }
  return { ...actual, default: GroqFake };
});

// Cabeçalhos mínimos de cada formato, em base64
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(32)]).toString('base64');
const JPEG = Buffer.concat([Buffer.from('ffd8ffe0', 'hex'), Buffer.alloc(32)]).toString('base64');
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)]).toString('base64');

const resposta = (obj: unknown) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });
const transacao = { tipo: 'saida', descricao: 'Mercado', valor: 87.5, categoria: 'Alimentação', data: '2026-10-26' };

async function erroDe(p: Promise<unknown>): Promise<AiError> {
  try {
    await p;
  } catch (e) {
    return e as AiError;
  }
  throw new Error('esperava erro');
}

describe('AiBusiness (/ai/chat)', () => {
  beforeEach(() => {
    create.mockReset();
    ENV.GROQ_API_KEY = 'test-key';
    ENV.AI_VISION_MODEL = 'vision-model';
    ENV.AI_MAX_IMAGE_MB = 4;
  });

  describe('prepararImagem', () => {
    it('detecta o formato pelos bytes (ignora o MIME declarado no data URL)', () => {
      expect(prepararImagem(PNG)).toMatch(/^data:image\/png;base64,/);
      expect(prepararImagem(`data:image/jpeg;base64,${PNG}`)).toMatch(/^data:image\/png;base64,/);
      expect(prepararImagem(JPEG)).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('formato não suportado -> 415', () => {
      expect(() => prepararImagem(GIF)).toThrow(expect.objectContaining({ status: 415, codigo: 'IMAGEM_FORMATO' }));
    });

    it('base64 inválido -> 400', () => {
      expect(() => prepararImagem('isto não é base64!!')).toThrow(expect.objectContaining({ status: 400 }));
    });

    it('acima do limite -> 413 (sem decodificar tudo)', () => {
      ENV.AI_MAX_IMAGE_MB = 0.001; // ~1 KB
      const grande = Buffer.concat([Buffer.from('ffd8ffe0', 'hex'), Buffer.alloc(4096)]).toString('base64');
      expect(() => prepararImagem(grande)).toThrow(expect.objectContaining({ status: 413, codigo: 'IMAGEM_GRANDE' }));
    });
  });

  it('com foto a mensagem é opcional e a imagem vai com o MIME detectado', async () => {
    create.mockResolvedValueOnce(resposta(transacao));

    expect(await AiBusiness.processMessage(undefined, PNG)).toEqual(transacao);
    const [{ model, messages }] = create.mock.calls[0];
    expect(model).toBe('vision-model');
    expect(messages[1].content[0].text).toMatch(/recibo/);
    expect(messages[1].content[1].image_url.url).toMatch(/^data:image\/png;base64,/);
  });

  it('sem mensagem e sem foto -> 400', async () => {
    expect((await erroDe(AiBusiness.processMessage('  ', undefined))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('foto sem modelo de visão configurado -> 503 amigável', async () => {
    ENV.AI_VISION_MODEL = undefined;
    const e = await erroDe(AiBusiness.processMessage('recibo', PNG));
    expect(e.status).toBe(503);
    expect(e.message).not.toMatch(/AI_VISION_MODEL/);
  });

  it('limite do provedor (429) -> 429 amigável', async () => {
    create.mockRejectedValueOnce(new RateLimitError(429, {}, 'rate limited', new Headers()));
    const e = await erroDe(AiBusiness.processMessage('gastei 10 no café', undefined));
    expect(e).toMatchObject({ status: 429, codigo: 'IA_LIMITE' });
  });

  it('IA não retorna transação válida nem na 2ª tentativa -> 422 (antes: 500 com SyntaxError)', async () => {
    create.mockResolvedValueOnce({ choices: [{ message: { content: 'não é json' } }] });
    create.mockResolvedValueOnce({ choices: [{ message: { content: 'ainda não' } }] });
    const e = await erroDe(AiBusiness.processMessage(undefined, PNG));
    expect(e).toMatchObject({ status: 422, codigo: 'IA_SEM_RESULTADO' });
    expect(e.message).toMatch(/foto/);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('corrige na 2ª tentativa', async () => {
    create.mockResolvedValueOnce(resposta({ ...transacao, valor: -1 }));
    create.mockResolvedValueOnce(resposta(transacao));
    expect(await AiBusiness.processMessage('mercado 87,50', undefined)).toEqual(transacao);
  });
});
