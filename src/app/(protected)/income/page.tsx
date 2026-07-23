import { verifySession } from "@/lib/authorization";

export default async function IncomePage() {
  await verifySession();

  return (
    <div>
      <h1>Income</h1>
      <p>Salary and miscellaneous income entries will be managed here.</p>
    </div>
  );
}
