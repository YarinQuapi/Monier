import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
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
      <div>
        <h1>Subscriptions</h1>
        <p>
          Ongoing-monthly or fixed-term subscriptions, each linked to a
          payment method. Multiple accounts with the same provider are
          distinguished by their account label.
        </p>
      </div>

      {error === "delete-failed" && (
        <p className={styles.banner}>Couldn&apos;t delete that subscription.</p>
      )}

      <section className={styles.section}>
        <h2>Your subscriptions ({subscriptions.length})</h2>

        {subscriptions.length === 0 ? (
          <p className={styles.empty}>No subscriptions yet — add one below.</p>
        ) : (
          <table className={styles.table}>
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
                  <td>
                    {sub.providerName}
                    <br />
                    <small>{sub.accountLabel}</small>
                  </td>
                  <td>${sub.amount.toString()}</td>
                  <td>{sub.paymentMethod.nickname}</td>
                  <td>
                    <span className={styles.badge}>
                      {sub.billingType === "FIXED_TERM"
                        ? `Fixed term: ${sub.totalMonths}mo`
                        : "Ongoing monthly"}
                    </span>
                    <br />
                    <small>from {formatDate(sub.startDate)}</small>
                  </td>
                  <td>
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
                        <button className={styles.toggleButton} type="submit">
                          {sub.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={deleteSubscription}>
                        <input type="hidden" name="subscriptionId" value={sub.id} />
                        <button className={styles.deleteButton} type="submit">
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2>Add a subscription</h2>

        {paymentMethods.length === 0 ? (
          <p className={styles.noPaymentMethods}>
            You need at least one active{" "}
            <Link href="/payment-methods">payment method</Link> before adding
            a subscription.
          </p>
        ) : (
          <SubscriptionForm
            action={createSubscription}
            submitLabel="Add subscription"
            paymentMethods={paymentMethods}
          />
        )}
      </section>
    </div>
  );
}
