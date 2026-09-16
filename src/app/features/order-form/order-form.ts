import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { OrderSide } from '../../core/models/trading.models';
import { OrdersStore } from '../../core/store/orders.store';

const SNACKBAR_DURATION_MS = 4000;

@Component({
  selector: 'app-order-form',
  imports: [ReactiveFormsModule],
  templateUrl: './order-form.html',
  styleUrl: './order-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderForm {
  protected readonly store = inject(OrdersStore);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly sides: OrderSide[] = ['BUY', 'SELL'];

  protected readonly form = this.formBuilder.group({
    symbol: ['', Validators.required],
    side: this.formBuilder.control<OrderSide>('BUY', Validators.required),
    size: [0.01, [Validators.required, Validators.min(Number.EPSILON)]],
    openPrice: [0, [Validators.required, Validators.min(Number.EPSILON)]],
    openTime: [OrderForm.toLocalDateTimeInput(new Date()), Validators.required],
  });

  constructor() {
    // Pre-fill the open price with the current bid whenever the symbol changes.
    this.form.controls.symbol.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((symbol) => this.applyCurrentPrice(symbol));
  }

  protected applyCurrentPrice(symbol: string): void {
    const bid = this.store.currentBid(symbol);
    if (bid !== null) {
      this.form.controls.openPrice.setValue(bid);
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { symbol, side, size, openPrice, openTime } = this.form.getRawValue();
    const order = this.store.addOrder({
      symbol,
      side,
      size,
      openPrice,
      openTime: new Date(openTime).getTime(),
    });

    this.snackBar.open(`Dodano zlecenie nr ${order.id}`, 'OK', {
      duration: SNACKBAR_DURATION_MS,
    });

    this.form.reset({
      symbol: '',
      side: 'BUY',
      size: 0.01,
      openPrice: 0,
      openTime: OrderForm.toLocalDateTimeInput(new Date()),
    });
  }

  protected hasError(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || control.dirty);
  }

  private static toLocalDateTimeInput(date: Date): string {
    const offsetMs = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
  }
}
