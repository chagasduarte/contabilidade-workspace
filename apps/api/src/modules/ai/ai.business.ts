import Groq, { APIConnectionError, APIError, RateLimitError } from 'groq-sdk';
import { ENV } from '../../core/config/env';
import { AiError, ExtractedTransactionDto } from './ai.types';

const MENSAGEM_MAX = 2000;
const PROMPT_RECIBO_PADRAO = 'Extraia a transação deste recibo/comprovante.';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function isValidTransaction(obj: unknown): obj is ExtractedTransactionDto {
  if (!obj || typeof obj !== 'object') return false;

  const record = obj as Record<string, unknown>;
  const allowedKeys = new Set(['tipo', 'descricao', 'valor', 'categoria', 'data', 'ispaycart']);
  for (const k of Object.keys(record)) {
    if (!allowedKeys.has(k)) return false;
  }

  if (record.tipo !== 'entrada' && record.tipo !== 'saida') return false;
  if (typeof record.descricao !== 'string' || !record.descricao.trim()) return false;
  if (typeof record.categoria !== 'string' || !record.categoria.trim()) return false;

  if (typeof record.valor !== 'number' || !Number.isFinite(record.valor) || record.valor <= 0) {
    return false;
  }

  if (typeof record.data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.data)) {
    return false;
  }

  if (record.ispaycart !== undefined && typeof record.ispaycart !== 'boolean') {
    return false;
  }

  return true;
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Valida a imagem do recibo: aceita base64 cru ou data URL (`data:image/...;base64,`),
 * confere o tamanho decodificado e detecta o formato pelos bytes iniciais (não confia no prefixo).
 * Retorna a data URL normalizada com o MIME real.
 */
export function prepararImagem(base64Image: unknown): string {
  if (typeof base64Image !== 'string' || !base64Image.trim()) {
    throw new AiError('A imagem do recibo está vazia ou em formato inválido.', 400, 'IMAGEM_INVALIDA');
  }

  const dados = base64Image.trim().replace(/^data:[^;,]*;base64,/i, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/_-]+={0,2}$/.test(dados)) {
    throw new AiError('A imagem do recibo não está em base64 válido.', 400, 'IMAGEM_INVALIDA');
  }

  // Tamanho decodificado estimado sem decodificar tudo (3 bytes a cada 4 caracteres)
  const maxBytes = ENV.AI_MAX_IMAGE_MB * 1024 * 1024;
  const bytesEstimados = Math.floor((dados.length * 3) / 4);
  if (bytesEstimados > maxBytes) {
    throw new AiError(
      `A foto é muito grande (máximo ${ENV.AI_MAX_IMAGE_MB} MB). Tire a foto com resolução menor ou recorte o recibo.`,
      413,
      'IMAGEM_GRANDE'
    );
  }

  const cabecalho = Buffer.from(dados.slice(0, 24), 'base64');
  const mime =
    cabecalho[0] === 0xff && cabecalho[1] === 0xd8 && cabecalho[2] === 0xff
      ? 'image/jpeg'
      : cabecalho.subarray(0, 4).toString('hex') === '89504e47'
      ? 'image/png'
      : cabecalho.subarray(0, 4).toString('ascii') === 'RIFF' && cabecalho.subarray(8, 12).toString('ascii') === 'WEBP'
      ? 'image/webp'
      : null;
  if (!mime) {
    throw new AiError('Formato de imagem não suportado. Envie a foto em JPEG, PNG ou WEBP.', 415, 'IMAGEM_FORMATO');
  }

  return `data:${mime};base64,${dados.replace(/-/g, '+').replace(/_/g, '/')}`;
}

/** Traduz falhas do provedor (Groq) em mensagens amigáveis, sem expor detalhes técnicos. */
function traduzirErroProvedor(error: unknown): never {
  if (error instanceof AiError) throw error;
  if (error instanceof RateLimitError) {
    throw new AiError('Muitas solicitações à IA agora. Tente novamente em alguns instantes.', 429, 'IA_LIMITE');
  }
  if (error instanceof APIConnectionError) {
    throw new AiError('O serviço de IA demorou para responder. Tente novamente.', 503, 'IA_INDISPONIVEL');
  }
  if (error instanceof APIError) {
    console.error('[AiBusiness] Erro do provedor de IA:', error.status, error.message);
    throw new AiError('O serviço de IA está indisponível no momento. Tente novamente mais tarde.', 502, 'IA_INDISPONIVEL');
  }
  throw error;
}

