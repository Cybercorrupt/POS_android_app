/** Format a whole-rupiah amount as "Rp1.250.000". */
export function formatCurrency(value: number): string {
  const n = Math.round(Number.isFinite(value) ? value : 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toLocaleString("id-ID");
  return `${sign}Rp${abs}`;
}

/** Parse a user-typed rupiah string ("1.250.000" or "1250000") into a number. */
export function parseNumber(input: string): number {
  if (!input) return 0;
  const cleaned = input.replace(/[^0-9]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? 0 : n;
}

/** Group digits with dots for display inside inputs: "1250000" -> "1.250.000". */
export function formatThousands(value: number): string {
  if (!value) return "";
  return Math.round(value).toLocaleString("id-ID");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }) + " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
