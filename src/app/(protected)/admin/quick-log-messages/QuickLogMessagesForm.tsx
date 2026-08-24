"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import type { QuickLogMessagesFormState } from "./actions";
import styles from "./page.module.css";

interface QuickLogMessagesFormProps {
  action: (
    state: QuickLogMessagesFormState,
    formData: FormData
  ) => Promise<QuickLogMessagesFormState>;
  resetAction: () => Promise<void>;
  defaultValues: {
    successMessage: string;
    errorMessage: string;
  };
}

export function QuickLogMessagesForm({
  action,
  resetAction,
  defaultValues,
}: QuickLogMessagesFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="successMessage">Success message</label>
        <p className={styles.hint}>
          Shown when a purchase is logged. Placeholders:{" "}
          <code>{"{{amount}}"}</code>, <code>{"{{category}}"}</code>,{" "}
          <code>{"{{merchant}}"}</code>, <code>{"{{paymentMethod}}"}</code>.
          Optional blocks:{" "}
          <code>{"{{#merchant}} at {{merchant}}{{/merchant}}"}</code>,{" "}
          <code>
            {"{{#paymentMethod}} on {{paymentMethod}}{{/paymentMethod}}"}
          </code>{" "}
          (only included when that value was provided).
        </p>
        <textarea
          id="successMessage"
          name="successMessage"
          rows={3}
          required
          defaultValue={defaultValues.successMessage}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="errorMessage">Error message</label>
        <p className={styles.hint}>
          Shown when logging fails. Placeholder: <code>{"{{error}}"}</code>{" "}
          (the specific reason).
        </p>
        <textarea
          id="errorMessage"
          name="errorMessage"
          rows={3}
          required
          defaultValue={defaultValues.errorMessage}
        />
      </div>

      {state && "error" in state && <p className={styles.error}>{state.error}</p>}
      {state && "success" in state && (
        <p className={styles.success}>Messages saved.</p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save messages"}
        </Button>
        <Button type="submit" variant="secondary" formAction={resetAction}>
          Reset to defaults
        </Button>
      </div>
    </form>
  );
}
