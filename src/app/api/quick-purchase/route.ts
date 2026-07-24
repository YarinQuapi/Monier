import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveApiToken } from "@/lib/apiToken";

// Bearer-token-authenticated purchase logging for clients that can't hold a
// browser session cookie (an iOS Shortcut hitting this from the lock
// screen/Action Button). See /settings/api-tokens for token issuance and
// the request shape this expects.
//
// Shortcuts-friendly: accepts either `categoryId` or `category` (name).
// Prefer `category` from a "Choose from List" of names — that avoids the
// broken "Filter Files → Get id" pattern that turns the value into a File
// object and causes Apache to reject the POST as a Bad Request.

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

/** Coerce Shortcuts/JSON quirks: numbers-as-strings, single-item arrays, etc. */
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

export async function POST(request: Request) {
  const token = await resolveApiToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid bearer token." },
      { status: 401 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        body[key] = typeof value === "string" ? value : value.name;
      }
    } else {
      const parsed: unknown = await request.json();
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: "Request body must be a JSON object." },
          { status: 400 }
        );
      }
      body = parsed as Record<string, unknown>;
    }
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const amount = asAmount(body.amount);
  if (amount === null || amount <= 0) {
    return NextResponse.json(
      { error: "`amount` must be a positive number." },
      { status: 400 }
    );
  }

  // Resolve category: explicit id, then name, then token default.
  let categoryId = asString(body.categoryId);
  const categoryName = asString(body.category) ?? asString(body.categoryName);

  if (!categoryId && categoryName) {
    const byName = await prisma.category.findFirst({
      where: { name: { equals: categoryName } },
    });
    if (!byName) {
      return NextResponse.json(
        { error: `Unknown category name: ${categoryName}` },
        { status: 400 }
      );
    }
    categoryId = byName.id;
  }

  if (!categoryId) {
    categoryId = token.defaultCategoryId;
  }

  if (!categoryId) {
    return NextResponse.json(
      {
        error:
          "No category provided. Send `category` (name) or `categoryId`, or set a default on the token.",
      },
      { status: 400 }
    );
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Unknown categoryId." }, { status: 400 });
  }

  let paymentMethodId: string | null = null;
  const requestedPaymentMethodId =
    asString(body.paymentMethodId) ?? token.defaultPaymentMethodId;
  if (requestedPaymentMethodId) {
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: requestedPaymentMethodId, userId: token.userId },
    });
    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Unknown paymentMethodId." },
        { status: 400 }
      );
    }
    paymentMethodId = paymentMethod.id;
  }

  const purchaseDate = parsePurchaseDate(body.purchaseDate);
  if (!purchaseDate) {
    return NextResponse.json(
      { error: "`purchaseDate` must be a valid ISO date string." },
      { status: 400 }
    );
  }

  const merchant = asString(body.merchant);
  const notes = asString(body.notes);

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

  return NextResponse.json(
    {
      success: true,
      purchase: {
        id: purchase.id,
        amount: Number(purchase.amount),
        category: purchase.category.name,
        merchant: purchase.merchant,
        purchaseDate: purchase.purchaseDate.toISOString(),
      },
    },
    { status: 201 }
  );
}
