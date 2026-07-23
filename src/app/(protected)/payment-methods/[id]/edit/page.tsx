import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { updatePaymentMethod } from "../../actions";
import { PaymentMethodForm } from "../../PaymentMethodForm";
import styles from "../../page.module.css";

export default async function EditPaymentMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  const { id } = await params;

  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { id },
  });

  if (!paymentMethod || paymentMethod.userId !== session.user.id) {
    notFound();
  }

  const boundUpdatePaymentMethod = updatePaymentMethod.bind(
    null,
    paymentMethod.id
  );

  return (
    <div className={styles.wrapper}>
      <div>
        <Link className={styles.backLink} href="/payment-methods">
          &larr; Back to payment methods
        </Link>
        <h1>Edit payment method</h1>
      </div>

      <PaymentMethodForm
        action={boundUpdatePaymentMethod}
        submitLabel="Save changes"
        defaultValues={{
          type: paymentMethod.type,
          nickname: paymentMethod.nickname,
          institution: paymentMethod.institution,
          cycleStartDay: paymentMethod.cycleStartDay,
          paymentDueDay: paymentMethod.paymentDueDay,
          dueMonthOffset: paymentMethod.dueMonthOffset,
        }}
      />
    </div>
  );
}
