"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { login } from "./actions";
import styles from "./page.module.css";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>$</span>
          Money Management
        </div>

        <div>
          <h1 className={styles.title}>Welcome back</h1>
          <p className={styles.subtitle}>Sign in to your account to continue.</p>
        </div>

        <form action={formAction} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoFocus />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>

          {state?.error && <p className={styles.error}>{state.error}</p>}

          <Button type="submit" disabled={pending} className={styles.submit}>
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
