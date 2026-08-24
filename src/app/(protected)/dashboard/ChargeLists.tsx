import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/currency";
import {
  countDisplayItems,
  formatInstallmentMeta,
  formatSubscriptionGroupSummary,
  formatSubscriptionLabel,
  groupChargesForDisplay,
  sortDisplayItems,
  type ChargeDisplayItem,
} from "@/lib/forecasting/chargeDisplay";
import type { EomForecastLineItem, ResolvedCharge } from "@/lib/forecasting/types";
import styles from "./page.module.css";

export type PaymentMethodInfo = {
  nickname: string;
  type: "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT";
};

export type ChargeLineMode = "due" | "paid" | "debt";

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatPaymentMethodType(
  type: PaymentMethodInfo["type"] | undefined
): string {
  if (type === "CREDIT_CARD") return "Credit card";
  if (type === "DEBIT_CARD") return "Debit card";
  return "Bank account";
}

function chargeKey(charge: ResolvedCharge): string {
  return `${charge.source}-${charge.sourceId}-${charge.chargeDate.toISOString()}`;
}

function outflowLabel(mode: ChargeLineMode): string {
  if (mode === "paid") return "paid";
  if (mode === "debt") return "paid off";
  return "due";
}

export function formatChargeLine(
  charge: ResolvedCharge,
  methodType: PaymentMethodInfo["type"] | undefined,
  mode: ChargeLineMode
): string {
  const amount = formatCurrency(charge.amount);
  const charged = formatDate(charge.chargeDate);
  const installmentMeta = formatInstallmentMeta(charge);
  const prefix = installmentMeta ? `${installmentMeta} — ` : "";

  if (methodType === "CREDIT_CARD") {
    const outflow = formatDate(charge.cashOutflowDate);
    return `${prefix}${amount} charged ${charged} — ${outflowLabel(mode)} ${outflow}`;
  }
  return `${prefix}${amount} charged ${charged}`;
}

function PurchaseChargeRow({
  charge,
  methodType,
  mode,
}: {
  charge: ResolvedCharge;
  methodType: PaymentMethodInfo["type"] | undefined;
  mode: ChargeLineMode;
}) {
  return (
    <li key={chargeKey(charge)}>
      <Badge tone="neutral">Purchase</Badge> {formatChargeLine(charge, methodType, mode)}
    </li>
  );
}

