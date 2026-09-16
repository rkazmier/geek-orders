import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from './core/services/theme.service';
import { OrdersStore } from './core/store/orders.store';
import { OrderForm } from './features/order-form/order-form';
import { OrdersTable } from './features/orders-table/orders-table';

@Component({
  selector: 'app-root',
  imports: [OrdersTable, OrderForm],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly theme = inject(ThemeService);
  private readonly store = inject(OrdersStore);

  constructor() {
    this.store.loadInitialData();
  }
}
