import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';

import { OrdersStore } from '../../core/store/orders.store';

const SNACKBAR_DURATION_MS = 5000;

@Component({
  selector: 'app-orders-table',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './orders-table.html',
  styleUrl: './orders-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersTable {
  protected readonly store = inject(OrdersStore);
  private readonly snackBar = inject(MatSnackBar);

  private readonly expandedSymbols = signal<ReadonlySet<string>>(new Set());

  protected isExpanded(symbol: string): boolean {
    return this.expandedSymbols().has(symbol);
  }

  protected toggleGroup(symbol: string): void {
    this.expandedSymbols.update((expanded) => {
      const next = new Set(expanded);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  }

  protected closeOrder(id: number, event: MouseEvent): void {
    event.stopPropagation();
    this.notifyClosed(this.store.closeOrder(id));
  }

  protected closeGroup(symbol: string, event: MouseEvent): void {
    event.stopPropagation();
    this.notifyClosed(this.store.closeGroup(symbol));
  }

  private notifyClosed(ids: number[]): void {
    if (ids.length === 0) {
      return;
    }
    this.snackBar.open(`Zamknięto zlecenie nr ${ids.join(', ')}`, 'OK', {
      duration: SNACKBAR_DURATION_MS,
    });
  }
}
