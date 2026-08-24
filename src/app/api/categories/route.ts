import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveApiToken } from "@/lib/apiToken";

// Read-only, bearer-authed category listing so an iOS Shortcut can build a
// "choose a category" menu dynamically at run time instead of hardcoding
// category names/ids — stays in sync automatically with the Admin panel.

export async function GET(request: Request) {
  const token = await resolveApiToken(request.headers.get("authorization"));
  if (!token) {
    return NextResponse.json(
      { error: "Missing or invalid bearer token." },
      { status: 401 }
    );
  }

  const categories = await prisma.category.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    categories,
    names: categories.map((category) => category.name),
  });
}
