import type { State, Entry } from "./types";
import { allocate } from "./money";
const sum = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0);
export type Invoice = {
  rows: Entry[];
  total: number;
  paid: number;
  open: number;
  credit: number;
  end: string;
  payableRows: { entryId: string; amount: number }[];
};
/** Carry credits forward, never use a later credit to silently pay an older invoice. */
export function invoiceLedger(
  s: State,
  cardId: string,
  untilMonth: string,
  asOf = "9999-12-31",
): Map<string, Invoice> {
  const entries = s.entries.filter((e) => e.cardId === cardId);
  const refunds = s.refunds.filter(
    (r) => r.cardId === cardId && r.date <= asOf,
  );
  const payments = s.payments.filter(
    (p) => p.cardId === cardId && p.date <= asOf,
  );
  const months = [
    ...new Set([
      untilMonth,
      ...entries.map((e) => e.date.slice(0, 7)),
      ...refunds.map((r) => r.date.slice(0, 7)),
      ...payments.map((p) => p.month),
    ]),
  ]
    .filter((m) => m <= untilMonth)
    .sort();
  let carry = 0;
  const ledger = new Map<string, Invoice>();
  for (const month of months) {
    const rows = entries.filter((e) => e.date.startsWith(month));
    const credits = refunds.filter((r) => r.date.startsWith(month));
    const local = rows.map((e) =>
      Math.max(
        0,
        e.amount -
          sum(credits.filter((r) => r.entryId === e.id).map((r) => r.amount)),
      ),
    );
    const external =
      carry +
      sum(
        credits
          .filter((r) => !rows.some((e) => e.id === r.entryId))
          .map((r) => r.amount),
      );
    const discounts = local.length
      ? allocate(Math.min(sum(local), external), local)
      : [];
    const total =
      sum(rows.map((e) => e.amount)) -
      sum(credits.map((r) => r.amount)) -
      carry;
    const paid = sum(
      payments.filter((p) => p.month === month).map((p) => p.amount),
    );
    carry = Math.max(0, paid - total);
    ledger.set(month, {
      rows,
      total,
      paid,
      open: Math.max(0, total - paid),
      credit: carry,
      end: month + "-31",
      payableRows: rows.map((e, i) => ({
        entryId: e.id,
        amount: local[i] - discounts[i],
      })),
    });
  }
  return ledger;
}

/** Track actual funding by person, including cash released by refunds and reused later. */
export function cardFunding(
  s: State,
  cardId: string,
): Map<string, [number, number]> {
  const entries = s.entries
    .filter((e) => e.cardId === cardId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const funds = new Map<string, [number, number]>();
  const net = new Map<string, number>();
  const credits: { month: string; source: string; money: [number, number] }[] =
    [];
  for (const e of entries) {
    const refunds = s.refunds
      .filter((r) => r.entryId === e.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const raw: [number, number] = [0, 0];
    for (const p of s.payments.filter((p) => p.cardId === cardId))
      raw[p.person === "a" ? 0 : 1] += sum(
        p.allocations.filter((a) => a.entryId === e.id).map((a) => a.amount),
      );
    const paid = sum(raw),
      remaining = Math.max(0, e.amount - sum(refunds.map((r) => r.amount)));
    net.set(e.id, remaining);
    const retained = allocate(Math.min(remaining, paid), raw) as [
      number,
      number,
    ];
    funds.set(e.id, retained);
    const release: [number, number] = [
      raw[0] - retained[0],
      raw[1] - retained[1],
    ];
    let unfunded = Math.max(0, e.amount - paid);
    for (const r of refunds) {
      const amount = Math.min(sum(release), Math.max(0, r.amount - unfunded));
      unfunded = Math.max(0, unfunded - r.amount);
      if (amount) {
        const money = allocate(amount, release) as [number, number];
        release[0] -= money[0];
        release[1] -= money[1];
        credits.push({ month: r.date.slice(0, 7), source: e.id, money });
      }
    }
  }
  for (const credit of credits.sort(
    (a, b) =>
      a.month.localeCompare(b.month) || a.source.localeCompare(b.source),
  )) {
    const months = [
      ...new Set(
        entries
          .filter((e) => e.date.slice(0, 7) >= credit.month)
          .map((e) => e.date.slice(0, 7)),
      ),
    ].sort();
    for (const month of months) {
      const eligible = entries.filter(
        (e) => e.date.startsWith(month) && e.id !== credit.source,
      );
      for (const person of [0, 1] as const) {
        const gaps = eligible.map((e) =>
          Math.max(0, (net.get(e.id) ?? 0) - sum(funds.get(e.id)!)),
        );
        const available = Math.min(credit.money[person], sum(gaps));
        if (!available) continue;
        const distribution = allocate(available, gaps);
        eligible.forEach((e, i) => {
          funds.get(e.id)![person] += distribution[i];
        });
        credit.money[person] -= available;
      }
    }
  }
  return funds;
}
