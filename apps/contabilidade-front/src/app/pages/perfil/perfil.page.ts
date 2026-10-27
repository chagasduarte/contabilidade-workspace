import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon, IonSpinner, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, cameraOutline, sparklesOutline } from 'ionicons/icons';
import { PerfilService } from '../../core/services/perfil.service';
import { CameraService } from '../../core/services/camera.service';
import { dataUrlParaBlob, reduzirImagem, tamanhoDataUrl } from '../../core/utils/imagem';

/** Limite da API para avatar. */
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, RouterLink, IonButton, IonContent, IonIcon, IonSpinner],
  templateUrl: './perfil.page.html',
  styleUrl: './perfil.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PerfilPage implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly toastController = inject(ToastController);
  private readonly camera = inject(CameraService);
  readonly service = inject(PerfilService);

  readonly salvando = signal(false);
  readonly enviandoFoto = signal(false);
  readonly erroFormulario = signal<string | null>(null);
  readonly fotoFalhou = signal(false);

  readonly inicial = computed(() => (this.service.perfil()?.nome?.trim()?.[0] ?? '?').toUpperCase());
  /** O placeholder padrão da API ("noImage") é trocado pela inicial. */
  readonly temFoto = computed(() => {
    const url = this.service.perfil()?.avatarUrl;
    return !!url && !/noImage\.png$/i.test(url) && !this.fotoFalhou();
  });

  readonly form = new FormGroup({
    nome: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(255)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  constructor() {
    addIcons({ alertCircleOutline, cameraOutline, sparklesOutline });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.carregar();
    }
  }

  carregar(): void {
    this.service.carregar().subscribe({
      next: (p) => {
        this.fotoFalhou.set(false);
        this.form.reset({ nome: p.nome, email: p.email });
      },
      error: () => undefined,
    });
  }

  salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const atual = this.service.perfil();
    const v = this.form.getRawValue();
    const dto: { nome?: string; email?: string } = {};
    if (v.nome.trim() !== atual?.nome) dto.nome = v.nome.trim();
    if (v.email.trim().toLowerCase() !== atual?.email?.toLowerCase()) {
      dto.email = v.email.trim().toLowerCase();
    }
    if (!dto.nome && !dto.email) {
      void this.avisar('Nada para salvar.', 'success');
      return;
    }

    this.salvando.set(true);
    this.erroFormulario.set(null);
    this.service.atualizar(dto).subscribe({
      next: (p) => {
        this.salvando.set(false);
        this.form.reset({ nome: p.nome, email: p.email });
        void this.avisar('Perfil atualizado.', 'success');
      },
      error: (err: Error) => {
        this.salvando.set(false);
        this.erroFormulario.set(err.message);
      },
    });
  }

  async trocarFoto(): Promise<void> {
    const perfil = this.service.perfil();
    if (!perfil || this.enviandoFoto()) return;

    let dataUrl: string | null;
    try {
      dataUrl = await this.camera.capturar('escolher', 1024);
    } catch (err) {
      await this.avisar((err as Error).message);
      return;
    }
    if (!dataUrl) return;

    this.enviandoFoto.set(true);
    try {
      // Avatar não precisa de resolução alta: 512 px em JPEG fica bem abaixo de 2 MB.
      const reduzida = await reduzirImagem(dataUrl, 512, 0.85);
      if (tamanhoDataUrl(reduzida) > AVATAR_MAX_BYTES) {
        throw new Error('A foto ficou grande demais. Tente outra imagem.');
      }
      this.service.enviarAvatar(perfil.id, dataUrlParaBlob(reduzida)).subscribe({
        next: () => {
          this.enviandoFoto.set(false);
          this.fotoFalhou.set(false);
          void this.avisar('Foto atualizada.', 'success');
        },
        error: (err: Error) => {
          this.enviandoFoto.set(false);
          void this.avisar(err.message);
        },
      });
    } catch (err) {
      this.enviandoFoto.set(false);
      await this.avisar((err as Error).message);
    }
  }

  private async avisar(message: string, color: 'success' | 'danger' = 'danger'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      color,
      duration: color === 'danger' ? 4000 : 2500,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}
