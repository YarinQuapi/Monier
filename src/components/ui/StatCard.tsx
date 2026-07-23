import type { ReactNode } from "react";
import styles from "./StatCard.module.css";

type StatTone = "neutral" | "positive" | "negative";

export function StatCard({
  label,
  value,
  subtext,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  subtext?: ReactNode;
  tone?: StatTone;
}) {
  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {subtext && <span className={styles.subtext}>{subtext}</span>}
    </div>
  );
}
