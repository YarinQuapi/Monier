import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Data Access Layer: the authoritative (non-optimistic) auth check.
// src/proxy.ts only does a fast optimistic redirect; every Server
// Component / Server Action / Route Handler that touches user data must
// call one of these instead of trusting the proxy alone.

export const verifySession = cache(async () => {
  const session = await auth();

  if (!session?.user) {
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
