import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import {
  createPaymentMethod,
  deletePaymentMethod,
  togglePaymentMethodActive,
} from "./actions";
import { PaymentMethodForm } from "./PaymentMethodForm";
import styles from "./page.module.css";

export default async function PaymentMethodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await verifySession();
  const { error } = await searchParams;

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isActive: "desc" }, { nickname: "asc" }],
  });

  return (
    <div className={styles.wrapper}>
      <div>
        <h1>Payment Methods</h1>
        <p>
          Credit cards and bank accounts. Every subscription (and, if
          applicable, purchase) is linked to one of these.
        </p>
      </div>

      {error === "in-use" && (
        <p className={styles.banner}>
          That payment method can&apos;t be deleted because it&apos;s still
          linked to an active subscription. Remove or reassign that
          subscription first.
        </p>
      )}

      <section className={styles.section}>
        <h2>Your payment methods ({paymentMethods.length})</h2>

        {paymentMethods.length === 0 ? (
          <p className={styles.empty}>
            No payment methods yet — add one below.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nickname</th>
                <th>Type</th>
                <th>Billing (cards only)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((pm) => (
                <tr
                  key={pm.id}
                  className={pm.isActive ? undefined : styles.inactive}
                >
                  <td>
                    {pm.nickname}
                    {pm.institution ? ` (${pm.institution})` : ""}
                  </td>
                  <td>
                    <span className={styles.badge}>
                      {pm.type === "CREDIT_CARD" ? "Credit card" : "Bank account"}
                    </span>
                  </td>
                  <td>
                    {pm.type === "CREDIT_CARD"
                      ? `Cycle starts ${pm.cycleStartDay} · due ${pm.paymentDueDay} (+${pm.dueMonthOffset}mo)`
                      : "—"}
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editLink}
                        href={`/payment-methods/${pm.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={togglePaymentMethodActive}>
                        <input type="hidden" name="paymentMethodId" value={pm.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={String(pm.isActive)}
                        />
                        <button className={styles.toggleButton} type="submit">
                          {pm.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </form>
                      <form action={deletePaymentMethod}>
                        <input type="hidden" name="paymentMethodId" value={pm.id} />
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
        <h2>Add a payment method</h2>
        <PaymentMethodForm
          action={createPaymentMethod}
          submitLabel="Add payment method"
        />
      </section>
    </div>
  );
}
