import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
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
      <PageHeader
        title="Purchases"
        description="One-off expenses, tagged against the admin-managed category taxonomy and optionally linked to a payment method."
      />

      <Card>
        <h2 className={styles.sectionTitle}>Your purchases ({purchases.length})</h2>

        {purchases.length === 0 ? (
          <EmptyState>No purchases yet — add one below.</EmptyState>
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
                    <span className={styles.categoryCell}>
                      {purchase.category.color && (
                        <span
                          className={styles.swatch}
                          style={{ backgroundColor: purchase.category.color }}
                        />
                      )}
                      {purchase.category.name}
                    </span>
                  </td>
                  <td>{purchase.merchant ?? "—"}</td>
                  <td className={styles.amount}>${purchase.amount.toString()}</td>
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
        <h2 className={styles.sectionTitle}>Add a purchase</h2>

        {categories.length === 0 ? (
          <EmptyState>
            No categories exist yet.{" "}
            {session.user.role === "ADMIN" ? (
              <>
                Create one in the <Link href="/admin/categories">Admin panel</Link>{" "}
                first.
              </>
            ) : (
              "Ask an admin to add some before logging a purchase."
            )}
          </EmptyState>
        ) : (
          <PurchaseForm
            action={createPurchase}
            submitLabel="Add purchase"
            categories={categories}
            paymentMethods={paymentMethods}
          />
        )}
      </Card>
    </div>
  );
}
