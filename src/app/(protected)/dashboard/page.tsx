import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getDashboardSummaryForUser } from "@/lib/forecasting/getForecast";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import styles from "./page.module.css";

function parseMonthParam(month: string | undefined): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split("-").map(Number);
    return new Date(Date.UTC(year, monthNum - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function formatMonthParam(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatPaymentMethodType(type: "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT" | undefined): string {
  if (type === "CREDIT_CARD") return "Credit card";
  if (type === "DEBIT_CARD") return "Debit card";
  return "Bank account";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await verifySession();
  const { month } = await searchParams;
  const referenceDate = parseMonthParam(month);

  const [summary, paymentMethods] = await Promise.all([
    getDashboardSummaryForUser(session.user.id, referenceDate),
    prisma.paymentMethod.findMany({ where: { userId: session.user.id } }),
  ]);
  const { cashFlow, debt } = summary;
  const { forecast, income, net, cumulativeNet } = cashFlow;

  const paymentMethodsById = new Map(paymentMethods.map((pm) => [pm.id, pm]));

  const prevMonth = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - 1, 1)
  );
  const nextMonth = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1)
  );
  const currentMonth = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
  );
  const isCurrentMonth = referenceDate.getTime() === currentMonth.getTime();

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${session.user.name ?? session.user.email}.`}
      />

      <div className={styles.grid}>
        <Card className={styles.gridCard}>
          <div className={styles.cardScroll}>
            <div className={styles.sectionHeading}>
              <h2>Total debt</h2>
              <span className={styles.sectionSubtext}>as of today</span>
            </div>

            <div className={styles.statGrid}>
              <StatCard
                label="Total debt"
                value={formatCurrency(debt.total)}
                subtext={`outstanding across ${debt.lineItems.length} payment method${debt.lineItems.length === 1 ? "" : "s"}`}
              />
              <StatCard
                label="Payoff ETA"
                value={debt.payoffEta ? formatDate(debt.payoffEta) : "—"}
                subtext={
                  debt.payoffEta ? "assuming no new charges are added" : "no outstanding debt"
                }
              />
            </div>

            {debt.lineItems.length > 0 && (
              <div className={styles.lineList}>
                <div className={styles.lineListHeader}>
                  <span>Payment method</span>
                  <span>Outstanding</span>
                  <span>Owed charges</span>
                </div>
                {debt.lineItems.map((item) => {
                  const paymentMethod = paymentMethodsById.get(item.paymentMethodId);
                  return (
                    <details key={item.paymentMethodId} className={styles.lineItem}>
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
                          {item.charges.length} charge{item.charges.length === 1 ? "" : "s"}
                        </span>
                      </summary>
                      <ul className={styles.chargeList}>
                        {item.charges.map((charge) => (
                          <li
                            key={`${charge.source}-${charge.sourceId}-${charge.chargeDate.toISOString()}`}
                          >
                            <Badge tone={charge.source === "SUBSCRIPTION" ? "primary" : "neutral"}>
                              {charge.source === "SUBSCRIPTION" ? "Subscription" : "Purchase"}
                            </Badge>{" "}
                            {formatCurrency(charge.amount)} charged{" "}
                            {formatDate(charge.chargeDate)} — paid off{" "}
                            {formatDate(charge.cashOutflowDate)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className={styles.gridCard}>
          <div className={styles.cardScroll}>
            <div className={styles.monthNav}>
              <Link
                href={`/dashboard?month=${formatMonthParam(prevMonth)}`}
                className={styles.navLink}
              >
                &larr; Prev
              </Link>
              <div className={styles.monthNavTitle}>
                <h2>Cash flow</h2>
                <span className={styles.sectionSubtext}>
                  {formatMonthLabel(referenceDate)}
                  {isCurrentMonth ? " (current)" : ""}
                </span>
              </div>
              <Link
                href={`/dashboard?month=${formatMonthParam(nextMonth)}`}
                className={styles.navLink}
              >
                Next &rarr;
              </Link>
            </div>

            <div className={styles.statGrid4}>
              <StatCard
                label="Income"
                value={formatCurrency(income.total)}
                subtext={`${income.entries.length} entr${income.entries.length === 1 ? "y" : "ies"}`}
              />
              <StatCard
                label="Cash needed"
                value={formatCurrency(forecast.total)}
                subtext={`across ${forecast.lineItems.length} payment method${forecast.lineItems.length === 1 ? "" : "s"}`}
              />
              <StatCard
                label="This month's net"
                value={formatCurrency(net)}
                subtext={net >= 0 ? "projected surplus" : "projected shortfall"}
                tone={net >= 0 ? "positive" : "negative"}
              />
              <StatCard
                label="Running balance"
                value={formatCurrency(cumulativeNet)}
                subtext={
                  cumulativeNet >= 0
                    ? "carried forward into next month"
                    : "shortfall carried forward"
                }
                tone={cumulativeNet >= 0 ? "positive" : "negative"}
              />
            </div>

            {income.entries.length > 0 && (
              <div className={styles.subsection}>
                <h3>Income this month</h3>
                <ul className={styles.chargeList}>
                  {income.entries.map((entry) => (
                    <li key={entry.id}>
                      <Badge tone={entry.type === "SALARY" ? "success" : "neutral"}>
                        {entry.type === "SALARY" ? "Salary" : "Misc"}
                      </Badge>{" "}
                      {entry.label} — {formatCurrency(entry.amount)} on{" "}
                      {formatDate(entry.receivedAt)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.subsection}>
              <h3>Cash needed by payment method</h3>

              {forecast.lineItems.length === 0 ? (
                <EmptyState>
                  No charges are projected to hit your accounts this month.
                </EmptyState>
              ) : (
                <div className={styles.lineList}>
                  <div className={styles.lineListHeader}>
                    <span>Payment method</span>
                    <span>Amount due</span>
                    <span>Charges</span>
                  </div>
                  {forecast.lineItems.map((item) => {
                    const paymentMethod = paymentMethodsById.get(item.paymentMethodId);
                    return (
                      <details key={item.paymentMethodId} className={styles.lineItem}>
                        <summary className={styles.lineItemSummary}>
                          <span className={styles.methodCell}>
                            <span className={styles.methodName}>
                              {paymentMethod?.nickname ?? "Unknown payment method"}
                            </span>
                            <Badge tone="neutral">
                              {formatPaymentMethodType(paymentMethod?.type)}
                            </Badge>
                          </span>
                          <span className={styles.amount}>
                            {formatCurrency(item.amountDue)}
                          </span>
                          <span className={styles.chargeToggle}>
                            {item.charges.length} charge{item.charges.length === 1 ? "" : "s"}
                          </span>
                        </summary>
                        <ul className={styles.chargeList}>
                          {item.charges.map((charge) => (
                            <li
                              key={`${charge.source}-${charge.sourceId}-${charge.chargeDate.toISOString()}`}
                            >
                              <Badge tone={charge.source === "SUBSCRIPTION" ? "primary" : "neutral"}>
                                {charge.source === "SUBSCRIPTION" ? "Subscription" : "Purchase"}
                              </Badge>{" "}
                              {formatCurrency(charge.amount)} charged{" "}
                              {formatDate(charge.chargeDate)}
                              {paymentMethod?.type === "CREDIT_CARD"
                                ? ` — due ${formatDate(charge.cashOutflowDate)}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
