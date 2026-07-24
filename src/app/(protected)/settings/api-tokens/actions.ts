"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/authorization";
import { generateApiToken, hashApiToken, apiTokenPrefix } from "@/lib/apiToken";

export type ApiTokenFormState =
  | { error: string }
  | { token: string; name: string }
  | undefined;

export async function createApiToken(
  _prevState: ApiTokenFormState,
  formData: FormData
): Promise<ApiTokenFormState> {
  const session = await verifySession();

  const name = String(formData.get("name") ?? "").trim();
  const defaultCategoryIdRaw = String(formData.get("defaultCategoryId") ?? "").trim();
  const defaultPaymentMethodIdRaw = String(
    formData.get("defaultPaymentMethodId") ?? ""
  ).trim();

  if (name.length === 0) {
    return { error: "Give this token a name, e.g. \u201ciPhone Shortcut\u201d." };
  }

  let defaultCategoryId: string | null = null;
  if (defaultCategoryIdRaw.length > 0) {
    const category = await prisma.category.findUnique({
      where: { id: defaultCategoryIdRaw },
    });
    if (!category) {
      return { error: "Choose a valid default category." };
    }
    defaultCategoryId = category.id;
  }

  let defaultPaymentMethodId: string | null = null;
  if (defaultPaymentMethodIdRaw.length > 0) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: defaultPaymentMethodIdRaw, userId: session.user.id },
    });
    if (!paymentMethod) {
      return { error: "Choose a valid default payment method." };
    }
    defaultPaymentMethodId = paymentMethod.id;
  }

  const rawToken = generateApiToken();

  await prisma.apiToken.create({
    data: {
      userId: session.user.id,
      name,
      tokenHash: hashApiToken(rawToken),
      tokenPrefix: apiTokenPrefix(rawToken),
      defaultCategoryId,
      defaultPaymentMethodId,
    },
  });

  revalidatePath("/settings/api-tokens");
  return { token: rawToken, name };
}

export async function revokeApiToken(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("tokenId") ?? "");

  await prisma.apiToken.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/settings/api-tokens");
}
