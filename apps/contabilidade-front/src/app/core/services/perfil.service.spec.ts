import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PerfilService } from './perfil.service';
import { API_URL } from './categoria.service';
import { AuthService } from './auth.service';

describe('PerfilService', () => {
  let service: PerfilService;
  let http: HttpTestingController;
  const atualizarUsuarioLocal = vi.fn();
  const api = 'http://api';
  const perfil = { id: 7, nome: 'Demo', email: 'demo@x.com', avatar: null, avatarUrl: 'http://api/uploads/noImage.png' };

  beforeEach(() => {
    atualizarUsuarioLocal.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: api },
        { provide: AuthService, useValue: { atualizarUsuarioLocal } },
      ],
    });
    service = TestBed.inject(PerfilService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carrega /user/me e sincroniza a sessão', () => {
    service.carregar().subscribe();
    http.expectOne(`${api}/user/me`).flush(perfil);
    expect(service.perfil()?.nome).toBe('Demo');
    expect(atualizarUsuarioLocal).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Demo' }));
  });

  it('traduz 409 em mensagem de duplicidade', () => {
    let msg = '';
    service.atualizar({ email: 'outro@x.com' }).subscribe({ error: (e: Error) => (msg = e.message) });
    http.expectOne({ method: 'PUT', url: `${api}/user/me` }).flush({}, { status: 409, statusText: 'Conflict' });
    expect(msg).toContain('já está em uso');
  });

  it('envia o avatar em multipart e recarrega o perfil', () => {
    service.enviarAvatar(7, new Blob(['x'], { type: 'image/jpeg' })).subscribe();
    const up = http.expectOne({ method: 'POST', url: `${api}/user/7/avatar` });
    expect(up.request.body instanceof FormData).toBe(true);
    expect((up.request.body as FormData).get('avatar')).toBeTruthy();
    up.flush({ message: 'ok' });
    http.expectOne(`${api}/user/me`).flush({ ...perfil, avatarUrl: 'http://api/uploads/a.jpg' });
    expect(service.perfil()?.avatarUrl).toBe('http://api/uploads/a.jpg');
  });
});
