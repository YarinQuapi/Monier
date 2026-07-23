import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variantClass = styles[variant] ?? styles.primary;
  return (
    <button
      className={[styles.button, variantClass, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
