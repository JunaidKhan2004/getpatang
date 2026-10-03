import { Global, Injectable, Module } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';

import { SettingsService } from '../settings/settings.service.js';

export interface PaymentContext {
  orderNumbers: string[];
  amount: number;
}

export interface PaymentInitiation {
  status: PaymentStatus;
  /** Shown to the customer after placing the order. */
  instructions: string;
}

/**
 * One way of paying. Online gateways (cards, wallets) implement this in Phase 7.
 * Nothing here pretends a payment succeeded: every method starts as PENDING until confirmed.
 */
export interface PaymentProvider {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  isAvailable(): Promise<boolean>;
  initiate(ctx: PaymentContext): Promise<PaymentInitiation>;
}

@Injectable()
export class CashOnDeliveryProvider implements PaymentProvider {
  readonly key = 'cod';
  readonly label = 'Cash on delivery';
  readonly description = 'Pay the rider in cash when your order arrives.';

  constructor(private readonly settings: SettingsService) {}

  async isAvailable() {
    return (await this.settings.get('payments.cod')).enabled;
  }

  async initiate(): Promise<PaymentInitiation> {
    return { status: PaymentStatus.PENDING, instructions: 'Please keep the exact amount ready. Pay the rider when your order arrives.' };
  }
}

@Injectable()
export class BankTransferProvider implements PaymentProvider {
  readonly key = 'bank_transfer';
  readonly label = 'Bank transfer';
  readonly description = 'Transfer to our bank account. Your order is confirmed once the payment is verified.';

  constructor(private readonly settings: SettingsService) {}

  async isAvailable() {
    const s = await this.settings.get('payments.bank_transfer');
    return s.enabled && Boolean(s.accountTitle && s.iban);
  }

  async initiate(ctx: PaymentContext): Promise<PaymentInitiation> {
    const s = await this.settings.get('payments.bank_transfer');
    return {
      status: PaymentStatus.PENDING,
      instructions:
        `Transfer Rs ${ctx.amount.toLocaleString('en-PK')} to ${s.accountTitle}, ${s.bankName}, IBAN ${s.iban}. ` +
        `Use ${ctx.orderNumbers.join(', ')} as the payment reference.`,
    };
  }
}

/** Looks up payment methods by key. Add a provider here to offer it at checkout. */
@Injectable()
export class PaymentsService {
  private readonly providers: PaymentProvider[];

  constructor(cod: CashOnDeliveryProvider, bank: BankTransferProvider) {
    this.providers = [cod, bank];
  }

  async available() {
    const flags = await Promise.all(this.providers.map((p) => p.isAvailable()));
    return this.providers.filter((_, i) => flags[i]).map(({ key, label, description }) => ({ key, label, description }));
  }

  async get(key: string): Promise<PaymentProvider | null> {
    const provider = this.providers.find((p) => p.key === key);
    return provider && (await provider.isAvailable()) ? provider : null;
  }

  label(key: string) {
    return this.providers.find((p) => p.key === key)?.label ?? key;
  }
}

@Global()
@Module({
  providers: [PaymentsService, CashOnDeliveryProvider, BankTransferProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
