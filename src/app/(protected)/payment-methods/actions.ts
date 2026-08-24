"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, PaymentMethodType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/authorization";

export type PaymentMethodFormState = { error?: string } | undefined;

function parseDayOfMonth(
  formData: FormData,
  field: string
): number | null | undefined {
  const raw = String(formData.get(field) ?? "").trim();
  if (raw.length === 0) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 31) {
    return undefined; // sentinel for "invalid"
  }
  return value;
}

function readPaymentMethodFields(formData: FormData) {
  const type = String(formData.get("type") ?? "");
  const nickname = String(formData.get("nickname") ?? "").trim();
  const institutionRaw = String(formData.get("institution") ?? "").trim();

  if (
    type !== "CREDIT_CARD" &&
    type !== "DEBIT_CARD" &&
    type !== "BANK_ACCOUNT"
  ) {
    return { error: "Choose a payment method type." } as const;
  }

  if (nickname.length === 0) {
    return { error: "Nickname is required." } as const;
  }

  const institution = institutionRaw.length > 0 ? institutionRaw : null;

  if (type === "BANK_ACCOUNT" || type === "DEBIT_CARD") {
    return {
      data: {
        type:
          type === "DEBIT_CARD"
            ? PaymentMethodType.DEBIT_CARD
            : PaymentMethodType.BANK_ACCOUNT,
        nickname,
        institution,
        cycleStartDay: null,
        paymentDueDay: null,
        dueMonthOffset: null,
      },
    } as const;
  }

  // CREDIT_CARD: cycleStartDay and paymentDueDay are required.
  const cycleStartDay = parseDayOfMonth(formData, "cycleStartDay");
  const paymentDueDay = parseDayOfMonth(formData, "paymentDueDay");
  const dueMonthOffsetRaw = String(formData.get("dueMonthOffset") ?? "1").trim();
  const dueMonthOffset = Number(dueMonthOffsetRaw);

  if (cycleStartDay === undefined || paymentDueDay === undefined) {
    return {
      error: "Cycle start day and payment due day must be between 1 and 31.",
    } as const;
  }

  if (!cycleStartDay || !paymentDueDay) {
    return {
      error: "Cycle start day and payment due day are required for credit cards.",
    } as const;
  }

  if (!Number.isInteger(dueMonthOffset) || dueMonthOffset < 0 || dueMonthOffset > 2) {
    return { error: "Due month offset must be 0, 1, or 2." } as const;
  }

  return {
    data: {
      type: PaymentMethodType.CREDIT_CARD,
      nickname,
      institution,
      cycleStartDay,
      paymentDueDay,
      dueMonthOffset,
    },
  } as const;
}

export async function createPaymentMethod(
  _prevState: PaymentMethodFormState,
  formData: FormData
): Promise<PaymentMethodFormState> {
  const session = await verifySession();
  const parsed = readPaymentMethodFields(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  try {
    await prisma.paymentMethod.create({
      data: {
        ...parsed.data,
        userId: session.user.id,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return {
        error: "Your session is out of date. Sign out, sign in, and try again.",
      };
    }
    throw error;
  }

  revalidatePath("/payment-methods");
  redirect("/payment-methods");
}

export async function updatePaymentMethod(
  paymentMethodId: string,
  _prevState: PaymentMethodFormState,
  formData: FormData
): Promise<PaymentMethodFormState> {
  const session = await verifySession();
  const parsed = readPaymentMethodFields(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { count } = await prisma.paymentMethod.updateMany({
    where: { id: paymentMethodId, userId: session.user.id },
    data: parsed.data,
  });

  if (count === 0) {
    return { error: "Payment method not found." };
  }

  revalidatePath("/payment-methods");
  redirect("/payment-methods");
}

export async function togglePaymentMethodActive(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("paymentMethodId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  await prisma.paymentMethod.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive: !isActive },
  });

  revalidatePath("/payment-methods");
}

export async function deletePaymentMethod(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("paymentMethodId") ?? "");

  if (id.length === 0) {
    redirect("/payment-methods");
  }

  try {
    await prisma.paymentMethod.deleteMany({
      where: { id, userId: session.user.id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2014")
    ) {
      // Still linked to an active Subscription (onDelete: Restrict).
      redirect("/payment-methods?error=in-use");
    }
    throw error;
  }

  revalidatePath("/payment-methods");
  redirect("/payment-methods");
}
