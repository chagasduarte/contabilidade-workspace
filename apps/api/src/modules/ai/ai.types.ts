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

