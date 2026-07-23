"use client";

import { useActionState } from "react";
import { login } from "./actions";
import styles from "./page.module.css";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className={styles.container}>
      <form action={formAction} className={styles.form}>
        <h1>Sign in</h1>

        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoFocus />
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required />
        </div>

        {state?.error && <p className={styles.error}>{state.error}</p>}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
