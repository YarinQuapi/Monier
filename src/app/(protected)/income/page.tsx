import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
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
      <div>
        <h1>Income</h1>
        <p>Manually logged salary and miscellaneous income entries.</p>
      </div>

      <section className={styles.section}>
        <h2>Your income ({incomes.length})</h2>

        {incomes.length === 0 ? (
          <p className={styles.empty}>No income logged yet — add one below.</p>
        ) : (
          <table className={styles.table}>
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
                  <td>{formatDate(income.receivedAt)}</td>
                  <td>
                    <span className={styles.badge}>
                      {income.type === "SALARY" ? "Salary" : "Misc"}
                    </span>
                  </td>
                  <td>{income.label}</td>
                  <td>${income.amount.toString()}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editLink}
                        href={`/income/${income.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={deleteIncome}>
                        <input type="hidden" name="incomeId" value={income.id} />
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
        <h2>Add income</h2>
        <IncomeForm action={createIncome} submitLabel="Add income" />
      </section>
    </div>
  );
}
