"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, SubscriptionBillingType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/authorization";

export type SubscriptionFormState = { error?: string } | undefined;

function parseDate(raw: string): Date | null {
  if (raw.length === 0) return null;
  const date = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readSubscriptionFields(formData: FormData, userId: string) {
  const providerName = String(formData.get("providerName") ?? "").trim();
  const accountLabel = String(formData.get("accountLabel") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const paymentMethodId = String(formData.get("paymentMethodId") ?? "").trim();
  const billingTypeRaw = String(formData.get("billingType") ?? "");
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const totalMonthsRaw = String(formData.get("totalMonths") ?? "").trim();
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (providerName.length === 0) {
    return { error: "Provider name is required." } as const;
  }
  if (accountLabel.length === 0) {
    return {
      error: "Account label is required (to tell multiple accounts apart).",
    } as const;
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Amount must be a positive number." } as const;
  }

  if (
    billingTypeRaw !== SubscriptionBillingType.ONGOING_MONTHLY &&
    billingTypeRaw !== SubscriptionBillingType.ONGOING_ANNUAL &&
    billingTypeRaw !== SubscriptionBillingType.FIXED_TERM
  ) {
    return { error: "Choose a billing type." } as const;
  }

  const startDate = parseDate(startDateRaw);
  if (!startDate) {
    return { error: "A valid start date is required." } as const;
  }

  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { id: paymentMethodId, userId },
  });
  if (!paymentMethod) {
    return { error: "Choose a valid payment method." } as const;
  }

  let totalMonths: number | null = null;
  if (billingTypeRaw === SubscriptionBillingType.FIXED_TERM) {
    const parsed = Number(totalMonthsRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return {
        error: "Total months is required for a fixed-term subscription.",
      } as const;
    }
    totalMonths = parsed;
  }

  let endDate: Date | null = null;
  if (billingTypeRaw !== SubscriptionBillingType.FIXED_TERM && endDateRaw.length > 0) {
    endDate = parseDate(endDateRaw);
    if (!endDate) {
      return { error: "End date is invalid." } as const;
    }
  }

  return {
    data: {
      providerName,
      accountLabel,
      amount,
      paymentMethodId,
      billingType: billingTypeRaw,
      // Derived from the first/next charge date, per the architecture plan.
      billingDayOfMonth: startDate.getUTCDate(),
      startDate,
      totalMonths,
      endDate,
      notes: notesRaw.length > 0 ? notesRaw : null,
    },
  } as const;
}

export async function createSubscription(
  _prevState: SubscriptionFormState,
  formData: FormData
): Promise<SubscriptionFormState> {
  const session = await verifySession();
  const parsed = await readSubscriptionFields(formData, session.user.id);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  await prisma.subscription.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function updateSubscription(
  subscriptionId: string,
  _prevState: SubscriptionFormState,
  formData: FormData
): Promise<SubscriptionFormState> {
  const session = await verifySession();
  const parsed = await readSubscriptionFields(formData, session.user.id);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { count } = await prisma.subscription.updateMany({
    where: { id: subscriptionId, userId: session.user.id },
    data: parsed.data,
  });

  if (count === 0) {
    return { error: "Subscription not found." };
  }

  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}

export async function toggleSubscriptionActive(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("subscriptionId") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";

  await prisma.subscription.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive: !isActive },
  });

  revalidatePath("/subscriptions");
}

export async function deleteSubscription(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("subscriptionId") ?? "");

  if (id.length === 0) {
    redirect("/subscriptions");
  }

  try {
    await prisma.subscription.deleteMany({
      where: { id, userId: session.user.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      redirect("/subscriptions?error=delete-failed");
    }
    throw error;
  }

  revalidatePath("/subscriptions");
  redirect("/subscriptions");
}
