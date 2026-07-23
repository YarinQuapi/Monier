import { verifyAdmin } from "@/lib/authorization";

export default async function AdminCategoriesPage() {
  await verifyAdmin();

  return (
    <div>
      <h1>Admin: Categories</h1>
      <p>
        The global, admin-only category taxonomy CRUD will be implemented
        here. Only users with role = ADMIN can reach this page (enforced in
        both src/proxy.ts and src/lib/authorization.ts).
      </p>
    </div>
  );
}
