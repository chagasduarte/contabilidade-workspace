export interface AiChatRequestDto {
  message: string;
  base64Image?: string;
}

export interface ExtractedTransactionDto {
  tipo: 'entrada' | 'saida';
  descricao: string;
  valor: number;
  categoria: string;
  data: string;
  ispaycart?: boolean;
}


/**
 * Erro do fluxo de IA já com status HTTP e mensagem amigável (exibível ao usuário).
 * `codigo` permite ao front tratar casos específicos sem depender do texto.
 */
export class AiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo:
      | 'MENSAGEM_INVALIDA'
      | 'IMAGEM_INVALIDA'
      | 'IMAGEM_FORMATO'
      | 'IMAGEM_GRANDE'
      | 'IA_INDISPONIVEL'
      | 'IA_LIMITE'
      | 'IA_SEM_RESULTADO'
  ) {
    super(message);
    this.name = 'AiError';
  }
}
