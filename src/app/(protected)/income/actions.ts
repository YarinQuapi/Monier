"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { IncomeType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/authorization";

export type IncomeFormState = { error?: string } | undefined;

function parseDate(raw: string): Date | null {
  if (raw.length === 0) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readIncomeFields(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const receivedAtRaw = String(formData.get("receivedAt") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (type !== IncomeType.SALARY && type !== IncomeType.MISC) {
    return { error: "Choose an income type." } as const;
  }

  if (label.length === 0) {
    return { error: "Label is required." } as const;
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." } as const;
  }

  const receivedAt = parseDate(receivedAtRaw);
  if (!receivedAt) {
    return { error: "A valid date received is required." } as const;
  }

  return {
    data: {
      type,
      label,
      amount,
      receivedAt,
      notes: notesRaw.length > 0 ? notesRaw : null,
    },
  } as const;
}

export async function createIncome(
  _prevState: IncomeFormState,
  formData: FormData
): Promise<IncomeFormState> {
  const session = await verifySession();
  const parsed = readIncomeFields(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  await prisma.income.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  revalidatePath("/income");
  redirect("/income");
}

export async function updateIncome(
  incomeId: string,
  _prevState: IncomeFormState,
  formData: FormData
): Promise<IncomeFormState> {
  const session = await verifySession();
  const parsed = readIncomeFields(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { count } = await prisma.income.updateMany({
    where: { id: incomeId, userId: session.user.id },
    data: parsed.data,
  });

  if (count === 0) {
    return { error: "Income entry not found." };
  }

  revalidatePath("/income");
  redirect("/income");
}

export async function deleteIncome(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("incomeId") ?? "");

  if (id.length === 0) {
    redirect("/income");
  }

  await prisma.income.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/income");
  redirect("/income");
}
