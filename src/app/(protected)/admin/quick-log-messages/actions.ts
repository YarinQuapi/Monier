"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/authorization";
import {
  DEFAULT_QUICK_LOG_ERROR,
  DEFAULT_QUICK_LOG_SUCCESS,
  QUICK_LOG_ERROR_KEY,
  QUICK_LOG_SUCCESS_KEY,
  setAppSetting,
} from "@/lib/appSettings";

export type QuickLogMessagesFormState =
  | { error: string }
  | { success: true }
  | undefined;

export async function updateQuickLogMessages(
  _prevState: QuickLogMessagesFormState,
  formData: FormData
): Promise<QuickLogMessagesFormState> {
  await verifyAdmin();

  const successMessage = String(formData.get("successMessage") ?? "").trim();
  const errorMessage = String(formData.get("errorMessage") ?? "").trim();

  if (successMessage.length === 0) {
    return { error: "Success message can’t be empty." };
  }
  if (errorMessage.length === 0) {
    return { error: "Error message can’t be empty." };
  }

  await Promise.all([
    setAppSetting(QUICK_LOG_SUCCESS_KEY, successMessage),
    setAppSetting(QUICK_LOG_ERROR_KEY, errorMessage),
  ]);

  revalidatePath("/admin/quick-log-messages");
  return { success: true };
}

export async function resetQuickLogMessages() {
  await verifyAdmin();
  await Promise.all([
    setAppSetting(QUICK_LOG_SUCCESS_KEY, DEFAULT_QUICK_LOG_SUCCESS),
    setAppSetting(QUICK_LOG_ERROR_KEY, DEFAULT_QUICK_LOG_ERROR),
  ]);
  revalidatePath("/admin/quick-log-messages");
}
