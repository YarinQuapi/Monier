import { verifyAdmin } from "@/lib/authorization";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DEFAULT_QUICK_LOG_ERROR,
  DEFAULT_QUICK_LOG_SUCCESS,
  getQuickLogMessages,
  renderTemplate,
} from "@/lib/appSettings";
import { formatCurrency } from "@/lib/currency";
import {
  resetQuickLogMessages,
  updateQuickLogMessages,
} from "./actions";
import { QuickLogMessagesForm } from "./QuickLogMessagesForm";
import styles from "./page.module.css";

export default async function QuickLogMessagesPage() {
  await verifyAdmin();
  const { successTemplate, errorTemplate } = await getQuickLogMessages();

  const successPreview = renderTemplate(successTemplate, {
    amount: formatCurrency(45.9),
    category: "Food",
    merchant: "Cafe",
    paymentMethod: "Visa Gold",
  });
  const errorPreview = renderTemplate(errorTemplate, {
    error: "Missing or invalid bearer token.",
  });

  return (
    <div className={styles.wrapper}>
      <PageHeader
        title="Admin: Quick-log messages"
        description="Customize the human-readable messages returned by the iOS Shortcut purchase API. The Shortcut notification should show the response’s message field."
      />

      <Card>
        <h2 className={styles.sectionTitle}>Live preview</h2>
        <div className={styles.previewGrid}>
          <div className={styles.previewBox}>
            <span className={styles.previewLabel}>Success</span>
            <p className={styles.previewText}>{successPreview}</p>
          </div>
          <div className={`${styles.previewBox} ${styles.previewError}`}>
            <span className={styles.previewLabel}>Error</span>
            <p className={styles.previewText}>{errorPreview}</p>
          </div>
        </div>
        <p className={styles.helpText}>
          Defaults if unset:{" "}
          <code>{DEFAULT_QUICK_LOG_SUCCESS}</code> /{" "}
          <code>{DEFAULT_QUICK_LOG_ERROR}</code>
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>Edit messages</h2>
        <QuickLogMessagesForm
          action={updateQuickLogMessages}
          resetAction={resetQuickLogMessages}
          defaultValues={{
            successMessage: successTemplate,
            errorMessage: errorTemplate,
          }}
        />
      </Card>
    </div>
  );
}
