import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { updateSubscription } from "../../actions";
import { SubscriptionForm } from "../../SubscriptionForm";
import styles from "../../page.module.css";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function EditSubscriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  const { id } = await params;

  const [subscription, paymentMethods] = await Promise.all([
    prisma.subscription.findUnique({ where: { id } }),
    prisma.paymentMethod.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { nickname: "asc" },
    }),
  ]);

  if (!subscription || subscription.userId !== session.user.id) {
    notFound();
  }

  const boundUpdateSubscription = updateSubscription.bind(
    null,
    subscription.id
  );

  return (
    <div className={styles.wrapper}>
      <div>
        <Link className={styles.backLink} href="/subscriptions">
          &larr; Back to subscriptions
        </Link>
        <h1>Edit subscription</h1>
      </div>

      <SubscriptionForm
        action={boundUpdateSubscription}
        submitLabel="Save changes"
        paymentMethods={paymentMethods}
        defaultValues={{
          providerName: subscription.providerName,
          accountLabel: subscription.accountLabel,
          amount: Number(subscription.amount),
          paymentMethodId: subscription.paymentMethodId,
          billingType: subscription.billingType,
          startDate: toDateInputValue(subscription.startDate),
          totalMonths: subscription.totalMonths,
          endDate: subscription.endDate
            ? toDateInputValue(subscription.endDate)
            : null,
          notes: subscription.notes,
        }}
      />
    </div>
  );
}
