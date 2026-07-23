import "server-only";
import { prisma } from "@/lib/prisma";
import {
  computeDebtSummary,
  computeEomForecast,
  endOfUTCMonth,
  roundCurrency,
  startOfUTCMonth,
} from "./index";
import type {
  CashFlowSummary,
  DebtSummary,
  EomForecastResult,
  IncomeSummary,
  PaymentMethodInput,
  PurchaseInput,
  SubscriptionInput,
} from "./types";

/**
 * Loads a user's payment methods, purchases, and subscriptions from Prisma
 * and adapts them (Decimal -> number) into the forecasting engine's plain
 * input types. Shared by every forecast/debt function below.
 *
 * Note: this currently loads *all* of a user's purchases/subscriptions
 * rather than pre-filtering by date in the query. Fine at this app's scale
 * (personal finance, single-user datasets); if that ever becomes a
 * bottleneck, bound the purchases query to a window mirroring the engine's
 * own lookback (see DEFAULT_LOOKBACK_MONTHS in ./index.ts).
 */
async function loadForecastInputsForUser(userId: string): Promise<{
  paymentMethodInputs: PaymentMethodInput[];
  purchaseInputs: PurchaseInput[];
  subscriptionInputs: SubscriptionInput[];
}> {
  const [paymentMethods, purchases, subscriptions] = await Promise.all([
    prisma.paymentMethod.findMany({ where: { userId } }),
    prisma.purchase.findMany({ where: { userId } }),
    prisma.subscription.findMany({ where: { userId } }),
  ]);

  const paymentMethodInputs: PaymentMethodInput[] = paymentMethods.map((pm) => ({
    id: pm.id,
    type: pm.type,
    cycleStartDay: pm.cycleStartDay,
    paymentDueDay: pm.paymentDueDay,
    dueMonthOffset: pm.dueMonthOffset,
  }));

  const purchaseInputs: PurchaseInput[] = purchases.map((purchase) => ({
    id: purchase.id,
    paymentMethodId: purchase.paymentMethodId,
    amount: Number(purchase.amount),
    purchaseDate: purchase.purchaseDate,
  }));

  const subscriptionInputs: SubscriptionInput[] = subscriptions.map((sub) => ({
    id: sub.id,
    paymentMethodId: sub.paymentMethodId,
    amount: Number(sub.amount),
    billingType: sub.billingType,
    billingDayOfMonth: sub.billingDayOfMonth,
    startDate: sub.startDate,
    totalMonths: sub.totalMonths,
    endDate: sub.endDate,
    isActive: sub.isActive,
  }));

  return { paymentMethodInputs, purchaseInputs, subscriptionInputs };
}

/**
 * Computes the EOM cash forecast for the given reference month.
 */
export async function getEomForecastForUser(
  userId: string,
  referenceDate: Date
): Promise<EomForecastResult> {
  const { paymentMethodInputs, purchaseInputs, subscriptionInputs } =
    await loadForecastInputsForUser(userId);

  return computeEomForecast(
    paymentMethodInputs,
    purchaseInputs,
    subscriptionInputs,
    referenceDate
  );
}

/**
 * Computes total outstanding debt and a payoff ETA as of now. See
 * computeDebtSummary in ./index.ts for exactly what counts as "debt".
 */
export async function getDebtSummaryForUser(userId: string): Promise<DebtSummary> {
  const { paymentMethodInputs, purchaseInputs, subscriptionInputs } =
    await loadForecastInputsForUser(userId);

  return computeDebtSummary(paymentMethodInputs, purchaseInputs, subscriptionInputs);
}

/**
 * Sums a user's logged income (salary + misc) received within the calendar
 * month containing `referenceDate`. Unlike expenses, income has no
 * "cash-outflow lag" concept — it's counted the month it was received.
 */
export async function getIncomeSummaryForUser(
  userId: string,
  referenceDate: Date
): Promise<IncomeSummary> {
  const monthStart = startOfUTCMonth(referenceDate);
  const monthEnd = endOfUTCMonth(referenceDate);

  const incomes = await prisma.income.findMany({
    where: { userId, receivedAt: { gte: monthStart, lte: monthEnd } },
    orderBy: { receivedAt: "asc" },
  });

  const entries = incomes.map((income) => ({
    id: income.id,
    type: income.type,
    label: income.label,
    amount: Number(income.amount),
    receivedAt: income.receivedAt,
  }));

  const byType: Record<"SALARY" | "MISC", number> = { SALARY: 0, MISC: 0 };
  for (const entry of entries) {
    byType[entry.type] += entry.amount;
  }
  byType.SALARY = roundCurrency(byType.SALARY);
  byType.MISC = roundCurrency(byType.MISC);

  return {
    referenceMonthStart: monthStart,
    referenceMonthEnd: monthEnd,
    total: roundCurrency(byType.SALARY + byType.MISC),
    byType,
    entries,
  };
}

/**
 * Combines the EOM expense forecast with the month's logged income into a
 * single net cash-flow picture: `net = income.total - forecast.total`.
 */
export async function getCashFlowSummaryForUser(
  userId: string,
  referenceDate: Date
): Promise<CashFlowSummary> {
  const [forecast, income] = await Promise.all([
    getEomForecastForUser(userId, referenceDate),
    getIncomeSummaryForUser(userId, referenceDate),
  ]);

  return {
    income,
    forecast,
    net: roundCurrency(income.total - forecast.total),
  };
}

export interface DashboardSummary {
  cashFlow: CashFlowSummary;
  debt: DebtSummary;
}

/**
 * Everything the dashboard needs in one pass: loads payment
 * methods/purchases/subscriptions/income once and derives the cash-flow
 * summary (for the reference month) plus the total-debt/payoff-ETA
 * summary (as of now) from the same data, instead of re-querying Prisma
 * per metric.
 */
export async function getDashboardSummaryForUser(
  userId: string,
  referenceDate: Date
): Promise<DashboardSummary> {
  const [{ paymentMethodInputs, purchaseInputs, subscriptionInputs }, income] =
    await Promise.all([
      loadForecastInputsForUser(userId),
      getIncomeSummaryForUser(userId, referenceDate),
    ]);

  const forecast = computeEomForecast(
    paymentMethodInputs,
    purchaseInputs,
    subscriptionInputs,
    referenceDate
  );
  const debt = computeDebtSummary(paymentMethodInputs, purchaseInputs, subscriptionInputs);

  return {
    cashFlow: { income, forecast, net: roundCurrency(income.total - forecast.total) },
    debt,
  };
}
