"use client";

import { useActionState } from "react";
import type { IncomeFormState } from "./actions";
import styles from "./page.module.css";

interface IncomeFormProps {
  action: (
    state: IncomeFormState,
    formData: FormData
  ) => Promise<IncomeFormState>;
  submitLabel: string;
  defaultValues?: {
    type?: "SALARY" | "MISC";
    label?: string;
    amount?: number;
    receivedAt?: string; // yyyy-mm-dd
    notes?: string | null;
  };
}

export function IncomeForm({
  action,
  submitLabel,
  defaultValues,
}: IncomeFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="type">Type</label>
          <select
            id="type"
            name="type"
            defaultValue={defaultValues?.type ?? "SALARY"}
          >
            <option value="SALARY">Salary</option>
            <option value="MISC">Miscellaneous</option>
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="label">Label</label>
          <input
            id="label"
            name="label"
            type="text"
            required
            placeholder="e.g. July paycheck"
            defaultValue={defaultValues?.label}
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
          <label htmlFor="receivedAt">Date received</label>
          <input
            id="receivedAt"
            name="receivedAt"
            type="date"
            required
            defaultValue={defaultValues?.receivedAt}
          />
        </div>
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

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
