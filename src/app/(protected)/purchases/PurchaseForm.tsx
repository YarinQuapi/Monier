"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { PurchaseFormState } from "./actions";
import styles from "./page.module.css";

interface CategoryOption {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  nickname: string;
  type: "CREDIT_CARD" | "BANK_ACCOUNT";
}

interface PurchaseFormProps {
  action: (
    state: PurchaseFormState,
    formData: FormData
  ) => Promise<PurchaseFormState>;
  submitLabel: string;
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
  defaultValues?: {
    categoryId?: string;
    paymentMethodId?: string | null;
    amount?: number;
    merchant?: string | null;
    purchaseDate?: string; // yyyy-mm-dd
    notes?: string | null;
  };
}

export function PurchaseForm({
  action,
  submitLabel,
  categories,
  paymentMethods,
  defaultValues,
}: PurchaseFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="amount">Amount</label>
          <input
            id="amount"
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            defaultValue={defaultValues?.amount}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="purchaseDate">Date</label>
          <input
            id="purchaseDate"
            name="purchaseDate"
            type="date"
            required
            defaultValue={defaultValues?.purchaseDate}
          />
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="categoryId">Category</label>
          <select
            id="categoryId"
            name="categoryId"
            required
            defaultValue={defaultValues?.categoryId ?? ""}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="paymentMethodId">Payment method (optional)</label>
          <select
            id="paymentMethodId"
            name="paymentMethodId"
            defaultValue={defaultValues?.paymentMethodId ?? ""}
          >
            <option value="">None / cash</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.nickname} (
                {pm.type === "CREDIT_CARD" ? "Credit card" : "Bank account"})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="merchant">Merchant (optional)</label>
        <input
          id="merchant"
          name="merchant"
          type="text"
          defaultValue={defaultValues?.merchant ?? ""}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="notes">Notes (optional)</label>
        <input
          id="notes"
          name="notes"
          type="text"
          defaultValue={defaultValues?.notes ?? ""}
        />
      </div>

      {state?.error && <p className={styles.error}>{state.error}</p>}

      <Button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
