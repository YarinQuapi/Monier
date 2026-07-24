import Link from "next/link";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { createPurchase, deletePurchase } from "./actions";
import { AddPurchaseModal } from "./AddPurchaseModal";
import styles from "./page.module.css";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

type SortMode = "category" | "date";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const session = await verifySession();
  const { sort } = await searchParams;
  const sortMode: SortMode = sort === "date" ? "date" : "category";

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

  const categoryGroups = new Map<
    string,
    { category: (typeof purchases)[number]["category"]; items: typeof purchases }
  >();

  for (const purchase of purchases) {
    const existing = categoryGroups.get(purchase.categoryId);
    if (existing) {
      existing.items.push(purchase);
    } else {
      categoryGroups.set(purchase.categoryId, {
        category: purchase.category,
        items: [purchase],
      });
    }
  }

  const sortedGroups = Array.from(categoryGroups.values())
    .map((group) => ({
      category: group.category,
      items: [...group.items].sort(
        (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime()
      ),
    }))
    .sort((a, b) => a.category.name.localeCompare(b.category.name));

  const purchasesByDate = [...purchases].sort(
    (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime()
  );

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Purchases"
        description="One-off expenses, tagged against the admin-managed category taxonomy and optionally linked to a payment method."
        actions={
          <AddPurchaseModal
            action={createPurchase}
            categories={categories}
            paymentMethods={paymentMethods}
            isAdmin={session.user.role === "ADMIN"}
          />
        }
      />

      <Card>
        <div className={styles.sectionTitleRow}>
          <h2 className={styles.sectionTitle}>Your purchases ({purchases.length})</h2>

          <div className={styles.sortToggle}>
            <Link
              href="/purchases?sort=category"
              className={`${styles.sortToggleLink} ${
                sortMode === "category" ? styles.sortToggleLinkActive : ""
              }`}
            >
              By category
            </Link>
            <Link
              href="/purchases?sort=date"
              className={`${styles.sortToggleLink} ${
                sortMode === "date" ? styles.sortToggleLinkActive : ""
              }`}
            >
              By date
            </Link>
          </div>
        </div>

        {purchases.length === 0 ? (
          <EmptyState>No purchases yet — add one to get started.</EmptyState>
        ) : sortMode === "date" ? (
          <div className={styles.flatScroll}>
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
                {purchasesByDate.map((purchase) => (
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
                    <td className={styles.amount}>
                      {formatCurrency(purchase.amount.toString())}
                    </td>
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
                          <input type="hidden" name="sort" value={sortMode} />
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
          </div>
        ) : (
          <div className={styles.categoryGroupList}>
            {sortedGroups.map(({ category, items }) => {
              const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
              return (
                <details key={category.id} className={styles.categoryGroup} open>
                  <summary className={styles.categoryGroupHeader}>
                    <span className={styles.categoryCell}>
                      {category.color && (
                        <span
                          className={styles.swatch}
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.name}
                    </span>
                    <span className={styles.categoryGroupMeta}>
                      {items.length} purchase{items.length === 1 ? "" : "s"} ·{" "}
                      {formatCurrency(total)}
                    </span>
                  </summary>

                  <div className={styles.categoryScroll}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Merchant</th>
                          <th>Amount</th>
                          <th>Payment method</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((purchase) => (
                          <tr key={purchase.id}>
                            <td>{formatDate(purchase.purchaseDate)}</td>
                            <td>{purchase.merchant ?? "—"}</td>
                            <td className={styles.amount}>
                              {formatCurrency(purchase.amount.toString())}
                            </td>
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
                                  <input
                                    type="hidden"
                                    name="purchaseId"
                                    value={purchase.id}
                                  />
                                  <input type="hidden" name="sort" value={sortMode} />
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
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
