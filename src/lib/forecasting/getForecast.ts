import "server-only";
import { prisma } from "@/lib/prisma";
import { computeEomForecast } from "./index";
import type {
  EomForecastResult,
  PaymentMethodInput,
  PurchaseInput,
  SubscriptionInput,
} from "./types";

/**
 * Data-access wrapper around the pure forecasting engine: loads a user's
 * payment methods, purchases, and subscriptions from Prisma, adapts them
 * (Decimal -> number) into the engine's plain input types, and computes
 * the EOM cash forecast for the given reference month.
 *
 * Note: this currently loads *all* of a user's purchases/subscriptions
 * rather than pre-filtering by date in the query. Fine at this app's scale
 * (personal finance, single-user datasets); if that ever becomes a
 * bottleneck, bound the purchases query to a window around referenceDate
 * mirroring the engine's own lookback (see DEFAULT_LOOKBACK_MONTHS).
 */
export async function getEomForecastForUser(
  userId: string,
  referenceDate: Date
): Promise<EomForecastResult> {
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

  return computeEomForecast(
    paymentMethodInputs,
    purchaseInputs,
    subscriptionInputs,
    referenceDate
  );
}
