import { verifySession } from "@/lib/authorization";

export default async function PaymentMethodsPage() {
  await verifySession();

  return (
    <div>
      <h1>Payment Methods</h1>
      <p>
        Credit cards (with per-card billing cycle and due-date
        configuration) and bank accounts will be managed here.
      </p>
    </div>
  );
}
