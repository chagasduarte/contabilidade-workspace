import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  OrigemParcelamento,
  ParcelamentoDetalhes,
} from '@contabilidade/models';
import { API_URL } from './categoria.service';

@Injectable({ providedIn: 'root' })
export class ParcelamentoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_URL);

  excluir(origem: OrigemParcelamento, id: string) {
    return this.http.delete<void>(
      `${this.baseUrl}/transacoes/parcelamentos/${origem}/${encodeURIComponent(id)}`,
    );
  }

  detalhar(origem: OrigemParcelamento, id: string) {
    return this.http.get<ParcelamentoDetalhes>(
      `${this.baseUrl}/transacoes/parcelamentos/${origem}/${encodeURIComponent(id)}`,
    );
  }
}
