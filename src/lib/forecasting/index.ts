import type {
  BillingCycle,
  ChargeInput,
  EomForecastResult,
  PaymentMethodInput,
} from "./types";

export type {
  BillingCycle,
  ChargeInput,
  EomForecastResult,
  PaymentMethodInput,
} from "./types";

/**
 * Given a credit card's cycleStartDay, resolves the billing cycle
 * (and its payment due date) that a given date falls into.
 *
 * Algorithm (see architecture plan, Section 4 "EOM Cash Forecasting
 * Algorithm"):
 * - A cycle starting on day D of month M runs from D/M through
 *   (D-1)/(M+1).
 * - The resulting statement is due on `paymentDueDay` in month
 *   `M + 1 + dueMonthOffset` (dueMonthOffset defaults to 1).
 *
 * TODO: implement — not yet built, this is a structural placeholder.
 */
export function resolveBillingCycle(
  _paymentMethod: PaymentMethodInput,
  _date: Date
): BillingCycle {
  throw new Error("resolveBillingCycle is not implemented yet.");
}

/**
 * Computes the total estimated cash required by the end of the calendar
 * month containing `referenceDate`, across all of a user's payment
 * methods, purchases, and resolved subscription charges.
 *
 * TODO: implement — not yet built, this is a structural placeholder.
 */
export function computeEomForecast(
  _paymentMethods: PaymentMethodInput[],
  _charges: ChargeInput[],
  _referenceDate: Date
): EomForecastResult {
  throw new Error("computeEomForecast is not implemented yet.");
}
