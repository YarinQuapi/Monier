import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const TOKEN_PREFIX = "fin_";
const PREFIX_DISPLAY_LENGTH = 12;

/** Generates a new raw bearer token, e.g. `fin_9f3a...`. Shown to the user exactly once. */
export function generateApiToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function hashApiToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** First few chars of the raw token, stored in the clear so the token list UI can tell tokens apart. */
export function apiTokenPrefix(rawToken: string): string {
  return rawToken.slice(0, PREFIX_DISPLAY_LENGTH);
}

/**
 * Resolves the bearer token in an `Authorization: Bearer <token>` header to
 * its owning user + quick-add defaults, and stamps `lastUsedAt`. Returns
 * `null` for a missing/malformed header or an unknown/revoked token — the
 * caller (a Route Handler) is expected to respond 401 in that case, since
 * this is the *only* auth path for `/api/quick-purchase` (no session cookie
 * is available to an iOS Shortcut).
 */
export async function resolveApiToken(authHeader: string | null) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const rawToken = authHeader.slice("Bearer ".length).trim();
  if (rawToken.length === 0) {
    return null;
  }

  const tokenHash = hashApiToken(rawToken);
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: { defaultCategory: true, defaultPaymentMethod: true },
  });

  if (!token) {
    return null;
  }

  // Best-effort; a failed timestamp update shouldn't block the request.
  void prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return token;
}
