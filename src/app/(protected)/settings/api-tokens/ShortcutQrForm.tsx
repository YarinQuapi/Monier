"use client";

import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import type { IosShortcutFormState } from "./actions";
import { generateIosShortcut } from "./actions";
import styles from "./page.module.css";

interface CategoryOption {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  nickname: string;
}

interface ShortcutQrFormProps {
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
}

export function ShortcutQrForm({
  categories,
  paymentMethods,
}: ShortcutQrFormProps) {
  const [state, formAction, pending] = useActionState(
    generateIosShortcut,
    undefined
  );
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [askCategory, setAskCategory] = useState(true);
  const [applePayAutoLog, setApplePayAutoLog] = useState(false);

  const success = state && "installUrl" in state ? state : null;
  const error = state && "error" in state ? state.error : null;

  useEffect(() => {
    if (!success) {
      setQrSrc(null);
      return;
    }

    let cancelled = false;
    void QRCode.toDataURL(success.installUrl, {
      width: 280,
      margin: 2,
      color: { dark: "#14152b", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch(() => {
        if (!cancelled) setQrSrc(null);
      });

    return () => {
      cancelled = true;
    };
  }, [success]);

  if (success) {
    const expires = new Date(success.expiresAt).toLocaleDateString("en-GB", {
      dateStyle: "medium",
    });
    return (
      <div className={styles.qrResult}>
        {qrSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.qrImage}
            src={qrSrc}
            alt={`QR code to install ${success.name}`}
          />
        ) : (
          <div className={styles.qrPlaceholder}>Building QR code…</div>
        )}
        <p className={styles.helpText}>
          Scan this with your iPhone camera, then tap{" "}
          <strong>Add Shortcut</strong>. The token for{" "}
          <strong>{success.name}</strong> is already inside it. Anyone with
          this QR can log purchases until you revoke that token. Link expires{" "}
          {expires}.
        </p>
        {success.applePayAutoLog && (
          <ol className={styles.setupSteps}>
            <li>Add the Shortcut from the QR.</li>
            <li>
              Open <strong>Shortcuts → Automation → +</strong>
            </li>
            <li>
              Choose <strong>Transaction</strong> (under Wallet &amp; Apple
              Pay).
            </li>
            <li>
              Select the cards you use, then <strong>Run Immediately</strong>{" "}
              and turn off Ask Before Running.
            </li>
            <li>
              Add action <strong>Run Shortcut</strong> and pick{" "}
              <strong>{success.name}</strong>.
            </li>
            <li>
              In Finance, name each payment method the same as the card in
              Wallet (the name Apple Pay shows).
            </li>
          </ol>
        )}
        <a className={styles.downloadLink} href={success.installUrl}>
          Open install page
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <p className={styles.helpText}>
        Choose what the Shortcut should ask each time, or turn on Apple Pay
        auto-log. Unchecked fields use the defaults below (or cash, if no card
        is selected). This creates a new token and bakes it into the Shortcut.
      </p>

      <label className={styles.checkItem}>
        <input
          type="checkbox"
          name="applePayAutoLog"
          value="true"
          checked={applePayAutoLog}
          onChange={(event) => setApplePayAutoLog(event.target.checked)}
        />
        Auto-log when I pay with Apple Pay
      </label>
      {applePayAutoLog && (
        <p className={styles.helpText}>
          After you add the Shortcut, create a Shortcuts Automation with the
          Transaction trigger. It will send amount, merchant, and card from
          Apple Pay. Pick a default category below (Apple Pay does not send
          one). Name your cards in Finance to match Wallet.
        </p>
      )}

      <div className={styles.field}>
        <label htmlFor="shortcutName">Shortcut / token name</label>
        <input
          id="shortcutName"
          name="name"
          type="text"
          key={applePayAutoLog ? "apple-pay" : "manual"}
          defaultValue={
            applePayAutoLog ? "Apple Pay Auto Log" : "iPhone Shortcut"
          }
        />
      </div>

      <fieldset className={styles.checkList} disabled={applePayAutoLog}>
        <legend>Ask each time</legend>
        <label className={styles.checkItem}>
          <input
            type="checkbox"
            name="askCategory"
            value="true"
            checked={askCategory}
            onChange={(event) => setAskCategory(event.target.checked)}
          />
          Category
        </label>
        <label className={styles.checkItem}>
          <input type="checkbox" name="askCard" value="true" defaultChecked />
          Card
        </label>
        <label className={styles.checkItem}>
          <input type="checkbox" name="askMerchant" value="true" defaultChecked />
          Merchant
        </label>
        <label className={styles.checkItem}>
          <input type="checkbox" name="askNotes" value="true" />
          Notes
        </label>
      </fieldset>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="shortcutDefaultCategoryId">
            Default category{" "}
            {applePayAutoLog || !askCategory ? "" : "(optional)"}
          </label>
          <select
            id="shortcutDefaultCategoryId"
            name="defaultCategoryId"
            defaultValue=""
            required={applePayAutoLog || !askCategory}
          >
            <option value="">
              {applePayAutoLog || !askCategory
                ? "Choose a category"
                : "None — ask each time"}
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="shortcutDefaultPaymentMethodId">
            Default card (optional)
          </label>
          <select
            id="shortcutDefaultPaymentMethodId"
            name="defaultPaymentMethodId"
            defaultValue=""
          >
            <option value="">None / cash</option>
            {paymentMethods.map((pm) => (
              <option key={pm.id} value={pm.id}>
                {pm.nickname}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <Button type="submit" disabled={pending} className={styles.submit}>
        {pending ? "Signing Shortcut…" : "Generate QR code"}
      </Button>
    </form>
  );
}
