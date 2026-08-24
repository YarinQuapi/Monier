import styles from "./page.module.css";

export default function ShortcutInstallNotFound() {
  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <p className={styles.brand}>Finance</p>
        <h1 className={styles.title}>Shortcut not found</h1>
        <p className={styles.body}>
          This install link is invalid or has expired. Generate a new QR
          code from Settings → Quick Log.
        </p>
      </div>
    </main>
  );
}
