import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import styles from "./page.module.css";

export const metadata = {
  title: "Add Log Purchase Shortcut",
};

export const dynamic = "force-dynamic";

export default async function ShortcutInstallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const install = await prisma.iosShortcutInstall.findUnique({
    where: { id },
    select: { expiresAt: true },
  });

  if (!install) {
    notFound();
  }

  const expired = install.expiresAt.getTime() <= Date.now();

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <p className={styles.brand}>Finance</p>
        <h1 className={styles.title}>Log Purchase</h1>
        {expired ? (
          <p className={styles.body}>
            This install link has expired. Generate a new QR code from
            Settings → Quick Log.
          </p>
        ) : (
          <>
            <p className={styles.body}>
              Open this on your iPhone to add the Shortcut. Your token is
              already inside it — no extra setup.
            </p>
            <a
              className={styles.button}
              href={`/api/ios-shortcut/${id}`}
            >
              Add to Shortcuts
            </a>
            <p className={styles.hint}>
              If iOS asks, allow it, then tap Add Shortcut.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
