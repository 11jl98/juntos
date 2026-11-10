export function parseCSV(text: string): Record<string, string>[] {
  if (new TextEncoder().encode(text).length > 5 * 1024 * 1024)
    throw new Error("Limite: 5 MB.");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0] ?? "";
  const delimiter = first.includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("CSV com aspas não fechadas.");
  row.push(cell.replace(/\r$/, ""));
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length > 5001) throw new Error("Limite: 5.000 lançamentos.");
  const headers = rows.shift()?.map((h) => h.trim()) ?? [];
  if (new Set(headers).size !== headers.length)
    throw new Error("Cabeçalhos duplicados.");
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(`Linha ${i + 2}: número incorreto de colunas.`);
    return Object.fromEntries(headers.map((h, j) => [h, r[j].trim()]));
  });
}
export function exportCSV(rows: Record<string, string | number>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const cell = (v: string | number) =>
    '"' +
    String(
      typeof v === "string" && /^[\s]*[=+@\-\t\r]/.test(v) ? "'" + v : v,
    ).replace(/"/g, '""') +
    '"';
  return (
    "\uFEFF" +
    [
      keys.map(cell).join(";"),
      ...rows.map((r) => keys.map((k) => cell(r[k] ?? "")).join(";")),
    ].join("\r\n")
  );
}
