"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PurchaseForm } from "./PurchaseForm";
import type { PurchaseFormState } from "./actions";
import styles from "./page.module.css";

interface CategoryOption {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  nickname: string;
  type: "CREDIT_CARD" | "DEBIT_CARD" | "BANK_ACCOUNT";
}

interface AddPurchaseModalProps {
  action: (
    state: PurchaseFormState,
    formData: FormData
  ) => Promise<PurchaseFormState>;
  categories: CategoryOption[];
  paymentMethods: PaymentMethodOption[];
  isAdmin: boolean;
}

export function AddPurchaseModal({
  action,
  categories,
  paymentMethods,
  isAdmin,
}: AddPurchaseModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <Button type="button" onClick={() => setIsOpen(true)}>
        + Add purchase
      </Button>

      {isOpen && (
        <div
          className={styles.modalOverlay}
          onClick={() => setIsOpen(false)}
          role="presentation"
        >
          <div
            className={styles.modalPanel}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-purchase-modal-title"
          >
            <div className={styles.modalHeader}>
              <h2 id="add-purchase-modal-title">Add a purchase</h2>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {categories.length === 0 ? (
              <EmptyState>
                No categories exist yet.{" "}
                {isAdmin ? (
                  <>
                    Create one in the{" "}
                    <Link href="/admin/categories">Admin panel</Link> first.
                  </>
                ) : (
                  "Ask an admin to add some before logging a purchase."
                )}
              </EmptyState>
            ) : (
              <PurchaseForm
                action={action}
                submitLabel="Add purchase"
                categories={categories}
                paymentMethods={paymentMethods}
                onSuccess={() => setIsOpen(false)}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
