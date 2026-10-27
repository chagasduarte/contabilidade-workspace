// ai.model.ts — assistente que sugere lançamentos (POST /ai/chat)

export interface AiChatRequest {
  /** Até 2000 caracteres. Opcional quando há foto. */
  message?: string;
  /** base64 cru ou data URL (JPEG/PNG/WEBP, até 4 MB decodificada). */
  base64Image?: string;
}

/** Sugestão de lançamento. A API NÃO grava: o usuário confirma e o front chama POST /transacoes. */
export interface SugestaoTransacao {
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  /** Nome sugerido de categoria (não é id). */
  categoria: string;
  /** YYYY-MM-DD */
  data: string;
  ispaycart?: boolean;
}

export type AiErroCodigo =
  | 'MENSAGEM_INVALIDA'
  | 'IMAGEM_INVALIDA'
  | 'IMAGEM_GRANDE'
  | 'IMAGEM_FORMATO'
  | 'IA_SEM_RESULTADO'
  | 'IA_LIMITE'
  | 'IA_INDISPONIVEL';
