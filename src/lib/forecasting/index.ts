import type {
  BillingCycle,
  DebtSummary,
  EomForecastLineItem,
  EomForecastResult,
  PaymentMethodInput,
  PurchaseInput,
  ResolvedCharge,
  SettledForecastSplit,
  SubscriptionInput,
  SubscriptionOccurrence,
} from "./types";

export type {
  BillingCycle,
  ChargeSource,
  DebtSummary,
  EomForecastLineItem,
  EomForecastResult,
  PaymentMethodInput,
  PaymentMethodKind,
  PurchaseInput,
  ResolvedCharge,
  SettledForecastSplit,
  SubscriptionBillingKind,
  SubscriptionInput,
  SubscriptionOccurrence,
} from "./types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** How many months before the reference month to scan for charges whose
 * cash-outflow date (credit card due date) could still land inside it. */
const DEFAULT_LOOKBACK_MONTHS = 3;

// ---------------------------------------------------------------------------
// Small UTC date helpers. Everything here works in UTC because Prisma
// DateTime fields round-trip as UTC JS Dates, and mixing local-time
// arithmetic in would silently shift days near month boundaries.
// ---------------------------------------------------------------------------

/** Absolute month index (year * 12 + month), used to do month arithmetic
 * without worrying about JS Date's rollover semantics ourselves. */
