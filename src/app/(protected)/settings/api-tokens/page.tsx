import { headers } from "next/headers";
import Link from "next/link";
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
  const paymentMethodsUrl = host
    ? `https://${host}/api/payment-methods`
    : "/api/payment-methods";

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
          and a JSON body like{" "}
          <code>
            {
              '{"amount": 45.9, "category": "Food", "paymentMethod": "Visa Gold"}'
            }
          </code>
          . Optional fields: <code>category</code> (name — preferred for
          Shortcuts), <code>categoryId</code>, <code>paymentMethod</code>{" "}
          (card nickname — preferred for Shortcuts),{" "}
          <code>paymentMethodId</code>, <code>merchant</code>,{" "}
          <code>notes</code>, <code>purchaseDate</code> (ISO date). Send{" "}
          <code>paymentMethod: &quot;cash&quot;</code> to skip a card even if
          the token has a default. Do not use Shortcuts&apos; &quot;Filter
          Files&quot; to look up an id — send the chosen category or card{" "}
          <em>name</em> instead.
        </p>
        <p className={styles.helpText}>
          A successful response includes a human-readable{" "}
          <code>message</code> field (e.g.{" "}
          <code>
            {`{"success":true,"message":"Logged ₪45.90 at Cafe (Food) on Visa Gold.","purchase":{...}}`}
          </code>
          ). Point your Shortcut notification at that{" "}
          <code>message</code> value. Admins can customize the wording under{" "}
          <Link href="/admin/quick-log-messages">Quick-log messages</Link>.
        </p>
        <p className={styles.helpText}>
          To build a live category picker, first <code>GET</code>:
        </p>
        <code className={styles.endpointBox}>{categoriesUrl}</code>
        <p className={styles.helpText}>
          with the same <code>Authorization: Bearer</code> header. Get
          Dictionary Value <code>names</code>, <code>Choose from List</code>,
          then POST that chosen name as <code>category</code> — no id lookup
          needed.
        </p>
        <p className={styles.helpText}>
          To pick a card in the same Shortcut, first <code>GET</code>:
        </p>
        <code className={styles.endpointBox}>{paymentMethodsUrl}</code>
        <p className={styles.helpText}>
          with the same Bearer header. Get Dictionary Value{" "}
          <code>names</code>, <code>Choose from List</code>, then POST that
          chosen nickname as <code>paymentMethod</code> — no id lookup needed.
          The list is your active payment methods (same nicknames as the
          Payment Methods page).
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Your tokens ({tokens.length})</h2>

        {tokens.length === 0 ? (
          <EmptyState>No tokens yet — create one below.</EmptyState>
        ) : (
          <table className={styles.table} data-stack>
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
                  <td className={styles.nicknameCell} data-label="Name">{token.name}</td>
                  <td className={styles.muted} data-label="Token">
                    <code>{token.tokenPrefix}&hellip;</code>
                  </td>
                  <td className={styles.muted} data-label="Default category">
                    {token.defaultCategory?.name ?? "—"}
                  </td>
                  <td className={styles.muted} data-label="Default payment method">
                    {token.defaultPaymentMethod?.nickname ?? "—"}
                  </td>
                  <td className={styles.muted} data-label="Last used">
                    {formatDateTime(token.lastUsedAt)}
                  </td>
                  <td data-label="">
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
