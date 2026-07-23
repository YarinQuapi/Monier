import { verifySession } from "@/lib/authorization";

export default async function DashboardPage() {
  const session = await verifySession();

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {session.user.email}.</p>
      <p>
        The End-of-Month cash forecast will be rendered here once the
        forecasting engine (src/lib/forecasting) is implemented.
      </p>
    </div>
  );
}