function absoluteMonth(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

/** Builds a UTC date for `day` in the given absolute month, clamping `day`
 * to the last real day of that month (e.g. day 31 in Feb -> 28th/29th). */
function dateAtDayOfMonth(absoluteMonthIndex: number, day: number): Date {
  const year = Math.floor(absoluteMonthIndex / 12);
  const month = absoluteMonthIndex % 12;
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clampedDay = Math.min(Math.max(day, 1), lastDayOfMonth);
  return new Date(Date.UTC(year, month, clampedDay));
}

/** Start of the UTC calendar day containing `date` (00:00:00.000). */
export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Start of the UTC calendar month containing `date` (day 1, 00:00:00.000). */
export function startOfUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** End of the UTC calendar month containing `date` (last day, 23:59:59.999). */
export function endOfUTCMonth(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
}

function addUTCMonths(date: Date, months: number): Date {
  return dateAtDayOfMonth(absoluteMonth(date) + months, date.getUTCDate());
}

/** Rounds to 2 decimal places to avoid floating-point drift when summing money. */
export function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ---------------------------------------------------------------------------
// Credit-card billing-cycle resolution
// ---------------------------------------------------------------------------

/**
 * Given a credit card's cycleStartDay, resolves the billing cycle (and its
 * payment due date) that a given date falls into.
 *
 * A cycle starting on day D of month M runs from D/M through (D-1)/(M+1)
 * (e.g. cycleStartDay=10 -> a cycle runs the 10th through the 9th of the
 * next month). The resulting statement is due on `paymentDueDay`, in the
 * month `dueMonthOffset` months after the cycle closes (dueMonthOffset
 * defaults to 1, i.e. "due about a month after the statement closes").
 */
export function resolveBillingCycle(
  paymentMethod: PaymentMethodInput,
  date: Date
): BillingCycle {
  if (paymentMethod.type !== "CREDIT_CARD") {
    throw new Error(
      `resolveBillingCycle only applies to CREDIT_CARD payment methods (got ${paymentMethod.type}).`
    );
  }

  const { cycleStartDay, paymentDueDay } = paymentMethod;
  if (!cycleStartDay || !paymentDueDay) {
    throw new Error(
      `Credit card payment method ${paymentMethod.id} is missing cycleStartDay/paymentDueDay.`
    );
  }
  const dueMonthOffset = paymentMethod.dueMonthOffset ?? 1;

  // Which month does the cycle *containing* `date` start in? If `date` is
  // on/after the start day, the cycle started this month; otherwise it
  // started last month and is still running into the start of this one.
  const dateMonth = absoluteMonth(date);
  const cycleStartMonth = date.getUTCDate() >= cycleStartDay ? dateMonth : dateMonth - 1;

  const cycleStart = dateAtDayOfMonth(cycleStartMonth, cycleStartDay);

  // The next cycle starts one month later; this cycle closes the day before.
  const nextCycleStartMonth = cycleStartMonth + 1;
  const nextCycleStart = dateAtDayOfMonth(nextCycleStartMonth, cycleStartDay);
  const cycleEnd = new Date(nextCycleStart.getTime() - ONE_DAY_MS);

  // Payment is due `dueMonthOffset` months after the month the cycle closes in.
  const dueMonth = nextCycleStartMonth + dueMonthOffset;
  const dueDate = dateAtDayOfMonth(dueMonth, paymentDueDay);

  return { cycleStart, cycleEnd, dueDate };
}

/**
 * Resolves the date cash actually leaves the user's pocket for a charge on
 * a given payment method: immediately (the charge date itself) for debit
 * cards and bank accounts — both settle straight away, with no statement
 * cycle — or the statement's due date for credit cards.
 */
export function resolveCashOutflowDate(
  paymentMethod: PaymentMethodInput,
  chargeDate: Date
): Date {
  if (paymentMethod.type !== "CREDIT_CARD") {
    return chargeDate;
  }
  return resolveBillingCycle(paymentMethod, chargeDate).dueDate;
}

// ---------------------------------------------------------------------------
// Subscription occurrence expansion
// ---------------------------------------------------------------------------

/**
 * Expands a subscription's recurrence rule into individual occurrence
 * dates within [windowStart, windowEnd] (inclusive). Inactive subscriptions
 * produce no occurrences — this engine only forecasts subscriptions the
 * user currently considers "on".
 */
export function expandSubscriptionOccurrences(
  subscription: SubscriptionInput,
  windowStart: Date,
  windowEnd: Date
): SubscriptionOccurrence[] {
  if (!subscription.isActive) {
    return [];
  }

  const occurrences: SubscriptionOccurrence[] = [];
  const startMonth = absoluteMonth(subscription.startDate);
  const maxOccurrences =
    subscription.billingType === "FIXED_TERM"
      ? subscription.totalMonths ?? 0
      : Infinity;
  // ONGOING_ANNUAL recurs every 12 months instead of every month.
  const stepMonths = subscription.billingType === "ONGOING_ANNUAL" ? 12 : 1;

  for (let i = 0; i < maxOccurrences; i += 1) {
    const occurrenceDate = dateAtDayOfMonth(
      startMonth + i * stepMonths,
      subscription.billingDayOfMonth
    );

    if (occurrenceDate > windowEnd) {
      break;
    }

    if (
      subscription.billingType !== "FIXED_TERM" &&
      subscription.endDate &&
      occurrenceDate > subscription.endDate
    ) {
      break;
    }

    if (occurrenceDate >= windowStart) {
      occurrences.push({ date: occurrenceDate, installmentNumber: i + 1 });
    }
  }

  return occurrences;
}

function resolveSubscriptionCharge(
  subscription: SubscriptionInput,
  occurrence: SubscriptionOccurrence,
  paymentMethod: PaymentMethodInput
): ResolvedCharge {
  return {
    source: "SUBSCRIPTION",
    sourceId: subscription.id,
    paymentMethodId: subscription.paymentMethodId,
    amount: subscription.amount,
    chargeDate: occurrence.date,
    cashOutflowDate: resolveCashOutflowDate(paymentMethod, occurrence.date),
    subscriptionProviderName: subscription.providerName,
    subscriptionAccountLabel: subscription.accountLabel,
    subscriptionBillingType: subscription.billingType,
    installmentNumber: occurrence.installmentNumber,
    totalInstallments:
      subscription.billingType === "FIXED_TERM"
        ? subscription.totalMonths ?? undefined
        : undefined,
  };
}

/** Groups resolved charges by payment method, summing amounts (rounded to
 * cents at each step to avoid floating-point drift), sorted largest first. */
function groupChargesByPaymentMethod(charges: ResolvedCharge[]): EomForecastLineItem[] {
  const lineItemsByPaymentMethod = new Map<string, EomForecastLineItem>();

  for (const charge of charges) {
    const existing = lineItemsByPaymentMethod.get(charge.paymentMethodId);
    if (existing) {
      existing.amountDue = roundCurrency(existing.amountDue + charge.amount);
      existing.charges.push(charge);
    } else {
      lineItemsByPaymentMethod.set(charge.paymentMethodId, {
        paymentMethodId: charge.paymentMethodId,
        amountDue: roundCurrency(charge.amount),
        charges: [charge],
      });
    }
  }

  return Array.from(lineItemsByPaymentMethod.values()).sort(
    (a, b) => b.amountDue - a.amountDue
  );
}

function sortChargesByDueDate(
  charges: ResolvedCharge[],
  direction: "asc" | "desc"
): ResolvedCharge[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...charges].sort((a, b) => {
    const byDue = a.cashOutflowDate.getTime() - b.cashOutflowDate.getTime();
    if (byDue !== 0) return sign * byDue;
    return sign * (a.chargeDate.getTime() - b.chargeDate.getTime());
  });
}

