import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export type OrigemFoto = 'camera' | 'galeria' | 'escolher';

/**
 * Captura de fotos via @capacitor/camera (Android nativo; no navegador usa o seletor de arquivo).
 * Resolve `null` quando o usuário cancela.
 */
@Injectable({
  providedIn: 'root',
})
export class CameraService {
  async capturar(origem: OrigemFoto = 'escolher', maxLado = 1600): Promise<string | null> {
    const source =
      origem === 'camera'
        ? CameraSource.Camera
        : origem === 'galeria'
          ? CameraSource.Photos
          : CameraSource.Prompt;
    try {
      const foto = await Camera.getPhoto({
        source,
        resultType: CameraResultType.DataUrl,
        quality: 80,
        width: maxLado,
        height: maxLado,
        correctOrientation: true,
        promptLabelHeader: 'Foto',
        promptLabelPhoto: 'Escolher da galeria',
        promptLabelPicture: 'Tirar foto',
        promptLabelCancel: 'Cancelar',
      });
      return foto.dataUrl ?? null;
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
      if (msg.includes('cancel')) return null;
      if (msg.includes('denied') || msg.includes('permission')) {
        throw new Error('Permissão de câmera negada. Libere o acesso nas configurações do Android.');
      }
      throw new Error('Não foi possível obter a foto.');
    }
  }
}
