import Link from "next/link";
import { notFound } from "next/navigation";
import { verifyAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
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
        <PageHeader title="Edit category" />
      </div>

      <Card>
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
      </Card>
    </div>
  );
}
