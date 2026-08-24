import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import {
  createSubscription,
  deleteSubscription,
  toggleSubscriptionActive,
} from "./actions";
import { SubscriptionForm } from "./SubscriptionForm";
import styles from "./page.module.css";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await verifySession();
  const { error } = await searchParams;

  const [subscriptions, paymentMethods] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId: session.user.id },
      include: { paymentMethod: true },
      orderBy: [{ isActive: "desc" }, { providerName: "asc" }],
    }),
    prisma.paymentMethod.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { nickname: "asc" },
    }),
  ]);

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Subscriptions"
        description="Ongoing-monthly or fixed-term subscriptions, each linked to a payment method. Multiple accounts with the same provider are distinguished by their account label."
      />

      {error === "delete-failed" && (
        <p className={styles.banner}>Couldn&apos;t delete that subscription.</p>
      )}

      <Card>
        <h2 className={styles.sectionTitle}>
          Your subscriptions ({subscriptions.length})
        </h2>

        {subscriptions.length === 0 ? (
          <EmptyState>No subscriptions yet — add one below.</EmptyState>
        ) : (
          <table className={styles.table} data-stack>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Amount</th>
                <th>Payment method</th>
                <th>Billing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr
                  key={sub.id}
                  className={sub.isActive ? undefined : styles.inactive}
                >
                  <td data-label="Provider">
                    <span className={styles.providerCell}>{sub.providerName}</span>
                    <br />
                    <small className={styles.muted}>{sub.accountLabel}</small>
                  </td>
                  <td className={styles.amount} data-label="Amount">{formatCurrency(sub.amount.toString())}</td>
                  <td data-label="Payment method">{sub.paymentMethod.nickname}</td>
                  <td data-label="Billing">
                    <Badge tone={sub.billingType === "FIXED_TERM" ? "warning" : "primary"}>
                      {sub.billingType === "FIXED_TERM"
                        ? `Fixed term: ${sub.totalMonths}mo`
                        : sub.billingType === "ONGOING_ANNUAL"
                          ? "Ongoing annual"
                          : "Ongoing monthly"}
                    </Badge>
                    <br />
                    <small className={styles.muted}>from {formatDate(sub.startDate)}</small>
                  </td>
                  <td data-label="">
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editLink}
                        href={`/subscriptions/${sub.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={toggleSubscriptionActive}>
                        <input type="hidden" name="subscriptionId" value={sub.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(sub.isActive)}
                        />
                        <Button variant="secondary" type="submit">
                          {sub.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                      <form action={deleteSubscription}>
                        <input type="hidden" name="subscriptionId" value={sub.id} />
                        <Button variant="danger" type="submit">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Add a subscription</h2>

        {paymentMethods.length === 0 ? (
          <EmptyState>
            You need at least one active{" "}
            <Link href="/payment-methods">payment method</Link> before adding a
            subscription.
          </EmptyState>
        ) : (
          <SubscriptionForm
            action={createSubscription}
            submitLabel="Add subscription"
            paymentMethods={paymentMethods}
          />
        )}
      </Card>
    </div>
  );
}
