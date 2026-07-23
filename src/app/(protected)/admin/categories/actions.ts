"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyAdmin } from "@/lib/authorization";

export type CategoryFormState = { error?: string } | undefined;

function readCategoryFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const descriptionRaw = String(formData.get("description") ?? "").trim();
  const colorRaw = String(formData.get("color") ?? "").trim();
  const iconRaw = String(formData.get("icon") ?? "").trim();

  return {
    name,
    description: descriptionRaw.length > 0 ? descriptionRaw : null,
    color: colorRaw.length > 0 ? colorRaw : null,
    icon: iconRaw.length > 0 ? iconRaw : null,
  };
}

export async function createCategory(
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  const session = await verifyAdmin();
  const { name, description, color, icon } = readCategoryFields(formData);

  if (name.length === 0) {
    return { error: "Category name is required." };
  }

  try {
    await prisma.category.create({
      data: {
        name,
        description,
        color,
        icon,
        createdById: session.user.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: `A category named "${name}" already exists.` };
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  return undefined;
}

export async function updateCategory(
  categoryId: string,
  _prevState: CategoryFormState,
  formData: FormData
): Promise<CategoryFormState> {
  await verifyAdmin();
  const { name, description, color, icon } = readCategoryFields(formData);

  if (name.length === 0) {
    return { error: "Category name is required." };
  }

  try {
    await prisma.category.update({
      where: { id: categoryId },
      data: { name, description, color, icon },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: `A category named "${name}" already exists.` };
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}

export async function deleteCategory(formData: FormData) {
  await verifyAdmin();
  const categoryId = String(formData.get("categoryId") ?? "");

  if (categoryId.length === 0) {
    redirect("/admin/categories");
  }

  try {
    await prisma.category.delete({ where: { id: categoryId } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      // Category is still referenced by existing purchases (onDelete: Restrict).
      redirect("/admin/categories?error=in-use");
    }
    throw error;
  }

  revalidatePath("/admin/categories");
  redirect("/admin/categories");
}