function SubscriptionChargeGroup({
  item,
  methodType,
  mode,
}: {
  item: Extract<ChargeDisplayItem, { type: "subscription" }>;
  methodType: PaymentMethodInfo["type"] | undefined;
  mode: ChargeLineMode;
}) {
  const label = formatSubscriptionLabel(item.providerName, item.accountLabel);
  const summary = formatSubscriptionGroupSummary(item);
  const singleCharge = item.charges.length === 1;

  if (singleCharge) {
    const charge = item.charges[0];
    return (
      <li key={item.sourceId}>
        <Badge tone="primary">Subscription</Badge>{" "}
        <span className={styles.chargeSubscriptionLabel}>{label}</span>{" "}
        {formatChargeLine(charge, methodType, mode)}
      </li>
    );
  }

  return (
    <li key={item.sourceId} className={styles.subscriptionGroup}>
      <details className={styles.subscriptionGroupDetails}>
        <summary className={styles.subscriptionGroupSummary}>
          <Badge tone="primary">Subscription</Badge>
          <span className={styles.chargeSubscriptionLabel}>{label}</span>
          <span className={styles.subscriptionGroupMeta}>
            {formatCurrency(item.totalAmount)} · {summary}
          </span>
        </summary>
        <ul className={styles.subscriptionInstallmentList}>
          {item.charges.map((charge) => (
            <li key={chargeKey(charge)}>{formatChargeLine(charge, methodType, mode)}</li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function ChargeDisplayList({
  charges,
  methodType,
  mode,
}: {
  charges: ResolvedCharge[];
  methodType: PaymentMethodInfo["type"] | undefined;
  mode: ChargeLineMode;
}) {
  const items = sortDisplayItems(groupChargesForDisplay(charges), mode === "paid" ? "desc" : "asc");

  return (
    <>
      {items.map((item) =>
        item.type === "purchase" ? (
          <PurchaseChargeRow
            key={chargeKey(item.charge)}
            charge={item.charge}
            methodType={methodType}
            mode={mode}
          />
        ) : (
          <SubscriptionChargeGroup
            key={item.sourceId}
            item={item}
            methodType={methodType}
            mode={mode}
          />
        )
      )}
    </>
  );
}

export function PaymentMethodChargeList({
  lineItems,
  paymentMethodsById,
  mode,
  amountHeader,
  openAll = false,
  chargeCountLabel = "Charges",
}: {
  lineItems: EomForecastLineItem[];
  paymentMethodsById: Map<string, PaymentMethodInfo>;
  mode: ChargeLineMode;
  amountHeader: string;
  openAll?: boolean;
  chargeCountLabel?: string;
}) {
  return (
    <div className={styles.lineList}>
      <div className={styles.lineListHeader}>
        <span>Payment method</span>
        <span>{amountHeader}</span>
        <span>{chargeCountLabel}</span>
      </div>
      {lineItems.map((item) => {
        const paymentMethod = paymentMethodsById.get(item.paymentMethodId);
        const displayCount = countDisplayItems(item.charges);
        return (
          <details
            key={item.paymentMethodId}
            className={styles.lineItem}
            open={openAll || undefined}
          >
            <summary className={styles.lineItemSummary}>
              <span className={styles.methodCell}>
                <span className={styles.methodName}>
                  {paymentMethod?.nickname ?? "Unknown payment method"}
                </span>
                <Badge tone="neutral">
                  {formatPaymentMethodType(paymentMethod?.type)}
                </Badge>
              </span>
              <span className={styles.amount}>{formatCurrency(item.amountDue)}</span>
              <span className={styles.chargeToggle}>
                {displayCount} item{displayCount === 1 ? "" : "s"}
              </span>
            </summary>
            <ul className={styles.chargeList}>
              <ChargeDisplayList
                charges={item.charges}
                methodType={paymentMethod?.type}
                mode={mode}
              />
            </ul>
          </details>
        );
      })}
    </div>
  );
}

export function ChronologicalChargeList({
  lineItems,
  paymentMethodsById,
  mode,
}: {
  lineItems: EomForecastLineItem[];
  paymentMethodsById: Map<string, PaymentMethodInfo>;
  mode: ChargeLineMode;
}) {
  const charges = lineItems.flatMap((item) =>
    item.charges.map((charge) => ({
      charge,
      paymentMethodId: item.paymentMethodId,
    }))
  );

  const items = sortDisplayItems(
    groupChargesForDisplay(charges.map(({ charge }) => charge)),
    mode === "paid" ? "desc" : "asc"
  );

  const paymentMethodByChargeKey = new Map(
    charges.map(({ charge, paymentMethodId }) => [chargeKey(charge), paymentMethodId])
  );

  function methodTypeForItem(item: ChargeDisplayItem) {
    const charge =
      item.type === "purchase" ? item.charge : item.charges[0];
    const paymentMethodId = paymentMethodByChargeKey.get(chargeKey(charge));
    return paymentMethodId
      ? paymentMethodsById.get(paymentMethodId)?.type
      : undefined;
  }

  function paymentMethodNicknameForItem(item: ChargeDisplayItem) {
    const charge =
      item.type === "purchase" ? item.charge : item.charges[0];
    const paymentMethodId = paymentMethodByChargeKey.get(chargeKey(charge));
    return paymentMethodId
      ? (paymentMethodsById.get(paymentMethodId)?.nickname ?? "Unknown payment method")
      : "Unknown payment method";
  }

  return (
    <ul className={styles.chargeList}>
      {items.map((item) => {
        const methodType = methodTypeForItem(item);
        const methodNickname = paymentMethodNicknameForItem(item);

        if (item.type === "purchase") {
          return (
            <li key={chargeKey(item.charge)}>
              <Badge tone="neutral">Purchase</Badge>
              <span className={styles.chargeMethod}>{methodNickname}</span>
              {formatChargeLine(item.charge, methodType, mode)}
            </li>
          );
        }

        const label = formatSubscriptionLabel(item.providerName, item.accountLabel);
        if (item.charges.length === 1) {
          return (
            <li key={item.sourceId}>
              <Badge tone="primary">Subscription</Badge>
              <span className={styles.chargeMethod}>{methodNickname}</span>
              <span className={styles.chargeSubscriptionLabel}>{label}</span>
              {formatChargeLine(item.charges[0], methodType, mode)}
            </li>
          );
        }

        return (
          <li key={item.sourceId} className={styles.subscriptionGroup}>
            <details className={styles.subscriptionGroupDetails}>
              <summary className={styles.subscriptionGroupSummary}>
                <Badge tone="primary">Subscription</Badge>
                <span className={styles.chargeMethod}>{methodNickname}</span>
                <span className={styles.chargeSubscriptionLabel}>{label}</span>
                <span className={styles.subscriptionGroupMeta}>
                  {formatCurrency(item.totalAmount)} · {formatSubscriptionGroupSummary(item)}
                </span>
              </summary>
              <ul className={styles.subscriptionInstallmentList}>
                {item.charges.map((charge) => (
                  <li key={chargeKey(charge)}>
                    {formatChargeLine(charge, methodType, mode)}
                  </li>
                ))}
              </ul>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
