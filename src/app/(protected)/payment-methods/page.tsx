import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
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
      <PageHeader
        title="Payment Methods"
        description="Credit cards and bank accounts. Every subscription (and, if applicable, purchase) is linked to one of these."
      />

      {error === "in-use" && (
        <p className={styles.banner}>
          That payment method can&apos;t be deleted because it&apos;s still
          linked to an active subscription. Remove or reassign that
          subscription first.
        </p>
      )}

      <Card>
        <h2 className={styles.sectionTitle}>
          Your payment methods ({paymentMethods.length})
        </h2>

        {paymentMethods.length === 0 ? (
          <EmptyState>No payment methods yet — add one below.</EmptyState>
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
                  <td className={styles.nicknameCell}>
                    {pm.nickname}
                    {pm.institution ? ` (${pm.institution})` : ""}
                  </td>
                  <td>
                    <Badge tone={pm.type === "CREDIT_CARD" ? "primary" : "neutral"}>
                      {pm.type === "CREDIT_CARD" ? "Credit card" : "Bank account"}
                    </Badge>
                  </td>
                  <td className={styles.muted}>
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
                        <Button variant="secondary" type="submit">
                          {pm.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </form>
                      <form action={deletePaymentMethod}>
                        <input type="hidden" name="paymentMethodId" value={pm.id} />
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
        <h2 className={styles.sectionTitle}>Add a payment method</h2>
        <PaymentMethodForm
          action={createPaymentMethod}
          submitLabel="Add payment method"
        />
      </Card>
    </div>
  );
}
