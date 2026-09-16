export type OrderSide = 'BUY' | 'SELL';

export interface Order {
  readonly id: number;
  readonly symbol: string;
  readonly side: OrderSide;
  readonly size: number;
  readonly openTime: number;
  readonly openPrice: number;
  readonly swap: number;
}

export interface Instrument {
  readonly symbol: string;
  readonly contractType: number;
}

export interface ContractType {
  readonly contractType: number;
  readonly contractSize: number;
}

export interface Quote {
  /** Symbol */
  readonly s: string;
  /** Bid price */
  readonly b: number;
  /** Ask price */
  readonly a: number;
  /** Timestamp */
  readonly t: number;
}

export interface OrdersResponse {
  readonly data: Order[];
}

export interface QuotesMessage {
  readonly p: string;
  readonly d: Quote[];
}

/** Order enriched with the calculated profit (null until a quote arrives). */
export interface OrderView extends Order {
  readonly profit: number | null;
}

/** Aggregated group of orders sharing the same symbol. */
export interface OrderGroup {
  readonly symbol: string;
  readonly orders: OrderView[];
  readonly count: number;
  readonly avgOpenPrice: number;
  readonly totalSwap: number;
  readonly totalSize: number;
  readonly totalProfit: number | null;
}