/**
 * A charge is settled once its cash-outflow (due) date's calendar day is
 * strictly before `asOfDate`. The due day itself still counts as cash needed.
 */
export function isChargeSettled(charge: ResolvedCharge, asOfDate: Date): boolean {
  return startOfUTCDay(charge.cashOutflowDate).getTime() < startOfUTCDay(asOfDate).getTime();
}

/**
 * Splits a month forecast into charges that still need cash vs charges whose
 * due date has already passed. Totals/line items on the original forecast are
 * left intact so monthly accounting (balance, full-month outflow) is unchanged.
 */
export function splitForecastBySettlement(
  forecast: EomForecastResult,
  asOfDate: Date
): SettledForecastSplit {
  const remainingCharges: ResolvedCharge[] = [];
  const settledCharges: ResolvedCharge[] = [];

  for (const item of forecast.lineItems) {
    for (const charge of item.charges) {
      if (isChargeSettled(charge, asOfDate)) {
        settledCharges.push(charge);
      } else {
        remainingCharges.push(charge);
      }
    }
  }

  const remaining = groupChargesByPaymentMethod(remainingCharges).map((item) => ({
    ...item,
    charges: sortChargesByDueDate(item.charges, "asc"),
  }));
  const settled = groupChargesByPaymentMethod(settledCharges).map((item) => ({
    ...item,
    charges: sortChargesByDueDate(item.charges, "desc"),
  }));

  return {
    remaining,
    remainingTotal: roundCurrency(remaining.reduce((sum, item) => sum + item.amountDue, 0)),
    settled,
    settledTotal: roundCurrency(settled.reduce((sum, item) => sum + item.amountDue, 0)),
  };
}

// ---------------------------------------------------------------------------
// Top-level forecast
// ---------------------------------------------------------------------------

export interface ComputeEomForecastOptions {
  /** How many months before the reference month to scan for charges whose
   * cash-outflow date could still land inside it. Default 3. */
  lookbackMonths?: number;
}

/**
 * Computes the total estimated cash required by the end of the calendar
 * month containing `referenceDate`, across all of a user's payment
 * methods, one-off purchases, and recurring/fixed-term subscriptions.
 *
 * For each candidate charge (a purchase, or one resolved occurrence of a
 * subscription), the actual cash-outflow date is resolved via the owning
 * payment method (immediate for debit cards/bank accounts, statement due
 * date for credit cards), then charges whose outflow date falls in the
 * reference month are summed, grouped by payment method.
 */
