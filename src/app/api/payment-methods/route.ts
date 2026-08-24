import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiToken } from "@/lib/apiToken";

const TYPE_LABEL = {
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  BANK_ACCOUNT: "Bank account",
} as const;

// Read-only, bearer-authed payment-method listing so an iOS Shortcut can
// build a "choose a card" menu dynamically — stays in sync with the
// Payment Methods page, same pattern as GET /api/categories.

export async function GET(request: Request) {
  const token = await resolveApiToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid bearer token." },
      { status: 401 }
    );
  }

  const rows = await prisma.paymentMethod.findMany({
    where: { userId: token.userId, isActive: true },
    select: { id: true, nickname: true, type: true, institution: true },
    orderBy: { nickname: "asc" },
  });

  const paymentMethods = rows.map((row) => ({
    id: row.id,
    name: row.nickname,
    type: row.type,
    typeLabel: TYPE_LABEL[row.type],
    institution: row.institution,
  }));

  return NextResponse.json({
    paymentMethods,
    names: paymentMethods.map((paymentMethod) => paymentMethod.name),
  });
}
