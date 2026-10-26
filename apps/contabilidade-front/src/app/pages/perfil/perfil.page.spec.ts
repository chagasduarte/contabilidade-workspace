import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ToastController } from '@ionic/angular';
import { PerfilUsuario } from '@contabilidade/models';
import { PerfilPage } from './perfil.page';
import { PerfilService } from '../../core/services/perfil.service';
import { CameraService } from '../../core/services/camera.service';

vi.mock('../../core/utils/imagem', () => ({
  reduzirImagem: vi.fn().mockResolvedValue('data:image/jpeg;base64,AAAA'),
  dataUrlParaBlob: vi.fn().mockReturnValue(new Blob(['x'])),
  tamanhoDataUrl: vi.fn().mockReturnValue(1000),
}));

describe('PerfilPage', () => {
  let fixture: ComponentFixture<PerfilPage>;
  let component: PerfilPage;
  const perfil: PerfilUsuario = { id: 7, nome: 'Demo', email: 'demo@x.com', avatar: null, avatarUrl: 'http://api/uploads/noImage.png' };
  let serviceStub: {
    perfil: ReturnType<typeof signal<PerfilUsuario | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    carregar: ReturnType<typeof vi.fn>;
    atualizar: ReturnType<typeof vi.fn>;
    enviarAvatar: ReturnType<typeof vi.fn>;
  };
  let capturar: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    serviceStub = {
      perfil: signal<PerfilUsuario | null>(perfil),
      loading: signal(false),
      error: signal<string | null>(null),
      carregar: vi.fn().mockReturnValue(of(perfil)),
      atualizar: vi.fn().mockReturnValue(of({ ...perfil, nome: 'Novo' })),
      enviarAvatar: vi.fn().mockReturnValue(of(perfil)),
    };
    capturar = vi.fn().mockResolvedValue('data:image/png;base64,BBBB');
    await TestBed.configureTestingModule({
      imports: [PerfilPage],
      providers: [
        provideRouter([]),
        { provide: PerfilService, useValue: serviceStub },
        { provide: CameraService, useValue: { capturar } },
        {
          provide: ToastController,
          useValue: { create: vi.fn().mockResolvedValue({ present: vi.fn().mockResolvedValue(undefined) }) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PerfilPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carrega o perfil no formulário e mostra a inicial quando não há foto', () => {
    expect(component.form.getRawValue()).toEqual({ nome: 'Demo', email: 'demo@x.com' });
    expect(component.temFoto()).toBe(false);
    expect(component.inicial()).toBe('D');
  });

  it('envia só os campos alterados', () => {
    component.form.patchValue({ nome: 'Novo' });
    component.salvar();
    expect(serviceStub.atualizar).toHaveBeenCalledWith({ nome: 'Novo' });
  });

  it('mostra erro de duplicidade no formulário', () => {
    serviceStub.atualizar.mockReturnValue(throwError(() => new Error('Este nome ou e-mail já está em uso por outra conta.')));
    component.form.patchValue({ email: 'outro@x.com' });
    component.salvar();
    expect(component.erroFormulario()).toContain('já está em uso');
  });

  it('troca a foto reduzindo e enviando para /user/:id/avatar', async () => {
    await component.trocarFoto();
    expect(capturar).toHaveBeenCalled();
    expect(serviceStub.enviarAvatar).toHaveBeenCalledWith(7, expect.any(Blob));
  });

  it('não envia nada quando o usuário cancela a câmera', async () => {
    capturar.mockResolvedValue(null);
    await component.trocarFoto();
    expect(serviceStub.enviarAvatar).not.toHaveBeenCalled();
  });
});
