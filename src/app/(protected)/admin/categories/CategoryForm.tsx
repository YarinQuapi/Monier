"use client";

import { useActionState } from "react";
import type { CategoryFormState } from "./actions";
import styles from "./page.module.css";

interface CategoryFormProps {
  action: (
    state: CategoryFormState,
    formData: FormData
  ) => Promise<CategoryFormState>;
  submitLabel: string;
  defaultValues?: {
    name?: string;
    description?: string | null;
    color?: string | null;
    icon?: string | null;
  };
}

export function CategoryForm({
  action,
  submitLabel,
  defaultValues,
}: CategoryFormProps) {
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.field}>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={defaultValues?.name}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="description">Description</label>
        <input
          id="description"
          name="description"
          type="text"
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="color">Color</label>
          <input
            id="color"
            name="color"
            type="color"
            defaultValue={defaultValues?.color ?? "#6b7280"}
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="icon">Icon (emoji or short label)</label>
          <input
            id="icon"
            name="icon"
            type="text"
            maxLength={8}
            defaultValue={defaultValues?.icon ?? ""}
          />
        </div>
      </div>

      {state?.error && <p className={styles.error}>{state.error}</p>}

      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
