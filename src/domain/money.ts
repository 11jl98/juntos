export const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
export function money(value: string): number {
  const v = value
    .trim()
    .replace(/R\$\s?/, "")
    .replace(/\s/g, "");
  const normalized = v.includes(",")
    ? v.replace(/\./g, "").replace(",", ".")
    : v;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized))
    throw new Error("Informe um valor com até dois centavos decimais.");
  const n = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12)
    throw new Error("Valor fora do limite.");
  return n;
}
export function allocate(total: number, weights: number[]): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !weights.length ||
    weights.some((w) => !Number.isFinite(w) || w < 0)
  )
    throw new Error("Rateio inválido.");
  const sum = weights.reduce((s, v) => s + v, 0);
  if (!sum) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum),
    out = raw.map(Math.floor);
  const order = raw
    .map((v, i) => ({ i, r: v - out[i] }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  let rest = total - out.reduce((s, v) => s + v, 0);
  for (let j = 0; rest > 0; j++, rest--) out[order[j % order.length].i]++;
  return out;
}
export function installmentAmounts(total: number, count: number) {
  if (
    !Number.isSafeInteger(total) ||
    total <= 0 ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > 120 ||
    total < count
  )
    throw new Error("Parcelamento inválido.");
  const base = Math.floor(total / count);
  return Array.from(
    { length: count },
    (_, i) => base + (i === count - 1 ? total % count : 0),
  );
}
export function addMonths(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
export function firstInvoice(date: string, closing: number, due: number) {
  const m = date.slice(0, 7);
  const close = addMonths(`${m}-${String(closing).padStart(2, "0")}`, 0);
  const closeMonth = date >= close ? addMonths(m + "-01", 1).slice(0, 7) : m;
  const actualClosing = addMonths(
    `${closeMonth}-${String(closing).padStart(2, "0")}`,
    0,
  );
  const candidate = addMonths(
    `${closeMonth}-${String(due).padStart(2, "0")}`,
    0,
  );
  const dueMonth =
    candidate <= actualClosing
      ? addMonths(closeMonth + "-01", 1).slice(0, 7)
      : closeMonth;
  return addMonths(`${dueMonth}-${String(due).padStart(2, "0")}`, 0);
}
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(month + "-01T12:00:00Z"));
}
export function dateLabel(date: string) {
  return date.split("-").reverse().join("/");
}
