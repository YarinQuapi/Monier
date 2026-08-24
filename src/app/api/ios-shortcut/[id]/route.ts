import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const install = await prisma.iosShortcutInstall.findUnique({
    where: { id },
    select: { file: true, expiresAt: true },
  });

  if (!install || install.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "This Shortcut link is missing or has expired." },
      { status: 404 }
    );
  }

  return new NextResponse(Buffer.from(install.file), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="Log Purchase.shortcut"',
      "Cache-Control": "no-store",
    },
  });
}
