import { DEFAULT_BUDGET, type State, type Entry } from "./types";
import { allocate } from "./money";
import { invoiceLedger, cardFunding } from "./card-ledger";
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
export const goalSaved = (s: State, id: string, until = "9999-12-31") =>
  (s.goals.find((g) => g.id === id)?.initial ?? 0) +
  sum(
    s.movements
      .filter((m) => m.goalId === id && !m.planned && m.date <= until)
      .map((m) => m.amount),
  );
export const entryRefund = (s: State, id: string) =>
  sum(s.refunds.filter((r) => r.entryId === id).map((r) => r.amount));
export const entryPaid = (s: State, id: string) =>
  sum(
    s.payments
      .flatMap((p) => p.allocations)
      .filter((a) => a.entryId === id)
      .map((a) => a.amount),
  );
export function accountBalance(s: State, id: string, until = "9999-12-31") {
  const a = s.accounts.find((a) => a.id === id);
  if (!a) return 0;
  return (
    (a.openingDate <= until ? a.opening : 0) +
    sum(
      s.entries
        .filter(
          (e) =>
            e.accountId === id &&
            !e.cardId &&
            e.paidDate &&
            e.paidDate > a.openingDate &&
            e.paidDate <= until,
        )
        .map((e) => e.amount * (e.kind === "income" ? 1 : -1)),
    ) -
    sum(
      s.payments
        .filter(
          (p) =>
            p.accountId === id &&
            p.date > a.openingDate &&
            p.date <= until,
        )
        .map((p) => p.amount),
    ) -
    sum(
      s.movements
        .filter(
          (m) =>
            m.accountId === id &&
            !m.planned &&
            m.date > a.openingDate &&
            m.date <= until,
        )
        .map((m) => m.amount),
    ) +
    sum(
      s.transfers
        .filter((t) => t.date > a.openingDate && t.date <= until)
        .map((t) => (t.to === id ? t.amount : t.from === id ? -t.amount : 0)),
    )
  );
}
export function invoice(s: State, cardId: string, month: string) {
  return invoiceLedger(s, cardId, month).get(month)!;
}
export function settlement(s: State) {
  let debt = 0;
  for (const e of s.entries.filter(
    (e) => e.kind === "expense" && !e.cardId && e.paidDate,
  )) {
    const [a, b] = allocate(e.amount, [e.splitA, 100 - e.splitA]);
    debt += e.person === "a" ? b : -a;
  }
  for (const card of s.cards) {
    for (const [id, funding] of cardFunding(s, card.id)) {
      const e = s.entries.find((e) => e.id === id)!;
      debt += allocate(funding[0], [e.splitA, 100 - e.splitA])[1];
      debt -= allocate(funding[1], [e.splitA, 100 - e.splitA])[0];
    }
  }
  for (const t of s.transfers.filter((t) => t.settle)) {
    const from = s.accounts.find((a) => a.id === t.from);
    debt += from?.owner === "b" ? -t.amount : t.amount;
  }
  return debt;
}
export function summarize(s: State, month: string) {
  const entries = s.entries.filter((e) => e.date.startsWith(month));
  const income = sum(
    entries.filter((e) => e.kind === "income").map((e) => e.amount),
  );
  const received = sum(
    entries
      .filter(
        (e) => e.kind === "income" && e.paidDate && e.paidDate <= month + "-31",
      )
      .map((e) => e.amount),
  );
  const refunds = sum(
    s.refunds.filter((r) => r.date.startsWith(month)).map((r) => r.amount),
  );
  const expense =
    sum(entries.filter((e) => e.kind === "expense").map((e) => e.amount)) -
    refunds;
  const end = month + "-31";
  const latestOpeningDate = s.accounts.reduce(
    (latest, a) => (a.openingDate > latest ? a.openingDate : latest),
    "",
  );
  const cash =
    sum(s.accounts.map((a) => accountBalance(s, a.id, end))) +
    sum(
      s.entries
        .filter(
          (e) =>
            e.kind === "income" &&
            !e.accountId &&
            e.paidDate &&
            e.paidDate > latestOpeningDate &&
            e.paidDate <= end,
        )
        .map((e) => e.amount),
    );
  const pendingIncome = sum(
    s.entries
      .filter(
        (e) =>
          e.kind === "income" &&
          (!e.paidDate || e.paidDate > end) &&
          e.date <= end,
      )
      .map((e) => e.amount),
  );
  const pendingCash = sum(
    s.entries
      .filter(
        (e) =>
          e.kind === "expense" &&
          !e.cardId &&
          (!e.paidDate || e.paidDate > end) &&
          e.date <= end,
      )
      .map((e) => e.amount),
  );
  const outstanding = sum(
    s.cards.map((c) =>
      sum(
        [...invoiceLedger(s, c.id, month, end).values()].map((inv) => inv.open),
      ),
    ),
  );
  const planned = sum(
    s.movements.filter((m) => m.planned && m.date <= end).map((m) => m.amount),
  );
  const projected = cash + pendingIncome - pendingCash - outstanding - planned;
  const contributed = sum(
    s.movements.filter((m) => m.date.startsWith(month)).map((m) => m.amount),
  );
  const result = income - expense;
  const budget = s.budgets[month] ?? DEFAULT_BUDGET;
  const capacity = Math.max(
    0,
    Math.min(result - contributed, projected - budget.margin),
  );
  const used = [
    sum(
      entries
        .filter(
          (e) =>
            e.kind === "expense" &&
            s.categories.find((c) => c.id === e.categoryId)?.group !== "fun",
        )
        .map((e) => e.amount),
    ) -
      sum(
        s.refunds
          .filter(
            (r) =>
              r.date.startsWith(month) &&
              s.categories.find(
                (c) =>
                  c.id ===
                  s.entries.find((e) => e.id === r.entryId)?.categoryId,
              )?.group !== "fun",
          )
          .map((r) => r.amount),
      ),
    sum(
      entries
        .filter(
          (e) =>
            e.kind === "expense" &&
            s.categories.find((c) => c.id === e.categoryId)?.group === "fun",
        )
        .map((e) => e.amount),
    ) -
      sum(
        s.refunds
          .filter(
            (r) =>
              r.date.startsWith(month) &&
              s.categories.find(
                (c) =>
                  c.id ===
                  s.entries.find((e) => e.id === r.entryId)?.categoryId,
              )?.group === "fun",
          )
          .map((r) => r.amount),
      ),
    ...(["reserve", "invest"] as const).map((g) =>
      sum(
        s.movements
          .filter(
            (m) =>
              m.date.startsWith(month) &&
              s.goals.find((x) => x.id === m.goalId)?.group === g,
          )
          .map((m) => m.amount),
      ),
    ),
  ];
  return {
    income,
    received,
    expense,
    cash,
    projected,
    result,
    capacity,
    contributed,
    pending: pendingCash + outstanding,
    budget,
    limits: allocate(income, budget.percentages),
    used,
  };
}
export function goalPlans(s: State, month: string) {
  const totals = summarize(s, month);
  const quotas = [
    Math.max(0, totals.limits[2] - totals.used[2]),
    Math.max(0, totals.limits[3] - totals.used[3]),
  ];
  const pools = allocate(Math.min(totals.capacity, sum(quotas)), quotas);
  const [y, m] = month.split("-").map(Number);
  return [...s.goals]
    .sort(
      (a, b) => a.priority - b.priority || a.deadline.localeCompare(b.deadline),
    )
    .map((g) => {
      const saved = goalSaved(s, g.id, month + "-31");
      const left = Math.max(0, g.target - saved);
      const [gy, gm] = g.deadline.split("-").map(Number);
      const months = (gy - y) * 12 + gm - m + 1;
      const overdue = months <= 0 && left > 0;
      const needed = overdue ? left : Math.ceil(left / Math.max(1, months));
      const planned = sum(
        s.movements
          .filter(
            (x) => x.goalId === g.id && x.planned && x.date.startsWith(month),
          )
          .map((x) => x.amount),
      );
      const index = g.group === "reserve" ? 0 : 1;
      const suggested = overdue
        ? 0
        : Math.min(Math.max(0, needed - planned), pools[index]);
      pools[index] -= suggested;
      return {
        ...g,
        saved,
        left,
        needed,
        overdue,
        suggested,
        shortfall: Math.max(0, needed - planned - suggested),
      };
    });
}
export function categorySpending(s: State, month: string) {
  return s.categories
    .map((c) => ({
      ...c,
      total:
        sum(
          s.entries
            .filter(
              (e) =>
                e.kind === "expense" &&
                e.categoryId === c.id &&
                e.date.startsWith(month),
            )
            .map((e) => e.amount),
        ) -
        sum(
          s.refunds
            .filter(
              (r) =>
                r.date.startsWith(month) &&
                s.entries.find((e) => e.id === r.entryId)?.categoryId === c.id,
            )
            .map((r) => r.amount),
        ),
    }))
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total);
}
export function splitProportional(s: State, month: string) {
  const a = sum(
    s.entries
      .filter(
        (e) =>
          e.kind === "income" && e.person === "a" && e.date.startsWith(month),
      )
      .map((e) => e.amount),
  );
  const b = sum(
    s.entries
      .filter(
        (e) =>
          e.kind === "income" && e.person === "b" && e.date.startsWith(month),
      )
      .map((e) => e.amount),
  );
  if (!a && !b)
    throw new Error(
      "Cadastre as rendas previstas para dividir proporcionalmente.",
    );
  return Math.round((a / (a + b)) * 10000) / 100;
}
