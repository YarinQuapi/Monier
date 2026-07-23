import { verifySession } from "@/lib/authorization";

export default async function PurchasesPage() {
  await verifySession();

  return (
    <div>
      <h1>Purchases</h1>
      <p>
        One-off purchases, tagged against the admin-managed category
        taxonomy, will be managed here.
      </p>
    </div>
  );
}
