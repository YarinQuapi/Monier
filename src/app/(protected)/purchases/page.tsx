import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { createPurchase, deletePurchase } from "./actions";
import { PurchaseForm } from "./PurchaseForm";
import styles from "./page.module.css";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function PurchasesPage() {
  const session = await verifySession();

  const [purchases, categories, paymentMethods] = await Promise.all([
    prisma.purchase.findMany({
      where: { userId: session.user.id },
      include: { category: true, paymentMethod: true },
      orderBy: { purchaseDate: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { nickname: "asc" },
    }),
  ]);

  return (
    <div className={styles.wrapper}>
      <div>
        <h1>Purchases</h1>
        <p>
          One-off expenses, tagged against the admin-managed category
          taxonomy and optionally linked to a payment method.
        </p>
      </div>

      <section className={styles.section}>
        <h2>Your purchases ({purchases.length})</h2>

        {purchases.length === 0 ? (
          <p className={styles.empty}>No purchases yet — add one below.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Merchant</th>
                <th>Amount</th>
                <th>Payment method</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((purchase) => (
                <tr key={purchase.id}>
                  <td>{formatDate(purchase.purchaseDate)}</td>
                  <td>
                    {purchase.category.color && (
                      <span
                        className={styles.swatch}
                        style={{ backgroundColor: purchase.category.color }}
                      />
                    )}
                    {purchase.category.name}
                  </td>
                  <td>{purchase.merchant ?? "—"}</td>
                  <td>${purchase.amount.toString()}</td>
                  <td>{purchase.paymentMethod?.nickname ?? "Cash / none"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editLink}
                        href={`/purchases/${purchase.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={deletePurchase}>
                        <input type="hidden" name="purchaseId" value={purchase.id} />
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
        <h2>Add a purchase</h2>

        {categories.length === 0 ? (
          <p className={styles.noCategories}>
            No categories exist yet.{" "}
            {session.user.role === "ADMIN" ? (
              <>
                Create one in the{" "}
                <Link href="/admin/categories">Admin panel</Link> first.
              </>
            ) : (
              "Ask an admin to add some before logging a purchase."
            )}
          </p>
        ) : (
          <PurchaseForm
            action={createPurchase}
            submitLabel="Add purchase"
            categories={categories}
            paymentMethods={paymentMethods}
          />
        )}
      </section>
    </div>
  );
}
