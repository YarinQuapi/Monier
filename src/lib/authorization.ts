import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Data Access Layer: the authoritative (non-optimistic) auth check.
// src/proxy.ts only does a fast optimistic redirect; every Server
// Component / Server Action / Route Handler that touches user data must
// call one of these instead of trusting the proxy alone.

export const verifySession = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // JWT can outlive the User row (e.g. after a database reset). A stale
  // session would otherwise 500 on any insert that FKs to User.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });

  if (!user) {
    redirect("/login");
  }

  return session;
});

export const verifyAdmin = cache(async () => {
  const session = await verifySession();

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session;
});
