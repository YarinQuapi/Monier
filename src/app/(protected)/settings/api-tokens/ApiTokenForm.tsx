"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiTokenFormState } from "./actions";
import styles from "./page.module.css";

interface CategoryOption {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  nickname: string;
}

interface ApiTokenFormProps {
  action: (
    state: ApiTokenFormState,
    formData: FormData
  ) => Promise<ApiTokenFormState>;
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
}

export function ApiTokenForm({
  action,
  categories,
  paymentMethods,
}: ApiTokenFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  if (state && "token" in state) {
    return (
      <div className={styles.newTokenBox}>
        <p className={styles.newTokenLabel}>
          Token created: <strong>{state.name}</strong>
        </p>
        <code className={styles.newTokenValue}>{state.token}</code>
        <p className={styles.newTokenWarning}>
          Copy this now &mdash; it won&apos;t be shown again. Paste it into
          your iOS Shortcut&apos;s Authorization header as{" "}
          <code>Bearer {state.token}</code>.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="e.g. iPhone Shortcut"
        />
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="defaultCategoryId">Default category (optional)</label>
          <select id="defaultCategoryId" name="defaultCategoryId" defaultValue="">
            <option value="">None &mdash; must be sent in each request</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="defaultPaymentMethodId">
            Default payment method (optional)
          </label>
          <select
            id="defaultPaymentMethodId"
            name="defaultPaymentMethodId"
            defaultValue=""
          >
            <option value="">None / cash</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.nickname}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state && "error" in state && <p className={styles.error}>{state.error}</p>}

      <Button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Creating..." : "Create token"}
      </Button>
    </form>
  );
}
