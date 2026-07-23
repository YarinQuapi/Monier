"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { PaymentMethodFormState } from "./actions";
import styles from "./page.module.css";

interface PaymentMethodFormProps {
  action: (
    state: PaymentMethodFormState,
    formData: FormData
  ) => Promise<PaymentMethodFormState>;
  submitLabel: string;
  defaultValues?: {
    type?: "CREDIT_CARD" | "BANK_ACCOUNT";
    nickname?: string;
    institution?: string | null;
    cycleStartDay?: number | null;
    paymentDueDay?: number | null;
    dueMonthOffset?: number | null;
  };
}

export function PaymentMethodForm({
  action,
  submitLabel,
  defaultValues,
}: PaymentMethodFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [type, setType] = useState<"CREDIT_CARD" | "BANK_ACCOUNT">(
    defaultValues?.type ?? "BANK_ACCOUNT"
  );

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="type">Type</label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(event) =>
            setType(event.target.value as "CREDIT_CARD" | "BANK_ACCOUNT")
          }
        >
          <option value="BANK_ACCOUNT">Bank account</option>
          <option value="CREDIT_CARD">Credit card</option>
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="nickname">Nickname</label>
        <input
          id="nickname"
          name="nickname"
          type="text"
          required
          placeholder={
            type === "CREDIT_CARD" ? "e.g. Visa Personal" : "e.g. Checking"
          }
          defaultValue={defaultValues?.nickname}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="institution">Institution (optional)</label>
        <input
          id="institution"
          name="institution"
          type="text"
          defaultValue={defaultValues?.institution ?? ""}
        />
      </div>

      {type === "CREDIT_CARD" && (
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label htmlFor="cycleStartDay">Cycle start day (1-31)</label>
            <input
              id="cycleStartDay"
              name="cycleStartDay"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={defaultValues?.cycleStartDay ?? undefined}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="paymentDueDay">Payment due day (1-31)</label>
            <input
              id="paymentDueDay"
              name="paymentDueDay"
              type="number"
              min={1}
              max={31}
              required
              defaultValue={defaultValues?.paymentDueDay ?? undefined}
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="dueMonthOffset">Due month offset</label>
            <input
              id="dueMonthOffset"
              name="dueMonthOffset"
              type="number"
              min={0}
              max={2}
              defaultValue={defaultValues?.dueMonthOffset ?? 1}
            />
          </div>
        </div>
      )}

      {state?.error && <p className={styles.error}>{state.error}</p>}

      <Button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
