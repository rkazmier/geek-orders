import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  Order,
  OrderGroup,
  OrderSide,
  OrderView,
  Quote,
} from '../models/trading.models';
import { QuotesSocketService } from '../services/quotes-socket.service';
import { TradingApiService } from '../services/trading-api.service';

export interface NewOrderInput {
  readonly symbol: string;
  readonly side: OrderSide;
  readonly size: number;
  readonly openPrice: number;
  readonly openTime: number;
}

/**
 * Signal-based application store holding the order list, live quotes and
 * derived, aggregated view models (profit, per-symbol groups).
 */
@Injectable({ providedIn: 'root' })
export class OrdersStore {
  private readonly api = inject(TradingApiService);
  private readonly quotesSocket = inject(QuotesSocketService);

  private readonly ordersSignal = signal<Order[]>([]);
  private readonly quotesSignal = signal<ReadonlyMap<string, Quote>>(new Map());
  private readonly contractSizeBySymbolSignal = signal<ReadonlyMap<string, number>>(new Map());
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly orders = this.ordersSignal.asReadonly();
  readonly quotes = this.quotesSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  /** Distinct symbols of currently open orders, in order of appearance. */
  readonly symbols = computed(() => [...new Set(this.ordersSignal().map((o) => o.symbol))]);

  /** Orders grouped by symbol with aggregates and calculated profit. */
  readonly groups = computed<OrderGroup[]>(() => {
    const quotes = this.quotesSignal();
    const contractSizes = this.contractSizeBySymbolSignal();

    const bySymbol = new Map<string, OrderView[]>();
    for (const order of this.ordersSignal()) {
      const profit = this.calculateProfit(order, quotes, contractSizes);
      const views = bySymbol.get(order.symbol);
      if (views) {
        views.push({ ...order, profit });
      } else {
        bySymbol.set(order.symbol, [{ ...order, profit }]);
      }
    }

    return [...bySymbol.entries()].map(([symbol, orders]) => ({
      symbol,
      orders,
      count: orders.length,
      avgOpenPrice: orders.reduce((sum, o) => sum + o.openPrice, 0) / orders.length,
      totalSwap: orders.reduce((sum, o) => sum + o.swap, 0),
      totalSize: orders.reduce((sum, o) => sum + o.size, 0),
      totalProfit: orders.every((o) => o.profit === null)
        ? null
        : orders.reduce((sum, o) => sum + (o.profit ?? 0), 0),
    }));
  });

  constructor() {
    // Keep the WebSocket subscriptions in sync with the symbols in the store.
    effect(() => this.quotesSocket.watchSymbols(this.symbols()));

    this.quotesSocket.quotes$
      .pipe(takeUntilDestroyed())
      .subscribe((quotes) => this.updateQuotes(quotes));
  }

  loadInitialData(): void {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    this.api.loadTradingData().subscribe({
      next: ({ orders, instruments, contractTypes }) => {
        const sizeByType = new Map(contractTypes.map((ct) => [ct.contractType, ct.contractSize]));
        const sizeBySymbol = new Map(
          instruments.map((i) => [i.symbol, sizeByType.get(i.contractType) ?? 1]),
        );
        this.contractSizeBySymbolSignal.set(sizeBySymbol);
        this.ordersSignal.set(orders);
        this.loadingSignal.set(false);
      },
      error: () => {
        this.errorSignal.set('Nie udało się pobrać danych zleceń. Spróbuj ponownie.');
        this.loadingSignal.set(false);
      },
    });
  }

  addOrder(input: NewOrderInput): Order {
    const order: Order = { ...input, id: this.nextOrderId(), swap: 0 };
    this.ordersSignal.update((orders) => [...orders, order]);
    return order;
  }

  /** Removes a single order and returns its id. */
  closeOrder(id: number): number[] {
    this.ordersSignal.update((orders) => orders.filter((order) => order.id !== id));
    return [id];
  }

  /** Removes all orders of a symbol and returns their ids. */
  closeGroup(symbol: string): number[] {
    const closedIds = this.ordersSignal()
      .filter((order) => order.symbol === symbol)
      .map((order) => order.id);
    this.ordersSignal.update((orders) => orders.filter((order) => order.symbol !== symbol));
    return closedIds;
  }

  currentBid(symbol: string): number | null {
    return this.quotesSignal().get(symbol)?.b ?? null;
  }

  private updateQuotes(quotes: Quote[]): void {
    if (quotes.length === 0) {
      return;
    }
    this.quotesSignal.update((current) => {
      const next = new Map(current);
      for (const quote of quotes) {
        next.set(quote.s, quote);
      }
      return next;
    });
  }

  private calculateProfit(
    order: Order,
    quotes: ReadonlyMap<string, Quote>,
    contractSizes: ReadonlyMap<string, number>,
  ): number | null {
    const bid = quotes.get(order.symbol)?.b;
    const contractSize = contractSizes.get(order.symbol);
    if (bid === undefined || contractSize === undefined) {
      return null;
    }
    const sideMultiplier = order.side === 'BUY' ? 1 : -1;
    return (bid - order.openPrice) * order.size * contractSize * sideMultiplier;
  }

  private nextOrderId(): number {
    return this.ordersSignal().reduce((max, order) => Math.max(max, order.id), 0) + 1;
  }
}
