import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getCashFlowSummaryForUser } from "@/lib/forecasting/getForecast";
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

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await verifySession();
  const { month } = await searchParams;
  const referenceDate = parseMonthParam(month);

  const [cashFlow, paymentMethods] = await Promise.all([
    getCashFlowSummaryForUser(session.user.id, referenceDate),
    prisma.paymentMethod.findMany({ where: { userId: session.user.id } }),
  ]);
  const { forecast, income, net } = cashFlow;

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
      <div>
        <h1>Dashboard</h1>
        <p>Welcome, {session.user.email}.</p>
      </div>

      <div className={styles.forecastHeader}>
        <Link
          href={`/dashboard?month=${formatMonthParam(prevMonth)}`}
          className={styles.navLink}
        >
          &larr; Prev
        </Link>
        <div className={styles.forecastTitle}>
          <h2>Cash flow</h2>
          <span>
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

      <section className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Income</span>
          <span className={styles.statValue}>{formatCurrency(income.total)}</span>
          <span className={styles.statSubtext}>
            {income.entries.length} entr{income.entries.length === 1 ? "y" : "ies"}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Cash needed</span>
          <span className={styles.statValue}>{formatCurrency(forecast.total)}</span>
          <span className={styles.statSubtext}>
            across {forecast.lineItems.length} payment method
            {forecast.lineItems.length === 1 ? "" : "s"}
          </span>
        </div>
        <div
          className={`${styles.statCard} ${net >= 0 ? styles.statPositive : styles.statNegative}`}
        >
          <span className={styles.statLabel}>Net</span>
          <span className={styles.statValue}>{formatCurrency(net)}</span>
          <span className={styles.statSubtext}>
            {net >= 0 ? "projected surplus" : "projected shortfall"}
          </span>
        </div>
      </section>

      {income.entries.length > 0 && (
        <section className={styles.section}>
          <h2>Income this month</h2>
          <ul className={styles.chargeList}>
            {income.entries.map((entry) => (
              <li key={entry.id}>
                <span className={styles.chargeBadge}>
                  {entry.type === "SALARY" ? "Salary" : "Misc"}
                </span>{" "}
                {entry.label} — {formatCurrency(entry.amount)} on{" "}
                {formatDate(entry.receivedAt)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2>Cash needed by payment method</h2>

        {forecast.lineItems.length === 0 ? (
          <p className={styles.empty}>
            No charges are projected to hit your accounts this month.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Payment method</th>
                <th>Amount due</th>
                <th>Charges</th>
              </tr>
            </thead>
            <tbody>
              {forecast.lineItems.map((item) => {
                const paymentMethod = paymentMethodsById.get(item.paymentMethodId);
                return (
                  <tr key={item.paymentMethodId}>
                    <td>
                      {paymentMethod?.nickname ?? "Unknown payment method"}
                      <br />
                      <small className={styles.muted}>
                        {paymentMethod?.type === "CREDIT_CARD"
                          ? "Credit card"
                          : "Bank account"}
                      </small>
                    </td>
                    <td className={styles.amount}>
                      {formatCurrency(item.amountDue)}
                    </td>
                    <td>
                      <ul className={styles.chargeList}>
                        {item.charges.map((charge) => (
                          <li
                            key={`${charge.source}-${charge.sourceId}-${charge.chargeDate.toISOString()}`}
                          >
                            <span className={styles.chargeBadge}>
                              {charge.source === "SUBSCRIPTION"
                                ? "Subscription"
                                : "Purchase"}
                            </span>{" "}
                            {formatCurrency(charge.amount)} charged{" "}
                            {formatDate(charge.chargeDate)}
                            {paymentMethod?.type === "CREDIT_CARD"
                              ? ` — due ${formatDate(charge.cashOutflowDate)}`
                              : ""}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
