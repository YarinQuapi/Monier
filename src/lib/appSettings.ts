import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";

export const QUICK_LOG_SUCCESS_KEY = "quick_log.success_message";
export const QUICK_LOG_ERROR_KEY = "quick_log.error_message";

export const DEFAULT_QUICK_LOG_SUCCESS =
  "Logged {{amount}}{{#merchant}} at {{merchant}}{{/merchant}} ({{category}}){{#paymentMethod}} on {{paymentMethod}}{{/paymentMethod}}.";

export const DEFAULT_QUICK_LOG_ERROR =
  "Couldn't log purchase: {{error}}";

/**
 * Very small template language:
 * - `{{amount}}`, `{{category}}`, `{{merchant}}`, `{{paymentMethod}}`, `{{error}}` → replaced with values
 * - `{{#merchant}}...{{/merchant}}` / `{{#paymentMethod}}...{{/paymentMethod}}` → included only when that value is non-empty
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  let result = template;

  result = result.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key: string, inner: string) => {
      const value = vars[key];
      return value && value.trim().length > 0 ? inner : "";
    }
  );

  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value == null ? "" : value;
  });

  return result.replace(/\s+/g, " ").trim();
}

export async function getAppSetting(
  key: string,
  fallback: string
): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function getQuickLogMessages() {
  const [successTemplate, errorTemplate] = await Promise.all([
    getAppSetting(QUICK_LOG_SUCCESS_KEY, DEFAULT_QUICK_LOG_SUCCESS),
    getAppSetting(QUICK_LOG_ERROR_KEY, DEFAULT_QUICK_LOG_ERROR),
  ]);
  return { successTemplate, errorTemplate };
}

export async function formatQuickLogSuccessMessage(vars: {
  amount: number;
  category: string;
  merchant: string | null;
  paymentMethod?: string | null;
}): Promise<string> {
  const template = await getAppSetting(
    QUICK_LOG_SUCCESS_KEY,
    DEFAULT_QUICK_LOG_SUCCESS
  );
  return renderTemplate(template, {
    amount: formatCurrency(vars.amount),
    category: vars.category,
    merchant: vars.merchant,
    paymentMethod: vars.paymentMethod,
  });
}

export async function formatQuickLogErrorMessage(
  error: string
): Promise<string> {
  const template = await getAppSetting(
    QUICK_LOG_ERROR_KEY,
    DEFAULT_QUICK_LOG_ERROR
  );
  return renderTemplate(template, { error });
}
