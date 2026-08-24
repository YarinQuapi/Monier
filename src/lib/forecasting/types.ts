// Pure, framework-agnostic types for the EOM cash forecasting engine.
// Deliberately decoupled from Prisma's generated types (plain numbers/Dates
// instead of Decimal) so the algorithm stays unit-testable without a
// database and without pulling in the generated Prisma client.

export type PaymentMethodKind = "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT";

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

export type SubscriptionBillingKind =
  | "ONGOING_MONTHLY"
  | "ONGOING_ANNUAL"
  | "FIXED_TERM";

/** A one-off expense, already tied to a specific calendar date. */
export interface PurchaseInput {
  id: string;
  /** null when the purchase wasn't linked to a tracked payment method. */
  paymentMethodId: string | null;
  amount: number;
  purchaseDate: Date;
}

/** A recurring or fixed-term subscription, not yet expanded into occurrences. */
export interface SubscriptionInput {
  id: string;
  paymentMethodId: string;
  /** Provider / organization name (e.g. Netflix, Spotify). */
  providerName: string;
  /** User-defined label distinguishing multiple accounts at the same provider. */
  accountLabel: string;
  amount: number;
  billingType: SubscriptionBillingKind;
  /** Day of month the charge occurs (clamped to shorter months). For
   * ONGOING_ANNUAL, the charge recurs every 12 months in the same
   * calendar month as startDate. */
  billingDayOfMonth: number;
  /** First charge date; supports deferred starts. */
  startDate: Date;
  /** Required (and only meaningful) when billingType = FIXED_TERM. */
  totalMonths?: number | null;
  /** Optional explicit end date, only meaningful for ONGOING_MONTHLY/ONGOING_ANNUAL. */
  endDate?: Date | null;
  isActive: boolean;
}

export interface BillingCycle {
  cycleStart: Date;
  /** Inclusive end of the cycle (the day before the next cycle starts). */
  cycleEnd: Date;
  dueDate: Date;
}

export type ChargeSource = "PURCHASE" | "SUBSCRIPTION";

/** One expanded billing occurrence of a subscription. */
export interface SubscriptionOccurrence {
  date: Date;
  /** 1-based index within the subscription schedule (month 1, month 2, …). */
  installmentNumber: number;
}

/** A single resolved charge occurrence, with both dates it cares about. */
export interface ResolvedCharge {
  source: ChargeSource;
  /** Purchase.id, or Subscription.id (shared across all of its occurrences). */
  sourceId: string;
  paymentMethodId: string;
  amount: number;
  /** The date the charge/occurrence actually happened. */
  chargeDate: Date;
  /** The date cash actually leaves the user's account for this charge. */
  cashOutflowDate: Date;
  /** Populated when source = SUBSCRIPTION. */
  subscriptionProviderName?: string;
  subscriptionAccountLabel?: string;
  subscriptionBillingType?: SubscriptionBillingKind;
  /** 1-based installment index; meaningful for all subscription charges. */
  installmentNumber?: number;
  /** Total installments for FIXED_TERM subscriptions. */
  totalInstallments?: number;
}

export interface EomForecastLineItem {
  paymentMethodId: string;
  /** Sum of all charges whose cash impact lands within the forecast month. */
  amountDue: number;
  charges: ResolvedCharge[];
}

export interface EomForecastResult {
  referenceMonthStart: Date;
  referenceMonthEnd: Date;
  /** Total estimated cash required by the end of the reference month. */
  total: number;
  lineItems: EomForecastLineItem[];
}

/** Forecast charges split by whether their due date has already passed. */
export interface SettledForecastSplit {
  remaining: EomForecastLineItem[];
  remainingTotal: number;
  settled: EomForecastLineItem[];
  settledTotal: number;
}

export type IncomeKind = "SALARY" | "MISC";

export interface IncomeEntry {
  id: string;
  type: IncomeKind;
  label: string;
  amount: number;
  receivedAt: Date;
}

export interface IncomeSummary {
  referenceMonthStart: Date;
  referenceMonthEnd: Date;
  total: number;
  byType: Record<IncomeKind, number>;
  entries: IncomeEntry[];
}

export interface CashFlowSummary {
  income: IncomeSummary;
  forecast: EomForecastResult;
  /** income.total - forecast.total for *this month alone*; positive means
   * a projected surplus for the month in isolation. */
  net: number;
  /** The running account balance through the end of this month: every
   * charge (purchase or subscription occurrence) ever removes from it as
   * of its cash-outflow date, and every income entry ever adds to it as of
   * the date it was received. Carries every prior month's surplus/deficit
   * forward instead of resetting to zero each month. */
  balance: number;
}

export interface DebtSummary {
  /** "Now" the debt was computed as of. */
  asOf: Date;
  /** Total outstanding debt: unpaid already-incurred charges, plus every
   * remaining installment of active FIXED_TERM subscriptions. */
  total: number;
  /** Latest cash-outflow date among all outstanding debt — the date
   * everything currently owed would be fully paid off, assuming no new
   * charges are added. Null when there's no outstanding debt. */
  payoffEta: Date | null;
  lineItems: EomForecastLineItem[];
}