export function computeEomForecast(
  paymentMethods: PaymentMethodInput[],
  purchases: PurchaseInput[],
  subscriptions: SubscriptionInput[],
  referenceDate: Date,
  options: ComputeEomForecastOptions = {}
): EomForecastResult {
  const lookbackMonths = options.lookbackMonths ?? DEFAULT_LOOKBACK_MONTHS;
  const monthStart = startOfUTCMonth(referenceDate);
  const monthEnd = endOfUTCMonth(referenceDate);
  const windowStart = addUTCMonths(monthStart, -lookbackMonths);

  const paymentMethodsById = new Map(paymentMethods.map((pm) => [pm.id, pm]));
  const resolvedCharges: ResolvedCharge[] = [];

  for (const purchase of purchases) {
    if (!purchase.paymentMethodId) {
      // Not tied to a tracked account (e.g. cash) — nothing to forecast.
      continue;
    }
    if (purchase.purchaseDate < windowStart || purchase.purchaseDate > monthEnd) {
      continue;
    }
    const paymentMethod = paymentMethodsById.get(purchase.paymentMethodId);
    if (!paymentMethod) {
      continue;
    }

    resolvedCharges.push({
      source: "PURCHASE",
      sourceId: purchase.id,
      paymentMethodId: purchase.paymentMethodId,
      amount: purchase.amount,
      chargeDate: purchase.purchaseDate,
      cashOutflowDate: resolveCashOutflowDate(paymentMethod, purchase.purchaseDate),
    });
  }

  for (const subscription of subscriptions) {
    const paymentMethod = paymentMethodsById.get(subscription.paymentMethodId);
    if (!paymentMethod) {
      continue;
    }

    const occurrenceDates = expandSubscriptionOccurrences(
      subscription,
      windowStart,
      monthEnd
    );

    for (const occurrence of occurrenceDates) {
      resolvedCharges.push(
        resolveSubscriptionCharge(subscription, occurrence, paymentMethod)
      );
    }
  }

  const chargesInMonth = resolvedCharges.filter(
    (charge) =>
      charge.cashOutflowDate >= monthStart && charge.cashOutflowDate <= monthEnd
  );

  const lineItems = groupChargesByPaymentMethod(chargesInMonth);
  const total = roundCurrency(
    lineItems.reduce((sum, item) => sum + item.amountDue, 0)
  );

  return { referenceMonthStart: monthStart, referenceMonthEnd: monthEnd, total, lineItems };
}

/**
 * Sums every charge (purchase or subscription occurrence) whose cash
 * outflow date falls on or before the end of the calendar month containing
 * `referenceDate` — with no lower bound, unlike `computeEomForecast`'s
 * lookback window. This is the "total cash that has left (or will have
 * left) the accounts, all-time through this month" figure needed to carry
 * a running balance forward from one month to the next, instead of each
 * month's net resetting to zero.
 */
export function computeCumulativeExpenses(
  paymentMethods: PaymentMethodInput[],
  purchases: PurchaseInput[],
  subscriptions: SubscriptionInput[],
  referenceDate: Date
): number {
  const monthEnd = endOfUTCMonth(referenceDate);
  const paymentMethodsById = new Map(paymentMethods.map((pm) => [pm.id, pm]));
  let total = 0;

  for (const purchase of purchases) {
    if (!purchase.paymentMethodId || purchase.purchaseDate > monthEnd) {
      continue;
    }
    const paymentMethod = paymentMethodsById.get(purchase.paymentMethodId);
    if (!paymentMethod) {
      continue;
    }
    const cashOutflowDate = resolveCashOutflowDate(paymentMethod, purchase.purchaseDate);
    if (cashOutflowDate > monthEnd) {
      continue;
    }
    total += purchase.amount;
  }

  for (const subscription of subscriptions) {
    const paymentMethod = paymentMethodsById.get(subscription.paymentMethodId);
    if (!paymentMethod) {
      continue;
    }

    const occurrenceDates = expandSubscriptionOccurrences(
      subscription,
      subscription.startDate,
      monthEnd
    );

    for (const occurrence of occurrenceDates) {
      const cashOutflowDate = resolveCashOutflowDate(paymentMethod, occurrence.date);
      if (cashOutflowDate > monthEnd) {
        continue;
      }
      total += subscription.amount;
    }
  }

  return roundCurrency(total);
}

// ---------------------------------------------------------------------------
// Total debt + payoff ETA
// ---------------------------------------------------------------------------

