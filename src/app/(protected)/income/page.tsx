import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { createIncome, deleteIncome } from "./actions";
import { IncomeForm } from "./IncomeForm";
import styles from "./page.module.css";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function IncomePage() {
  const session = await verifySession();

  const incomes = await prisma.income.findMany({
    where: { userId: session.user.id },
    orderBy: { receivedAt: "desc" },
  });

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Income"
        description="Manually logged salary and miscellaneous income entries."
      />

      <Card>
        <h2 className={styles.sectionTitle}>Your income ({incomes.length})</h2>

        {incomes.length === 0 ? (
          <EmptyState>No income logged yet — add one below.</EmptyState>
        ) : (
          <table className={styles.table} data-stack>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Label</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {incomes.map((income) => (
                <tr key={income.id}>
                  <td data-label="Date">{formatDate(income.receivedAt)}</td>
                  <td data-label="Type">
                    <Badge tone={income.type === "SALARY" ? "success" : "neutral"}>
                      {income.type === "SALARY" ? "Salary" : "Misc"}
                    </Badge>
                  </td>
                  <td data-label="Label">{income.label}</td>
                  <td className={styles.amount} data-label="Amount">{formatCurrency(income.amount.toString())}</td>
                  <td data-label="">
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editLink}
                        href={`/income/${income.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={deleteIncome}>
                        <input type="hidden" name="incomeId" value={income.id} />
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
        <h2 className={styles.sectionTitle}>Add income</h2>
        <IncomeForm action={createIncome} submitLabel="Add income" />
      </Card>
    </div>
  );
}
