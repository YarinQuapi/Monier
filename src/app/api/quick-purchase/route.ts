import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveApiToken } from "@/lib/apiToken";

// Bearer-token-authenticated purchase logging for clients that can't hold a
// browser session cookie (an iOS Shortcut hitting this from the lock
// screen/Action Button). See /settings/api-tokens for token issuance and
// the request shape this expects.

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

export async function POST(request: Request) {
  const token = await resolveApiToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid bearer token." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const {
    amount: amountRaw,
    categoryId: categoryIdRaw,
    paymentMethodId: paymentMethodIdRaw,
    merchant: merchantRaw,
    notes: notesRaw,
    purchaseDate: purchaseDateRaw,
  } = body as Record<string, unknown>;

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "`amount` must be a positive number." },
      { status: 400 }
    );
  }

  const categoryId =
    typeof categoryIdRaw === "string" && categoryIdRaw.length > 0
      ? categoryIdRaw
      : token.defaultCategoryId;
  if (!categoryId) {
    return NextResponse.json(
      {
        error:
          "No `categoryId` was provided and this token has no default category configured.",
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
    typeof paymentMethodIdRaw === "string" && paymentMethodIdRaw.length > 0
      ? paymentMethodIdRaw
      : token.defaultPaymentMethodId;
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

  const purchaseDate = parsePurchaseDate(purchaseDateRaw);
  if (!purchaseDate) {
    return NextResponse.json(
      { error: "`purchaseDate` must be a valid ISO date string." },
      { status: 400 }
    );
  }

  const merchant =
    typeof merchantRaw === "string" && merchantRaw.trim().length > 0
      ? merchantRaw.trim()
      : null;
  const notes =
    typeof notesRaw === "string" && notesRaw.trim().length > 0
      ? notesRaw.trim()
      : null;

  const purchase = await prisma.purchase.create({
    data: {
      userId: token.userId,
      categoryId,
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
