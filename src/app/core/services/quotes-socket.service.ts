import { DestroyRef, Injectable, inject } from '@angular/core';
import { EMPTY, Observable, Subject, catchError, filter, map, retry, share, timer } from 'rxjs';
import { WebSocketSubject, webSocket } from 'rxjs/webSocket';

import { API_CONFIG } from '../api.config';
import { Quote, QuotesMessage } from '../models/trading.models';

const RECONNECT_DELAY_MS = 3000;
const QUOTES_TOPIC = '/quotes/subscribed';

interface SubscriptionCommand {
  readonly p: '/subscribe/addlist' | '/subscribe/removelist';
  readonly d: string[];
}

/**
 * Manages the WebSocket connection to the quotes server.
 * Keeps track of the desired symbol set, diffs it against the current
 * subscriptions and automatically re-subscribes after a reconnect.
 */
@Injectable({ providedIn: 'root' })
export class QuotesSocketService {
  private readonly destroyRef = inject(DestroyRef);

  private socket: WebSocketSubject<QuotesMessage | SubscriptionCommand> | null = null;
  private readonly subscribedSymbols = new Set<string>();
  private readonly quotesSubject = new Subject<Quote[]>();

  /** Stream of quote batches pushed by the server. */
  readonly quotes$: Observable<Quote[]> = this.quotesSubject.asObservable();

  constructor() {
    this.destroyRef.onDestroy(() => this.socket?.complete());
  }

  /** Declaratively sets the full set of symbols the app wants quotes for. */
  watchSymbols(symbols: readonly string[]): void {
    const desired = new Set(symbols);
    const toAdd = [...desired].filter((symbol) => !this.subscribedSymbols.has(symbol));
    const toRemove = [...this.subscribedSymbols].filter((symbol) => !desired.has(symbol));

    if (toAdd.length === 0 && toRemove.length === 0) {
      return;
    }

    toAdd.forEach((symbol) => this.subscribedSymbols.add(symbol));
    toRemove.forEach((symbol) => this.subscribedSymbols.delete(symbol));

    const socket = this.ensureConnection();
    if (toAdd.length > 0) {
      socket.next({ p: '/subscribe/addlist', d: toAdd });
    }
    if (toRemove.length > 0) {
      socket.next({ p: '/subscribe/removelist', d: toRemove });
    }
  }

  private ensureConnection(): WebSocketSubject<QuotesMessage | SubscriptionCommand> {
    if (this.socket) {
      return this.socket;
    }

    this.socket = webSocket<QuotesMessage | SubscriptionCommand>({
      url: API_CONFIG.quotesWsUrl,
      openObserver: {
        // Re-subscribe to all tracked symbols after every (re)connect.
        next: () => {
          if (this.subscribedSymbols.size > 0) {
            this.socket?.next({ p: '/subscribe/addlist', d: [...this.subscribedSymbols] });
          }
        },
      },
    });

    this.socket
      .pipe(
        filter((message): message is QuotesMessage => message.p === QUOTES_TOPIC),
        map((message) => message.d),
        retry({ delay: () => timer(RECONNECT_DELAY_MS) }),
        catchError(() => EMPTY),
        share(),
      )
      .subscribe((quotes) => this.quotesSubject.next(quotes));

    return this.socket;
  }
}
