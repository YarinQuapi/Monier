const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats a number as an ILS amount, e.g. `1234.5` -> `"₪1,234.50"`. */
export function formatCurrency(amount: number | string): string {
  return currencyFormatter.format(Number(amount));
}
