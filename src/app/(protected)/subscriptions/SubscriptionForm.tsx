"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SubscriptionFormState } from "./actions";
import styles from "./page.module.css";

interface PaymentMethodOption {
  id: string;
  nickname: string;
  type: "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT";
}

interface SubscriptionFormProps {
  action: (
    state: SubscriptionFormState,
    formData: FormData
  ) => Promise<SubscriptionFormState>;
  submitLabel: string;
  paymentMethods: PaymentMethodOption[];
  defaultValues?: {
    providerName?: string;
    accountLabel?: string;
    amount?: number;
    paymentMethodId?: string;
    billingType?: "ONGOING_MONTHLY" | "ONGOING_ANNUAL" | "FIXED_TERM";
    startDate?: string; // yyyy-mm-dd
    totalMonths?: number | null;
    endDate?: string | null; // yyyy-mm-dd
    notes?: string | null;
  };
}

export function SubscriptionForm({
  action,
  submitLabel,
  paymentMethods,
  defaultValues,
}: SubscriptionFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [billingType, setBillingType] = useState<
    "ONGOING_MONTHLY" | "ONGOING_ANNUAL" | "FIXED_TERM"
  >(defaultValues?.billingType ?? "ONGOING_MONTHLY");

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="providerName">Provider</label>
          <input
            id="providerName"
            name="providerName"
            type="text"
            required
            placeholder="e.g. Netflix"
            defaultValue={defaultValues?.providerName}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="accountLabel">Account label</label>
          <input
            id="accountLabel"
            name="accountLabel"
            type="text"
            required
            placeholder="e.g. Family plan"
            defaultValue={defaultValues?.accountLabel}
          />
        </div>
      </div>

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
          <label htmlFor="paymentMethodId">Payment method</label>
          <select
            id="paymentMethodId"
            name="paymentMethodId"
            required
            defaultValue={defaultValues?.paymentMethodId ?? ""}
          >
            <option value="" disabled>
              Choose a payment method
            </option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.nickname} (
                {pm.type === "CREDIT_CARD"
                  ? "Credit card"
                  : pm.type === "DEBIT_CARD"
                    ? "Debit card"
                    : "Bank account"}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="billingType">Billing type</label>
          <select
            id="billingType"
            name="billingType"
            value={billingType}
            onChange={(event) =>
              setBillingType(
                event.target.value as
                  | "ONGOING_MONTHLY"
                  | "ONGOING_ANNUAL"
                  | "FIXED_TERM"
              )
            }
          >
            <option value="ONGOING_MONTHLY">Ongoing (monthly)</option>
            <option value="ONGOING_ANNUAL">Ongoing (annual)</option>
            <option value="FIXED_TERM">Fixed term (N months)</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="startDate">
            {billingType === "FIXED_TERM" ? "First charge date" : "Start date"}
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            defaultValue={defaultValues?.startDate}
          />
        </div>
      </div>

      {billingType === "FIXED_TERM" ? (
        <div className={styles.field}>
          <label htmlFor="totalMonths">Total months</label>
          <input
            id="totalMonths"
            name="totalMonths"
            type="number"
            min={1}
            required
            defaultValue={defaultValues?.totalMonths ?? undefined}
          />
        </div>
      ) : (
        <div className={styles.field}>
          <label htmlFor="endDate">End date (optional)</label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            defaultValue={defaultValues?.endDate ?? ""}
          />
        </div>
      )}

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
