"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/authorization";

export type PurchaseFormState = { error?: string } | undefined;

function parseDate(raw: string): Date | null {
  if (raw.length === 0) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readPurchaseFields(formData: FormData, userId: string) {
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const paymentMethodIdRaw = String(formData.get("paymentMethodId") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const merchantRaw = String(formData.get("merchant") ?? "").trim();
  const purchaseDateRaw = String(formData.get("purchaseDate") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    return { error: "Choose a valid category." } as const;
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." } as const;
  }

  const purchaseDate = parseDate(purchaseDateRaw);
  if (!purchaseDate) {
    return { error: "A valid purchase date is required." } as const;
  }

  let paymentMethodId: string | null = null;
  if (paymentMethodIdRaw.length > 0) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodIdRaw, userId },
    });
    if (!paymentMethod) {
      return { error: "Choose a valid payment method." } as const;
    }
    paymentMethodId = paymentMethod.id;
  }

  return {
    data: {
      categoryId,
      paymentMethodId,
      amount,
      merchant: merchantRaw.length > 0 ? merchantRaw : null,
      purchaseDate,
      notes: notesRaw.length > 0 ? notesRaw : null,
    },
  } as const;
}

export async function createPurchase(
  _prevState: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  const session = await verifySession();
  const parsed = await readPurchaseFields(formData, session.user.id);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  await prisma.purchase.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  revalidatePath("/purchases");
  redirect("/purchases");
}

export async function updatePurchase(
  purchaseId: string,
  _prevState: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  const session = await verifySession();
  const parsed = await readPurchaseFields(formData, session.user.id);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { count } = await prisma.purchase.updateMany({
    where: { id: purchaseId, userId: session.user.id },
    data: parsed.data,
  });

  if (count === 0) {
    return { error: "Purchase not found." };
  }

  revalidatePath("/purchases");
  redirect("/purchases");
}

export async function deletePurchase(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("purchaseId") ?? "");

  if (id.length === 0) {
    redirect("/purchases");
  }

  await prisma.purchase.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/purchases");
  redirect("/purchases");
}
