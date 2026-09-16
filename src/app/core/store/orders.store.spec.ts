import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { Order, Quote } from '../models/trading.models';
import { QuotesSocketService } from '../services/quotes-socket.service';
import { TradingApiService } from '../services/trading-api.service';
import { OrdersStore } from './orders.store';

describe('OrdersStore', () => {
  const orders: Order[] = [
    { id: 1, symbol: 'BTCUSD', side: 'BUY', size: 0.05, openTime: 1, openPrice: 100000, swap: -1 },
    { id: 2, symbol: 'BTCUSD', side: 'SELL', size: 0.01, openTime: 2, openPrice: 80000, swap: -2 },
    { id: 3, symbol: 'ETHUSD', side: 'BUY', size: 0.03, openTime: 3, openPrice: 2000, swap: 0.5 },
  ];

  let store: OrdersStore;
  let quotes$: Subject<Quote[]>;
  let watchedSymbols: string[][];

  beforeEach(() => {
    quotes$ = new Subject<Quote[]>();
    watchedSymbols = [];

    TestBed.configureTestingModule({
      providers: [
        {
          provide: TradingApiService,
          useValue: {
            loadTradingData: () =>
              of({
                orders,
                instruments: [
                  { symbol: 'BTCUSD', contractType: 1 },
                  { symbol: 'ETHUSD', contractType: 2 },
                ],
                contractTypes: [
                  { contractType: 1, contractSize: 10 },
                  { contractType: 2, contractSize: 100 },
                ],
              }),
          },
        },
        {
          provide: QuotesSocketService,
          useValue: {
            quotes$,
            watchSymbols: (symbols: readonly string[]) => watchedSymbols.push([...symbols]),
          },
        },
      ],
    });

    store = TestBed.inject(OrdersStore);
    store.loadInitialData();
  });

  it('groups orders by symbol with aggregated values', () => {
    const groups = store.groups();

    expect(groups.map((g) => g.symbol)).toEqual(['BTCUSD', 'ETHUSD']);

    const btc = groups[0];
    expect(btc.count).toBe(2);
    expect(btc.totalSize).toBeCloseTo(0.06);
    expect(btc.totalSwap).toBeCloseTo(-3);
    expect(btc.avgOpenPrice).toBeCloseTo(90000);
    expect(btc.totalProfit).toBeNull();
  });

  it('calculates profit as (bid - openPrice) * size * contractSize * sideMultiplier', () => {
    quotes$.next([{ s: 'BTCUSD', b: 101000, a: 101100, t: 1 }]);

    const btc = store.groups().find((g) => g.symbol === 'BTCUSD')!;
    const [buy, sell] = btc.orders;

    expect(buy.profit).toBeCloseTo((101000 - 100000) * 0.05 * 10 * 1);
    expect(sell.profit).toBeCloseTo((101000 - 80000) * 0.01 * 10 * -1);
    expect(btc.totalProfit).toBeCloseTo(buy.profit! + sell.profit!);
  });

  it('subscribes to quotes for symbols present in the store', () => {
    TestBed.tick();
    expect(watchedSymbols.at(-1)).toEqual(['BTCUSD', 'ETHUSD']);
  });

  it('closes a single order and returns its id', () => {
    expect(store.closeOrder(2)).toEqual([2]);
    expect(store.orders().map((o) => o.id)).toEqual([1, 3]);
  });

  it('closes a whole group and returns the ids of removed orders', () => {
    expect(store.closeGroup('BTCUSD')).toEqual([1, 2]);
    expect(store.symbols()).toEqual(['ETHUSD']);
  });

  it('adds a new order with a unique id and zero swap', () => {
    const order = store.addOrder({
      symbol: 'ETHUSD',
      side: 'SELL',
      size: 1,
      openPrice: 2100,
      openTime: Date.now(),
    });

    expect(order.id).toBe(4);
    expect(order.swap).toBe(0);
    expect(store.orders()).toHaveLength(4);
  });
});
