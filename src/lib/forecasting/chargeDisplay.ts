import { roundCurrency } from "./index";
import type { ResolvedCharge, SubscriptionBillingKind } from "./types";

export type ChargeDisplayItem =
  | { type: "purchase"; charge: ResolvedCharge }
  | {
      type: "subscription";
      sourceId: string;
      providerName: string;
      accountLabel: string;
      billingType: SubscriptionBillingKind;
      charges: ResolvedCharge[];
      totalAmount: number;
    };

/** Groups subscription charges that share a sourceId into one display row. */
export function groupChargesForDisplay(charges: ResolvedCharge[]): ChargeDisplayItem[] {
  const items: ChargeDisplayItem[] = [];
  const subscriptionChargesById = new Map<string, ResolvedCharge[]>();

  for (const charge of charges) {
    if (charge.source === "SUBSCRIPTION") {
      const existing = subscriptionChargesById.get(charge.sourceId);
      if (existing) {
        existing.push(charge);
      } else {
        subscriptionChargesById.set(charge.sourceId, [charge]);
      }
      continue;
    }
    items.push({ type: "purchase", charge });
  }

  for (const [sourceId, subCharges] of subscriptionChargesById) {
    const first = subCharges[0];
    items.push({
      type: "subscription",
      sourceId,
      providerName: first.subscriptionProviderName ?? "Subscription",
      accountLabel: first.subscriptionAccountLabel ?? "",
      billingType: first.subscriptionBillingType ?? "ONGOING_MONTHLY",
      charges: [...subCharges].sort(
        (a, b) => a.cashOutflowDate.getTime() - b.cashOutflowDate.getTime()
      ),
      totalAmount: roundCurrency(subCharges.reduce((sum, charge) => sum + charge.amount, 0)),
    });
  }

  return items;
}

export function countDisplayItems(charges: ResolvedCharge[]): number {
  return groupChargesForDisplay(charges).length;
}

function displayItemSortDate(item: ChargeDisplayItem): number {
  if (item.type === "purchase") {
    return item.charge.cashOutflowDate.getTime();
  }
  return item.charges[0]?.cashOutflowDate.getTime() ?? 0;
}

/** Sorts display items by cash-outflow date (earliest first). */
export function sortDisplayItems(
  items: ChargeDisplayItem[],
  direction: "asc" | "desc"
): ChargeDisplayItem[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => sign * (displayItemSortDate(a) - displayItemSortDate(b)));
}

export function formatSubscriptionLabel(providerName: string, accountLabel: string): string {
  if (accountLabel.trim().length === 0) {
    return providerName;
  }
  return `${providerName} · ${accountLabel}`;
}

export function formatInstallmentMeta(charge: ResolvedCharge): string | null {
  if (
    charge.subscriptionBillingType !== "FIXED_TERM" ||
    charge.installmentNumber == null ||
    charge.totalInstallments == null
  ) {
    return null;
  }
  const remaining = charge.totalInstallments - charge.installmentNumber;
  return `Charge ${charge.installmentNumber} of ${charge.totalInstallments} · ${remaining} left`;
}

export function formatSubscriptionGroupSummary(item: Extract<ChargeDisplayItem, { type: "subscription" }>): string {
  const parts: string[] = [];
  const chargeCount = item.charges.length;
  parts.push(`${chargeCount} installment${chargeCount === 1 ? "" : "s"}`);

  if (item.billingType === "FIXED_TERM") {
    const first = item.charges[0];
    const last = item.charges[item.charges.length - 1];
    if (
      first.installmentNumber != null &&
      last.installmentNumber != null &&
      first.totalInstallments != null
    ) {
      const range =
        first.installmentNumber === last.installmentNumber
          ? `${first.installmentNumber}`
          : `${first.installmentNumber}–${last.installmentNumber}`;
      parts.push(`charges ${range} of ${first.totalInstallments}`);
      const remainingAfterLast = first.totalInstallments - last.installmentNumber;
      parts.push(`${remainingAfterLast} left after last`);
    }
  }

  return parts.join(" · ");
}
