"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";
import styles from "./layout.module.css";

const NARROW_QUERY = "(max-width: 64rem)";

function subscribeNarrow(onChange: () => void) {
  const media = window.matchMedia(NARROW_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getNarrowSnapshot() {
  return window.matchMedia(NARROW_QUERY).matches;
}

function getServerNarrowSnapshot() {
  return false;
}

export function AppShell({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const sidebarId = useId();
  const [open, setOpen] = useState(false);
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    getNarrowSnapshot,
    getServerNarrowSnapshot
  );

  const close = useCallback(() => setOpen(false), []);

  if (!narrow && open) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  function onSidebarClick(event: MouseEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("a")) {
      close();
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuButton}
          aria-label="Open navigation"
          aria-expanded={open}
          aria-controls={sidebarId}
          onClick={() => setOpen(true)}
        >
          <span className={styles.menuIcon} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <span className={styles.mobileBrand}>
          <span className={styles.brandMark}>$</span>
          Money Management
        </span>
      </header>

      {open && (
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close navigation"
          onClick={close}
        />
      )}

      <aside
        id={sidebarId}
        className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}
        inert={narrow && !open ? true : undefined}
        onClick={onSidebarClick}
      >
        <div className={styles.drawerTop}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>$</span>
            Money Management
          </div>
          <button
            type="button"
            className={styles.drawerClose}
            aria-label="Close navigation"
            onClick={close}
          >
            &times;
          </button>
        </div>
        {sidebar}
      </aside>

      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
