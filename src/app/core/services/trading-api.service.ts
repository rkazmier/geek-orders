import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';

import { API_CONFIG } from '../api.config';
import { ContractType, Instrument, Order, OrdersResponse } from '../models/trading.models';

export interface TradingData {
  readonly orders: Order[];
  readonly instruments: Instrument[];
  readonly contractTypes: ContractType[];
}

@Injectable({ providedIn: 'root' })
export class TradingApiService {
  private readonly http = inject(HttpClient);

  loadTradingData(): Observable<TradingData> {
    return forkJoin({
      orders: this.http
        .get<OrdersResponse>(API_CONFIG.ordersUrl)
        .pipe(map((response) => response.data)),
      instruments: this.http.get<Instrument[]>(API_CONFIG.instrumentsUrl),
      contractTypes: this.http.get<ContractType[]>(API_CONFIG.contractTypesUrl),
    });
  }
}
