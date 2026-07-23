import Link from "next/link";
import { notFound } from "next/navigation";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { updateIncome } from "../../actions";
import { IncomeForm } from "../../IncomeForm";
import styles from "../../page.module.css";

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function EditIncomePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifySession();
  const { id } = await params;

  const income = await prisma.income.findUnique({ where: { id } });

  if (!income || income.userId !== session.user.id) {
    notFound();
  }

  const boundUpdateIncome = updateIncome.bind(null, income.id);

  return (
    <div className={styles.wrapper}>
      <div>
        <Link className={styles.backLink} href="/income">
          &larr; Back to income
        </Link>
        <h1>Edit income</h1>
      </div>

      <IncomeForm
        action={boundUpdateIncome}
        submitLabel="Save changes"
        defaultValues={{
          type: income.type,
          label: income.label,
          amount: Number(income.amount),
          receivedAt: toDateInputValue(income.receivedAt),
          notes: income.notes,
        }}
      />
    </div>
  );
}
