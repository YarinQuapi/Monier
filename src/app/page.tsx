import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <span className={styles.brandMark}>$</span>
        <h1 className={styles.title}>Money Management System</h1>
        <p className={styles.subtitle}>
          Track income, purchases, and subscriptions, and forecast your
          end-of-month cash requirements across multiple credit cards and
          bank accounts.
        </p>
        <div className={styles.ctas}>
          <Link className={styles.primary} href="/login">
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
