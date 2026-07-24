import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveApiToken } from "@/lib/apiToken";
import {
  formatQuickLogErrorMessage,
  formatQuickLogSuccessMessage,
} from "@/lib/appSettings";

// Bearer-token-authenticated purchase logging for iOS Shortcuts.
// Supports both:
//   POST /api/quick-purchase  with JSON body
//   GET  /api/quick-purchase?amount=12.5&category=Food&merchant=Cafe
// Responses always include a human-readable `message` field (admin-
// customizable templates) so an iOS Shortcut notification can show it.

function parsePurchaseDate(raw: unknown): Date | null {
  if (raw === undefined || raw === null || raw === "") {
    return new Date();
  }
  if (typeof raw !== "string") {
    return null;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (Array.isArray(value) && value.length === 1) {
    return asString(value[0]);
  }
  return null;
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[^\d.-]/g, "");
    const amount = Number(cleaned);
    return Number.isFinite(amount) ? amount : null;
  }
  if (Array.isArray(value) && value.length === 1) {
    return asAmount(value[0]);
  }
  return null;
}

async function errorResponse(error: string, status: number) {
  const message = await formatQuickLogErrorMessage(error);
  return NextResponse.json({ success: false, error, message }, { status });
}

async function createPurchaseFromFields(
  authHeader: string | null,
  fields: Record<string, unknown>
) {
  const token = await resolveApiToken(authHeader);
  if (!token) {
    return errorResponse("Missing or invalid bearer token.", 401);
  }

  const amount = asAmount(fields.amount);
  if (amount === null || amount <= 0) {
    return errorResponse("`amount` must be a positive number.", 400);
  }

  let categoryId = asString(fields.categoryId);
  const categoryName = asString(fields.category) ?? asString(fields.categoryName);

  if (!categoryId && categoryName) {
    const byName = await prisma.category.findFirst({
      where: { name: { equals: categoryName } },
    });
    if (!byName) {
      return errorResponse(`Unknown category name: ${categoryName}`, 400);
    }
    categoryId = byName.id;
  }

  if (!categoryId) {
    categoryId = token.defaultCategoryId;
  }

  if (!categoryId) {
    return errorResponse(
      "No category provided. Send `category` (name) or `categoryId`, or set a default on the token.",
      400
    );
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return errorResponse("Unknown categoryId.", 400);
  }

  let paymentMethodId: string | null = null;
  const requestedPaymentMethodId =
    asString(fields.paymentMethodId) ?? token.defaultPaymentMethodId;
  if (requestedPaymentMethodId) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: requestedPaymentMethodId, userId: token.userId },
    });
    if (!paymentMethod) {
      return errorResponse("Unknown paymentMethodId.", 400);
    }
    paymentMethodId = paymentMethod.id;
  }

  const purchaseDate = parsePurchaseDate(fields.purchaseDate);
  if (!purchaseDate) {
    return errorResponse("`purchaseDate` must be a valid ISO date string.", 400);
  }

  const merchant = asString(fields.merchant);
  const notes = asString(fields.notes);

  const purchase = await prisma.purchase.create({
    data: {
      userId: token.userId,
      categoryId: category.id,
      paymentMethodId,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      merchant,
      purchaseDate,
      notes,
    },
    include: { category: true },
  });

  const amountNumber = Number(purchase.amount);
  const message = await formatQuickLogSuccessMessage({
    amount: amountNumber,
    category: purchase.category.name,
    merchant: purchase.merchant,
  });

  return NextResponse.json(
    {
      success: true,
      message,
      purchase: {
        id: purchase.id,
        amount: amountNumber,
        category: purchase.category.name,
        merchant: purchase.merchant,
        purchaseDate: purchase.purchaseDate.toISOString(),
      },
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fields: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    fields[key] = value;
  }
  return createPurchaseFromFields(
    request.headers.get("authorization"),
    normalizeFieldKeys(fields)
  );
}

/** Shortcuts sometimes adds accidental trailing spaces to JSON keys (e.g. `merchant `). */
function normalizeFieldKeys(fields: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    normalized[key.trim()] = value;
  }
  return normalized;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let fields: Record<string, unknown> = {};

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        fields[key] = typeof value === "string" ? value : value.name;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        fields[key] = typeof value === "string" ? value : value.name;
      }
    } else {
      const parsed: unknown = await request.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return errorResponse("Request body must be a JSON object.", 400);
      }
      fields = parsed as Record<string, unknown>;
    }
  } catch {
    return errorResponse(
      "Request body must be valid JSON (or use GET with query params).",
      400
    );
  }

  return createPurchaseFromFields(
    request.headers.get("authorization"),
    normalizeFieldKeys(fields)
  );
}
