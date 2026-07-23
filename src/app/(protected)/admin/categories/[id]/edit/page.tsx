import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { updateCategory } from "../../actions";
import { CategoryForm } from "../../CategoryForm";
import styles from "../../page.module.css";

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await verifyAdmin();
  const { id } = await params;

  const category = await prisma.category.findUnique({ where: { id } });

  if (!category) {
    notFound();
  }

  const boundUpdateCategory = updateCategory.bind(null, category.id);

  return (
    <div className={styles.wrapper}>
      <div>
        <Link className={styles.backLink} href="/admin/categories">
          &larr; Back to categories
        </Link>
        <h1>Edit category</h1>
      </div>

      <CategoryForm
        action={boundUpdateCategory}
        submitLabel="Save changes"
        defaultValues={{
          name: category.name,
          description: category.description,
          color: category.color,
          icon: category.icon,
        }}
      />
    </div>
  );
}
