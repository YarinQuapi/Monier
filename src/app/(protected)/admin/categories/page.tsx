import Link from "next/link";
import { verifyAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { createCategory, deleteCategory } from "./actions";
import { CategoryForm } from "./CategoryForm";
import styles from "./page.module.css";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await verifyAdmin();
  const { error } = await searchParams;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Admin: Categories"
        description="This is the global taxonomy every user picks from when tagging a purchase. Only admins can create, edit, or remove categories."
      />

      {error === "in-use" && (
        <p className={styles.banner}>
          That category can&apos;t be deleted because it is still used by
          existing purchases.
        </p>
      )}

      <Card>
        <h2 className={styles.sectionTitle}>
          Existing categories ({categories.length})
        </h2>

        {categories.length === 0 ? (
          <EmptyState>No categories yet — add the first one below.</EmptyState>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <span className={styles.nameCell}>
                      {category.color && (
                        <span
                          className={styles.swatch}
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                    </span>
                  </td>
                  <td className={styles.muted}>{category.description ?? "—"}</td>
                  <td>
                    <div className={styles.rowActions}>
                      <Link
                        className={styles.editLink}
                        href={`/admin/categories/${category.id}/edit`}
                      >
                        Edit
                      </Link>
                      <form action={deleteCategory}>
                        <input
                          type="hidden"
                          name="categoryId"
                          value={category.id}
                        />
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
        <h2 className={styles.sectionTitle}>Add a new category</h2>
        <CategoryForm action={createCategory} submitLabel="Create category" />
      </Card>
    </div>
  );
}
