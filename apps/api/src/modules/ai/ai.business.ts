import Groq from 'groq-sdk';
import { ENV } from '../../core/config/env';
import { ExtractedTransactionDto } from './ai.types';

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

export const AiBusiness = {
  async processMessage(
    message: string,
    base64Image?: string
  ): Promise<ExtractedTransactionDto> {
    if (!ENV.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY não definida nas variáveis de ambiente.');
    }

    const groq = new Groq({ apiKey: ENV.GROQ_API_KEY });
    const TEXT_MODEL = ENV.AI_TEXT_MODEL;
    const VISION_MODEL = ENV.AI_VISION_MODEL;

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

    if (base64Image) {
      if (!VISION_MODEL) {
        throw new Error(
          'base64Image foi enviado, mas AI_VISION_MODEL não está configurado. A Groq só aceita imagens em modelos vision específicos.'
        );
      }

      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: message },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: message });
    }

    const modelToUse: string = base64Image ? (VISION_MODEL || TEXT_MODEL) : TEXT_MODEL;

    // Tentativa 1
    const completion1 = await groq.chat.completions.create({
      model: modelToUse,
      messages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content1 = completion1.choices?.[0]?.message?.content?.trim() || '{}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content1);
    } catch {
      parsed = null;
    }

    if (isValidTransaction(parsed)) {
      return parsed;
    }

    // Tentativa 2 com fallback
    const retryMessages = [
      ...messages,
      {
        role: 'assistant',
        content: content1,
      },
      {
        role: 'user',
        content:
          'Seu JSON está inválido para o esquema exigido. Retorne NOVAMENTE apenas JSON com as chaves: tipo, descricao, valor, categoria, data e (opcional) ispaycart. Sem texto extra.',
      },
    ];

    const completion2 = await groq.chat.completions.create({
      model: modelToUse,
      messages: retryMessages,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });

    const content2 = completion2.choices?.[0]?.message?.content?.trim() || '{}';
    const parsed2 = JSON.parse(content2);

    if (!isValidTransaction(parsed2)) {
      throw new Error('A IA retornou JSON, mas fora do esquema esperado.');
    }

    return parsed2;
  },
};
