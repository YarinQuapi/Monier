import { headers } from "next/headers";
import { verifySession } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { createApiToken, revokeApiToken } from "./actions";
import { ApiTokenForm } from "./ApiTokenForm";
import styles from "./page.module.css";

function formatDateTime(date: Date | null): string {
  if (!date) return "Never";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function ApiTokensPage() {
  const session = await verifySession();
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const endpointUrl = host ? `https://${host}/api/quick-purchase` : "/api/quick-purchase";
  const categoriesUrl = host ? `https://${host}/api/categories` : "/api/categories";

  const [tokens, categories, paymentMethods] = await Promise.all([
    prisma.apiToken.findMany({
      where: { userId: session.user.id },
      include: { defaultCategory: true, defaultPaymentMethod: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.paymentMethod.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { nickname: "asc" },
    }),
  ]);

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Quick-log API tokens"
        description="Personal access tokens for logging purchases from outside the web app — e.g. an iOS Shortcut you trigger right after paying."
      />

      <Card>
        <h2 className={styles.sectionTitle}>How it works</h2>
        <p className={styles.helpText}>
          Create a token below (optionally with a default category and
          payment method so a request only needs an amount), then build an
          iOS Shortcut that sends a <code>POST</code> request to:
        </p>
        <code className={styles.endpointBox}>{endpointUrl}</code>
        <p className={styles.helpText}>
          with header <code>Authorization: Bearer &lt;your token&gt;</code>{" "}
          and a JSON body like <code>{"{\"amount\": 45.9}"}</code>. Optional
          fields: <code>categoryId</code>, <code>paymentMethodId</code>,{" "}
          <code>merchant</code>, <code>notes</code>, <code>purchaseDate</code>{" "}
          (ISO date) — any of these override the token&apos;s defaults for
          that one request.
        </p>
        <p className={styles.helpText}>
          To let a Shortcut ask you which category to use each time (instead
          of relying on the token&apos;s default), have it first{" "}
          <code>GET</code>:
        </p>
        <code className={styles.endpointBox}>{categoriesUrl}</code>
        <p className={styles.helpText}>
          with the same <code>Authorization: Bearer</code> header. It returns{" "}
          <code>{"{\"categories\": [{\"id\": \"...\", \"name\": \"...\"}]}"}</code>{" "}
          — always current, no need to update the Shortcut when categories
          change in the Admin panel.
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Your tokens ({tokens.length})</h2>

        {tokens.length === 0 ? (
          <EmptyState>No tokens yet — create one below.</EmptyState>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Token</th>
                <th>Default category</th>
                <th>Default payment method</th>
                <th>Last used</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id}>
                  <td className={styles.nicknameCell}>{token.name}</td>
                  <td className={styles.muted}>
                    <code>{token.tokenPrefix}&hellip;</code>
                  </td>
                  <td className={styles.muted}>
                    {token.defaultCategory?.name ?? "—"}
                  </td>
                  <td className={styles.muted}>
                    {token.defaultPaymentMethod?.nickname ?? "—"}
                  </td>
                  <td className={styles.muted}>
                    {formatDateTime(token.lastUsedAt)}
                  </td>
                  <td>
                    <form action={revokeApiToken}>
                      <input type="hidden" name="tokenId" value={token.id} />
                      <Button variant="danger" type="submit">
                        Revoke
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Create a token</h2>
        <ApiTokenForm
          action={createApiToken}
          categories={categories}
          paymentMethods={paymentMethods}
        />
      </Card>
    </div>
  );
}