export interface ComputeDebtSummaryOptions {
  /** "Now", for splitting past (already incurred) from future (not yet
   * charged) occurrences. Defaults to `new Date()`. */
  asOfDate?: Date;
}

/**
 * Computes total outstanding debt and a payoff ETA, as of `asOfDate`
 * (default now), assuming no further purchases or ongoing-subscription
 * charges are added from this point on. Debt here means:
 *
 * - Any already-incurred charge (purchase, or subscription occurrence —
 *   ongoing or fixed-term) whose cash-outflow date hasn't happened yet
 *   (charged to a credit card but not yet paid off).
 * - Every *remaining* (not-yet-charged) installment of an active
 *   FIXED_TERM subscription, since those are a committed obligation with
 *   a known end, unlike ONGOING_MONTHLY/ONGOING_ANNUAL subscriptions which
 *   recur indefinitely and are treated as regular ongoing expenses rather
 *   than "debt to pay off".
 *
 * `payoffEta` is the latest cash-outflow date among all of the above —
 * the date by which everything currently owed will be fully paid off,
 * assuming nothing new is added. `null` when there's no outstanding debt.
 */
export function computeDebtSummary(
  paymentMethods: PaymentMethodInput[],
  purchases: PurchaseInput[],
  subscriptions: SubscriptionInput[],
  options: ComputeDebtSummaryOptions = {}
): DebtSummary {
  const asOfDate = options.asOfDate ?? new Date();
  const paymentMethodsById = new Map(paymentMethods.map((pm) => [pm.id, pm]));
  const debtCharges: ResolvedCharge[] = [];

  // Already-incurred purchases not yet paid off.
  for (const purchase of purchases) {
    if (!purchase.paymentMethodId || purchase.purchaseDate > asOfDate) {
      continue;
    }
    const paymentMethod = paymentMethodsById.get(purchase.paymentMethodId);
    if (!paymentMethod) {
      continue;
    }
    const cashOutflowDate = resolveCashOutflowDate(paymentMethod, purchase.purchaseDate);
    if (cashOutflowDate <= asOfDate) {
      continue; // already paid off
    }
    debtCharges.push({
      source: "PURCHASE",
      sourceId: purchase.id,
      paymentMethodId: purchase.paymentMethodId,
      amount: purchase.amount,
      chargeDate: purchase.purchaseDate,
      cashOutflowDate,
    });
  }

  for (const subscription of subscriptions) {
    const paymentMethod = paymentMethodsById.get(subscription.paymentMethodId);
    if (!paymentMethod) {
      continue;
    }

    // FIXED_TERM: every installment (past-and-unpaid, or not yet charged)
    // counts as debt — the whole term is a committed obligation.
    // ONGOING_MONTHLY/ONGOING_ANNUAL: only already-incurred-but-unpaid
    // occurrences count; future occurrences are an ongoing expense, not
    // debt to pay off.
    const windowEnd =
      subscription.billingType === "FIXED_TERM"
        ? dateAtDayOfMonth(
            absoluteMonth(subscription.startDate) + (subscription.totalMonths ?? 0),
            subscription.billingDayOfMonth
          )
        : asOfDate;

    const occurrenceDates = expandSubscriptionOccurrences(
      subscription,
      subscription.startDate,
      windowEnd
    );

    for (const occurrence of occurrenceDates) {
      const cashOutflowDate = resolveCashOutflowDate(paymentMethod, occurrence.date);
      if (cashOutflowDate <= asOfDate) {
        continue; // already paid off
      }
      debtCharges.push(
        resolveSubscriptionCharge(subscription, occurrence, paymentMethod)
      );
    }
  }

  const lineItems = groupChargesByPaymentMethod(debtCharges);
  const total = roundCurrency(lineItems.reduce((sum, item) => sum + item.amountDue, 0));
  const payoffEta =
    debtCharges.length === 0
      ? null
      : new Date(Math.max(...debtCharges.map((charge) => charge.cashOutflowDate.getTime())));

  return { asOf: asOfDate, total, payoffEta, lineItems };
}
