import { HttpErrorResponse } from '@angular/common/http';
import { mensagemErroHttp } from './http-error';

describe('mensagemErroHttp', () => {
  it('usa mensagem amigável quando não há conexão (status 0)', () => {
    const err = new HttpErrorResponse({ status: 0, url: 'http://x/transacoes' });
    expect(mensagemErroHttp(err, 'Falhou')).toContain('Sem conexão');
  });

  it('prioriza o campo erro da API', () => {
    const err = new HttpErrorResponse({ status: 400, error: { erro: 'Categoria não encontrada.' } });
    expect(mensagemErroHttp(err, 'Falhou')).toBe('Categoria não encontrada.');
  });

  it('usa o fallback quando a API não manda mensagem', () => {
    const err = new HttpErrorResponse({ status: 404 });
    expect(mensagemErroHttp(err, 'Falhou')).toBe('Falhou');
  });

  it('mantém mensagens de erros não HTTP', () => {
    expect(mensagemErroHttp(new Error('Sessão expirada.'), 'Falhou')).toBe('Sessão expirada.');
  });

  it('lê { error: { erro } } de objetos simples', () => {
    expect(mensagemErroHttp({ error: { erro: 'E-mail já cadastrado' } }, 'Falhou')).toBe(
      'E-mail já cadastrado'
    );
  });
});
