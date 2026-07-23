import Link from "next/link";
import { verifyAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
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
      <div>
        <h1>Admin: Categories</h1>
        <p>
          This is the global taxonomy every user picks from when tagging a
          purchase. Only admins can create, edit, or remove categories.
        </p>
      </div>

      {error === "in-use" && (
        <p className={styles.banner}>
          That category can&apos;t be deleted because it is still used by
          existing purchases.
        </p>
      )}

      <section className={styles.section}>
        <h2>Existing categories ({categories.length})</h2>

        {categories.length === 0 ? (
          <p className={styles.empty}>No categories yet — add the first one below.</p>
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
                    {category.color && (
                      <span
                        className={styles.swatch}
                        style={{ backgroundColor: category.color }}
                      />
                    )}
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </td>
                  <td>{category.description ?? "—"}</td>
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
        <h2>Add a new category</h2>
        <CategoryForm action={createCategory} submitLabel="Create category" />
      </section>
    </div>
  );
}
