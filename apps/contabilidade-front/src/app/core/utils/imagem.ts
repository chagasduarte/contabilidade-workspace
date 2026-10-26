/**
 * Reduz uma imagem (data URL) para caber em `maxLado` px e recomprime em JPEG.
 * Recibos ficam legíveis com ~1600 px; avatares com ~512 px.
 */
export async function reduzirImagem(
  dataUrl: string,
  maxLado = 1600,
  qualidade = 0.8
): Promise<string> {
  const img = await carregar(dataUrl);
  const escala = Math.min(1, maxLado / Math.max(img.naturalWidth, img.naturalHeight));
  const largura = Math.max(1, Math.round(img.naturalWidth * escala));
  const altura = Math.max(1, Math.round(img.naturalHeight * escala));

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  // Fundo branco: PNG com transparência não vira preto no JPEG.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(img, 0, 0, largura, altura);
  return canvas.toDataURL('image/jpeg', qualidade);
}

/** Converte data URL em Blob (para upload multipart). */
export function dataUrlParaBlob(dataUrl: string): Blob {
  const [cabecalho, base64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(cabecalho)?.[1] ?? 'image/jpeg';
  const bin = atob(base64 ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Tamanho aproximado em bytes do conteúdo de um data URL base64. */
export function tamanhoDataUrl(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = src;
  });
}
