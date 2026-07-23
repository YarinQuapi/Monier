// Pure, framework-agnostic types for the EOM cash forecasting engine.
// Deliberately decoupled from Prisma's generated types so the algorithm
// stays unit-testable without a database.

export type PaymentMethodKind = "CREDIT_CARD" | "BANK_ACCOUNT";

export interface PaymentMethodInput {
  id: string;
  type: PaymentMethodKind;
  /** Day of month (1-31) the billing cycle starts. Credit cards only. */
  cycleStartDay?: number | null;
  /** Day of month (1-31) the statement payment is due. Credit cards only. */
  paymentDueDay?: number | null;
  /** Months after cycle close that payment is due. Credit cards only. */
  dueMonthOffset?: number | null;
}

/**
 * A single cash-affecting charge: either a one-off Purchase, or one
 * resolved occurrence of a Subscription's recurring/fixed-term billing.
 */
export interface ChargeInput {
  id: string;
  paymentMethodId: string;
  amount: number;
  /** The date the charge was actually made (not when cash leaves). */
  chargeDate: Date;
}

export interface BillingCycle {
  cycleStart: Date;
  /** Inclusive end of the cycle (the day before the next cycle starts). */
  cycleEnd: Date;
  dueDate: Date;
}

export interface EomForecastLineItem {
  paymentMethodId: string;
  /** Sum of all charges whose cash impact lands within the forecast month. */
  amountDue: number;
  chargeIds: string[];
}

export interface EomForecastResult {
  /** Total estimated cash required by the end of the reference month. */
  total: number;
  lineItems: EomForecastLineItem[];
}
