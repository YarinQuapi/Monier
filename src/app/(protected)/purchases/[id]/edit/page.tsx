import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { updatePurchase } from "../../actions";
import { PurchaseForm } from "../../PurchaseForm";
import styles from "../../page.module.css";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  const { id } = await params;

  const [purchase, categories, paymentMethods] = await Promise.all([
    prisma.purchase.findUnique({ where: { id } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { nickname: "asc" },
    }),
  ]);

  if (!purchase || purchase.userId !== session.user.id) {
    notFound();
  }

  const boundUpdatePurchase = updatePurchase.bind(null, purchase.id);

  return (
    <div className={styles.wrapper}>
      <div>
        <Link className={styles.backLink} href="/purchases">
          &larr; Back to purchases
        </Link>
        <h1>Edit purchase</h1>
      </div>

      <PurchaseForm
        action={boundUpdatePurchase}
        submitLabel="Save changes"
        categories={categories}
        paymentMethods={paymentMethods}
        defaultValues={{
          categoryId: purchase.categoryId,
          paymentMethodId: purchase.paymentMethodId,
          amount: Number(purchase.amount),
          merchant: purchase.merchant,
          purchaseDate: toDateInputValue(purchase.purchaseDate),
          notes: purchase.notes,
        }}
      />
    </div>
  );
}
