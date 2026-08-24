import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { getDashboardSummaryForUser } from "@/lib/forecasting/getForecast";
import { endOfUTCMonth, startOfUTCDay } from "@/lib/forecasting";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import {
  ChronologicalChargeList,
  formatDate,
  PaymentMethodChargeList,
} from "./ChargeLists";
import { countDisplayItems } from "@/lib/forecasting/chargeDisplay";
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

type ChargeView = "due" | "history";
type HistoryLayout = "method" | "charges";

function dashboardHref({
  month,
  view,
  method,
  layout,
}: {
  month: string;
  view: ChargeView;
  method?: string;
  layout?: HistoryLayout;
}): string {
  const params = new URLSearchParams();
  params.set("month", month);
  params.set("view", view);
  if (method) params.set("method", method);
  if (view === "history" && layout === "charges") params.set("layout", "charges");
  return `/dashboard?${params.toString()}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string; method?: string; layout?: string }>;
}) {
  const session = await verifySession();
  const { month, view: viewParam, method: methodParam, layout: layoutParam } =
    await searchParams;
  const referenceDate = parseMonthParam(month);

  const [summary, paymentMethods] = await Promise.all([
    getDashboardSummaryForUser(session.user.id, referenceDate),
    prisma.paymentMethod.findMany({ where: { userId: session.user.id } }),
  ]);
  const { cashFlow, debt, monthCharges, asOf } = summary;
  const { income, balance } = cashFlow;

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
  const isPastMonth =
    endOfUTCMonth(referenceDate).getTime() < startOfUTCDay(asOf).getTime();

  const view: ChargeView =
    viewParam === "history" || viewParam === "due"
      ? viewParam
      : isPastMonth
        ? "history"
        : "due";
  const layout: HistoryLayout = layoutParam === "charges" ? "charges" : "method";

  const methodIds = new Set(
    [...monthCharges.remaining, ...monthCharges.settled].map(
      (item) => item.paymentMethodId
    )
  );
  const methodFilter =
    methodParam && methodIds.has(methodParam) ? methodParam : undefined;

  const sourceItems = view === "history" ? monthCharges.settled : monthCharges.remaining;
  const visibleItems = methodFilter
    ? sourceItems.filter((item) => item.paymentMethodId === methodFilter)
    : sourceItems;

  const remainingChargeCount = monthCharges.remaining.reduce(
    (sum, item) => sum + countDisplayItems(item.charges),
    0
  );
  const settledChargeCount = monthCharges.settled.reduce(
    (sum, item) => sum + countDisplayItems(item.charges),
    0
  );

  const monthKey = formatMonthParam(referenceDate);
  const hrefFor = (
    next: Partial<{ view: ChargeView; method: string | undefined; layout: HistoryLayout; month: string }>
  ) =>
    dashboardHref({
      month: next.month ?? monthKey,
      view: next.view ?? view,
      method: "method" in next ? next.method : methodFilter,
      layout: next.layout ?? layout,
    });

  const cashNeededLabel = isPastMonth ? "Paid" : "Cash needed";
  const cashNeededValue = isPastMonth
    ? monthCharges.settledTotal
    : monthCharges.remainingTotal;
  const cashNeededSubtext = isPastMonth
    ? `across ${monthCharges.settled.length} payment method${monthCharges.settled.length === 1 ? "" : "s"}`
    : remainingChargeCount === 0
      ? "nothing left to pay this month"
      : `still due across ${monthCharges.remaining.length} payment method${monthCharges.remaining.length === 1 ? "" : "s"}`;

  const filterMethods = [...methodIds]
    .map((id) => paymentMethodsById.get(id))
    .filter((pm): pm is NonNullable<typeof pm> => Boolean(pm))
    .sort((a, b) => a.nickname.localeCompare(b.nickname));

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
              <PaymentMethodChargeList
                lineItems={debt.lineItems}
                paymentMethodsById={paymentMethodsById}
                mode="debt"
                amountHeader="Outstanding"
                chargeCountLabel="Owed charges"
              />
            )}
          </div>
        </Card>

        <Card className={styles.gridCard}>
          <div className={styles.cardScroll}>
            <div className={styles.monthNav}>
              <Link href={hrefFor({ month: formatMonthParam(prevMonth) })} className={styles.navLink}>
                &larr; Prev
              </Link>
              <div className={styles.monthNavTitle}>
                <h2>Cash flow</h2>
                <span className={styles.sectionSubtext}>
                  {formatMonthLabel(referenceDate)}
                  {isCurrentMonth ? " (current)" : ""}
                </span>
              </div>
              <Link href={hrefFor({ month: formatMonthParam(nextMonth) })} className={styles.navLink}>
                Next &rarr;
              </Link>
            </div>

            <div className={styles.statGrid3}>
              <StatCard
                label="Income"
                value={formatCurrency(income.total)}
                subtext={`${income.entries.length} entr${income.entries.length === 1 ? "y" : "ies"}`}
              />
              <StatCard
                label={cashNeededLabel}
                value={formatCurrency(cashNeededValue)}
                subtext={cashNeededSubtext}
              />
              <StatCard
                label="Balance"
                value={formatCurrency(balance)}
                subtext={
                  balance >= 0
                    ? "income added, charges removed, carried forward"
                    : "in the red — carried forward"
                }
                tone={balance >= 0 ? "positive" : "negative"}
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
              <div className={styles.subsectionHeader}>
                <h3>{view === "history" ? "Paid this month" : "Cash needed by payment method"}</h3>
                <div className={styles.viewToggle}>
                  <Link
                    href={hrefFor({ view: "due" })}
                    className={`${styles.viewToggleLink} ${view === "due" ? styles.viewToggleLinkActive : ""}`}
                  >
                    Still due
                    {remainingChargeCount > 0 ? ` · ${remainingChargeCount}` : ""}
                  </Link>
                  <Link
                    href={hrefFor({ view: "history" })}
                    className={`${styles.viewToggleLink} ${view === "history" ? styles.viewToggleLinkActive : ""}`}
                  >
                    History
                    {settledChargeCount > 0 ? ` · ${settledChargeCount}` : ""}
                  </Link>
                </div>
              </div>

              <p className={styles.sectionHint}>
                {view === "history"
                  ? "Charges whose due date has already passed. Browse other months with the arrows above."
                  : "Only charges that still need cash. After the due date they move to History."}
              </p>

              {view === "history" && (
                <div className={styles.viewToggle}>
                  <Link
                    href={hrefFor({ view: "history", layout: "method" })}
                    className={`${styles.viewToggleLink} ${layout === "method" ? styles.viewToggleLinkActive : ""}`}
                  >
                    By payment method
                  </Link>
                  <Link
                    href={hrefFor({ view: "history", layout: "charges" })}
                    className={`${styles.viewToggleLink} ${layout === "charges" ? styles.viewToggleLinkActive : ""}`}
                  >
                    All charges
                  </Link>
                </div>
              )}

              {filterMethods.length > 1 && (
                <div className={styles.filterRow}>
                  <Link
                    href={hrefFor({ method: undefined })}
                    className={`${styles.filterChip} ${!methodFilter ? styles.filterChipActive : ""}`}
                  >
                    All methods
                  </Link>
                  {filterMethods.map((pm) => (
                    <Link
                      key={pm.id}
                      href={hrefFor({ method: pm.id })}
                      className={`${styles.filterChip} ${methodFilter === pm.id ? styles.filterChipActive : ""}`}
                    >
                      {pm.nickname}
                    </Link>
                  ))}
                </div>
              )}

              {visibleItems.length === 0 ? (
                <EmptyState>
                  {view === "history" ? (
                    settledChargeCount === 0 ? (
                      "No paid charges this month."
                    ) : (
                      "No paid charges for this payment method."
                    )
                  ) : remainingChargeCount === 0 && settledChargeCount > 0 ? (
                    <>
                      Nothing left to pay this month.{" "}
                      <Link href={hrefFor({ view: "history" })}>View history</Link>
                    </>
                  ) : remainingChargeCount === 0 ? (
                    "No charges are projected to hit your accounts this month."
                  ) : (
                    "No remaining charges for this payment method."
                  )}
                </EmptyState>
              ) : view === "history" && layout === "charges" ? (
                <ChronologicalChargeList
                  lineItems={visibleItems}
                  paymentMethodsById={paymentMethodsById}
                  mode="paid"
                />
              ) : (
                <PaymentMethodChargeList
                  lineItems={visibleItems}
                  paymentMethodsById={paymentMethodsById}
                  mode={view === "history" ? "paid" : "due"}
                  amountHeader={view === "history" ? "Amount paid" : "Amount due"}
                  openAll={Boolean(methodFilter)}
                />
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
