import { verifySession } from "@/lib/authorization";

export default async function SubscriptionsPage() {
  await verifySession();

  return (
    <div>
      <h1>Subscriptions</h1>
      <p>
        Ongoing-monthly and fixed-term subscriptions, each linked to a
        payment method, will be managed here.
      </p>
    </div>
  );
}