export const AiBusiness = {
  async processMessage(message: unknown, base64Image?: unknown): Promise<ExtractedTransactionDto> {
    const temImagem = base64Image !== undefined && base64Image !== null && base64Image !== '';

    // Com foto, a mensagem é opcional (usa um prompt padrão de leitura de recibo)
    const texto = typeof message === 'string' ? message.trim() : '';
    if (!texto && !temImagem) {
      throw new AiError('Escreva uma mensagem ou envie a foto de um recibo.', 400, 'MENSAGEM_INVALIDA');
    }
    if (texto.length > MENSAGEM_MAX) {
      throw new AiError(`A mensagem pode ter no máximo ${MENSAGEM_MAX} caracteres.`, 400, 'MENSAGEM_INVALIDA');
    }

    const imagemDataUrl = temImagem ? prepararImagem(base64Image) : null;

    if (!ENV.GROQ_API_KEY) {
      console.error('[AiBusiness] GROQ_API_KEY não definida nas variáveis de ambiente.');
      throw new AiError('O assistente de IA não está disponível no momento.', 503, 'IA_INDISPONIVEL');
    }
    if (imagemDataUrl && !ENV.AI_VISION_MODEL) {
      console.error('[AiBusiness] base64Image enviado, mas AI_VISION_MODEL não está configurado.');
      throw new AiError(
        'A leitura de fotos de recibo não está disponível no momento. Descreva o gasto por texto.',
        503,
        'IA_INDISPONIVEL'
      );
    }

    const groq = new Groq({ apiKey: ENV.GROQ_API_KEY, timeout: 30_000, maxRetries: 1 });
    const modelToUse: string = imagemDataUrl ? (ENV.AI_VISION_MODEL as string) : ENV.AI_TEXT_MODEL;

    const systemPrompt = `
Você é um assistente financeiro inteligente. Extraia informações da mensagem do usuário e converta em uma transação financeira estruturada.
Responda ESTRITAMENTE em JSON (apenas JSON, sem markdown), com exatamente estas chaves:
- "tipo": "entrada" ou "saida"
- "descricao": string
- "valor": number (positivo)
- "categoria": string
- "data": "YYYY-MM-DD" (se não houver data explícita, assuma hoje: ${todayISO()})
- "ispaycart": boolean (opcional; true apenas se for pagamento/compra no cartão)
`.trim();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (imagemDataUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: texto || PROMPT_RECIBO_PADRAO },
          { type: 'image_url', image_url: { url: imagemDataUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: texto });
    }

    try {
      // Tentativa 1
      const completion1 = await groq.chat.completions.create({
        model: modelToUse,
        messages,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const content1 = completion1.choices?.[0]?.message?.content?.trim() || '{}';
      const parsed = parseJson(content1);
      if (isValidTransaction(parsed)) {
        return parsed;
      }

      // Tentativa 2 com correção do esquema
      const completion2 = await groq.chat.completions.create({
        model: modelToUse,
        messages: [
          ...messages,
          { role: 'assistant', content: content1 },
          {
            role: 'user',
            content:
              'Seu JSON está inválido para o esquema exigido. Retorne NOVAMENTE apenas JSON com as chaves: tipo, descricao, valor, categoria, data e (opcional) ispaycart. Sem texto extra.',
          },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });

      const parsed2 = parseJson(completion2.choices?.[0]?.message?.content?.trim() || '{}');
      if (isValidTransaction(parsed2)) {
        return parsed2;
      }
    } catch (error) {
      traduzirErroProvedor(error);
    }

    throw new AiError(
      imagemDataUrl
        ? 'Não consegui ler uma transação nesta foto. Tente uma foto mais nítida e bem enquadrada, ou descreva o gasto por texto.'
        : 'Não consegui identificar uma transação na mensagem. Informe, por exemplo, o valor, o que foi e a data.',
      422,
      'IA_SEM_RESULTADO'
    );
  },
};
