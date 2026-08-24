"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/authorization";
import { generateApiToken, hashApiToken, apiTokenPrefix } from "@/lib/apiToken";
import { buildIosShortcutWorkflow, signIosShortcut } from "@/lib/iosShortcut";

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

export type IosShortcutFormState =
  | { error: string }
  | { installUrl: string; name: string; expiresAt: string }
  | undefined;

const SHORTCUT_TTL_DAYS = 30;

function checkboxOn(formData: FormData, name: string): boolean {
  const value = String(formData.get(name) ?? "");
  return value === "on" || value === "true" || value === "1";
}

function publicOrigin(requestHeaders: Headers): string {
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function generateIosShortcut(
  _prevState: IosShortcutFormState,
  formData: FormData
): Promise<IosShortcutFormState> {
  const session = await verifySession();
  const requestHeaders = await headers();

  const name = String(formData.get("name") ?? "").trim() || "iPhone Shortcut";
  const askCategory = checkboxOn(formData, "askCategory");
  const askCard = checkboxOn(formData, "askCard");
  const askMerchant = checkboxOn(formData, "askMerchant");
  const askNotes = checkboxOn(formData, "askNotes");
  const defaultCategoryIdRaw = String(formData.get("defaultCategoryId") ?? "").trim();
  const defaultPaymentMethodIdRaw = String(
    formData.get("defaultPaymentMethodId") ?? ""
  ).trim();

  if (!askCategory && defaultCategoryIdRaw.length === 0) {
    return {
      error:
        "Pick a default category, or turn on “Ask for category” so the Shortcut can choose one.",
    };
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

  const origin = publicOrigin(requestHeaders);
  if (origin === "http://" || origin === "https://") {
    return { error: "Could not determine the public site URL." };
  }

  const rawToken = generateApiToken();
  const expiresAt = new Date(
    Date.now() + SHORTCUT_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    const workflow = buildIosShortcutWorkflow({
      baseUrl: origin,
      token: rawToken,
      askCategory,
      askCard,
      askMerchant,
      askNotes,
    });
    const signed = await signIosShortcut(workflow);

    const token = await prisma.apiToken.create({
      data: {
        userId: session.user.id,
        name,
        tokenHash: hashApiToken(rawToken),
        tokenPrefix: apiTokenPrefix(rawToken),
        defaultCategoryId,
        defaultPaymentMethodId,
      },
    });

    const install = await prisma.iosShortcutInstall.create({
      data: {
        userId: session.user.id,
        apiTokenId: token.id,
        file: new Uint8Array(signed),
        expiresAt,
      },
    });

    revalidatePath("/settings/api-tokens");
    return {
      installUrl: `${origin}/s/${install.id}`,
      name,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not generate the iPhone Shortcut.",
    };
  }
}

export async function revokeApiToken(formData: FormData) {
  const session = await verifySession();
  const id = String(formData.get("tokenId") ?? "");

  await prisma.apiToken.deleteMany({
    where: { id, userId: session.user.id },
  });

  revalidatePath("/settings/api-tokens");
}
