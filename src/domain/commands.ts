import {
  commandSchema,
  stateSchema,
  DEFAULT_BUDGET,
  type State,
  type Command,
  type Entry,
} from "./types";
import { addMonths, allocate, installmentAmounts } from "./money";
import { invoice, entryRefund, entryPaid, goalSaved } from "./finance";

export function emptyState(): State {
  return {
    skippedOccurrences: [],
    schemaVersion: 1,
    names: ["Você", "Seu amor"],
    accounts: [],
    categories: [
      {
        id: "housing",
        name: "Moradia",
        group: "essential",
        housing: true,
        archived: false,
      },
      {
        id: "market",
        name: "Mercado",
        group: "essential",
        housing: false,
        archived: false,
      },
      {
        id: "transport",
        name: "Transporte",
        group: "essential",
        housing: false,
        archived: false,
      },
      {
        id: "health",
        name: "Saúde",
        group: "essential",
        housing: false,
        archived: false,
      },
      {
        id: "leisure",
        name: "Lazer",
        group: "fun",
        housing: false,
        archived: false,
      },
      {
        id: "salary",
        name: "Salário / renda",
        group: "essential",
        housing: false,
        archived: false,
      },
    ],
    entries: [],
    cards: [],
    goals: [],
    rules: [],
    movements: [],
    budgets: {},
    payments: [],
    refunds: [],
    transfers: [],
    imports: [],
    audit: [],
  };
}
function requireItem<T extends { id: string }>(
  items: T[],
  id: string,
  label: string,
): T {
  const item = items.find((x) => x.id === id);
  if (!item) throw new Error(`${label} não encontrado.`);
  return item;
}
function upsert<T extends { id: string }>(items: T[], value: T) {
  const i = items.findIndex((x) => x.id === value.id);
  if (i < 0) items.push(value);
  else items[i] = value;
}
function fresh(s: State, id: string) {
  if (
    [
      ...s.entries,
      ...s.payments,
      ...s.refunds,
      ...s.transfers,
      ...s.movements,
      ...s.imports,
    ].some((x) => x.id === id)
  )
    throw new Error("Operação já registrada. Atualize a página.");
}
function accountDate(s: State, id: string, date: string) {
  const a = requireItem(s.accounts, id, "Conta");
  if (date < a.openingDate)
    throw new Error("A data é anterior ao saldo inicial da conta.");
}
function validateEntry(s: State, e: Entry) {
  requireItem(s.categories, e.categoryId, "Categoria");
  if (e.accountId) requireItem(s.accounts, e.accountId, "Conta");
  else if (e.kind === "expense")
    throw new Error("Despesas precisam de uma conta.");
  if (e.paidDate && e.accountId) accountDate(s, e.accountId, e.paidDate);
  if (e.cardId)
    throw new Error("Use o formulário de compra para lançamentos no cartão.");
}
export function applyCommand(
  input: State,
  raw: Command,
  actor: string,
  date: string,
): State {
  const c = commandSchema.parse(raw),
    s = structuredClone(input);
  switch (c.type) {
    case "names":
      s.names = c.names;
      break;
    case "account": {
      const old = s.accounts.find((a) => a.id === c.value.id);
      if (
        old &&
        (old.owner !== c.value.owner ||
          old.openingDate !== c.value.openingDate) &&
        ([...s.entries, ...s.payments, ...s.movements, ...s.rules].some(
          (e) => e.accountId === old.id,
        ) ||
          s.transfers.some((t) => t.from === old.id || t.to === old.id))
      )
        throw new Error(
          "Conta com histórico: mantenha o titular e a data inicial.",
        );
      upsert(s.accounts, c.value);
      break;
    }
    case "category":
      upsert(s.categories, c.value);
      break;
    case "card":
      upsert(s.cards, c.value);
      break;
    case "goal": {
      const old = s.goals.find((g) => g.id === c.value.id);
      if (
        old &&
        s.movements.some((m) => m.goalId === old.id) &&
        (old.initial !== c.value.initial || old.group !== c.value.group)
      )
        throw new Error("Meta com aportes: mantenha saldo inicial e grupo.");
      upsert(s.goals, c.value);
      break;
    }
    case "entry": {
      validateEntry(s, c.value);
      const old = s.entries.find((e) => e.id === c.value.id);
      if (old?.cardId)
        throw new Error("Compra de cartão: use estorno para ajustar.");
      const value = { ...c.value };
      if (old?.batchId) {
        delete value.batchId;
      }
      if (old?.recurringId) value.recurringId = old.recurringId;
      upsert(s.entries, value);
      break;
    }
    case "payEntry": {
      const e = requireItem(s.entries, c.id, "Lançamento");
      if (e.cardId || e.paidDate)
        throw new Error("Lançamento já pago ou vinculado a fatura.");
      if (e.accountId) accountDate(s, e.accountId, c.date);
      e.paidDate = c.date;
      delete e.batchId;
      break;
    }
    case "budget":
      s.budgets[c.month] = {
        percentages: c.percentages,
        margin: c.margin,
        splitMode: c.splitMode,
        splitA: c.splitA,
      };
      break;
    case "purchase": {
      fresh(s, c.id + "-1");
      requireItem(s.cards, c.cardId, "Cartão");
      requireItem(s.categories, c.categoryId, "Categoria");
      if (!s.accounts.length)
        throw new Error("Cadastre uma conta antes de registrar compras.");
      if (c.firstDue < c.date)
        throw new Error("A primeira fatura não pode vencer antes da compra.");
      installmentAmounts(c.amount, c.count).forEach((amount, i) => {
        s.entries.push({
          id: c.id + "-" + (i + 1),
          kind: "expense",
          description: c.description,
          amount,
          date: addMonths(c.firstDue, i),
          categoryId: c.categoryId,
          accountId: s.accounts[0].id,
          person: c.person,
          splitA: c.splitA,
          paidDate: null,
          cardId: c.cardId,
          purchaseId: c.id,
          part: i + 1,
          parts: c.count,
        });
      });
      break;
    }
    case "payInvoice": {
      fresh(s, c.id);
      requireItem(s.cards, c.cardId, "Cartão");
      accountDate(s, c.accountId, c.date);
      const inv = invoice(s, c.cardId, c.month);
      if (c.amount > inv.open)
        throw new Error("O pagamento excede o saldo da fatura.");
      const rows = inv.rows
        .map((e) => ({
          e,
          open: Math.max(
            0,
            (inv.payableRows.find((row) => row.entryId === e.id)?.amount ?? 0) -
              entryPaid(s, e.id),
          ),
        }))
        .filter((x) => x.open > 0);
      const distribution = allocate(
        c.amount,
        rows.map((x) => x.open),
      );
      s.payments.push({
        ...c,
        allocations: rows
          .map((x, i) => ({ entryId: x.e.id, amount: distribution[i] }))
          .filter((x) => x.amount > 0),
      });
      break;
    }
    case "refund": {
      fresh(s, c.id);
      const e = requireItem(s.entries, c.entryId, "Compra");
      if (!e.cardId)
        throw new Error("Somente compras de cartão podem ser estornadas.");
      if (c.amount > e.amount - entryRefund(s, e.id))
        throw new Error("Estorno excede o valor da parcela.");
      s.refunds.push({
        id: c.id,
        entryId: e.id,
        cardId: e.cardId,
        amount: c.amount,
        date: c.date,
      });
      break;
    }
    case "movement": {
      fresh(s, c.value.id);
      requireItem(s.goals, c.value.goalId, "Meta");
      accountDate(s, c.value.accountId, c.value.date);
      const reserved = s.movements
        .filter((m) => m.goalId === c.value.goalId && m.planned && m.amount < 0)
        .reduce((n, m) => n - m.amount, 0);
      if (
        c.value.amount < 0 &&
        -c.value.amount > goalSaved(s, c.value.goalId, c.value.date) - reserved
      )
        throw new Error("Retirada excede o saldo guardado.");
      s.movements.push(c.value);
      break;
    }
    case "confirmMovement": {
      const m = requireItem(s.movements, c.id, "Aporte");
      if (!m.planned) throw new Error("Aporte já confirmado.");
      if (m.amount < 0 && -m.amount > goalSaved(s, m.goalId))
        throw new Error("Saldo insuficiente na meta.");
      m.planned = false;
      break;
    }
    case "transfer": {
      fresh(s, c.id);
      accountDate(s, c.from, c.date);
      accountDate(s, c.to, c.date);
      if (c.from === c.to) throw new Error("Escolha duas contas diferentes.");
      if (
        c.settle &&
        s.accounts.find((a) => a.id === c.from)?.owner ===
          s.accounts.find((a) => a.id === c.to)?.owner
      )
        throw new Error("Acertos exigem contas de pessoas diferentes.");
      s.transfers.push(c);
      break;
    }
    case "recurring": {
      if (c.value.accountId)
        requireItem(s.accounts, c.value.accountId, "Conta");
      else if (c.value.kind === "expense")
        throw new Error("Despesas recorrentes precisam de uma conta.");
      requireItem(s.categories, c.value.categoryId, "Categoria");
      if (c.value.end && c.value.end < c.value.start)
        throw new Error("Fim anterior ao início.");
      const old = s.rules.find((r) => r.id === c.value.id);
      if (old) {
        // Capture the old schedule before replacing its effective start/rate.
        s.entries = applyCommand(
          s,
          { type: "materialize", month: c.value.start.slice(0, 7) },
          actor,
          date,
        ).entries;
        s.entries = s.entries.filter(
          (e) =>
            e.recurringId !== old.id || e.date < c.value.start || e.paidDate,
        );
        c.value.id = old.id;
      }
      upsert(s.rules, c.value);
      break;
    }
    case "materialize": {
      if (!s.budgets[c.month])
        s.budgets[c.month] = structuredClone(DEFAULT_BUDGET);
      for (const r of s.rules) {
        const startYear = Number(r.start.slice(0, 4)),
          endYear = Number(c.month.slice(0, 4));
        const distance =
          (endYear - startYear) * 12 +
          Number(c.month.slice(5, 7)) -
          Number(r.start.slice(5, 7));
        if (distance > 600)
          throw new Error("A recorrência excede o horizonte de 50 anos.");
        for (let offset = 0; offset <= distance; offset++) {
          const due = addMonths(r.start, offset);
          const id = r.id + ":" + due.slice(0, 7);
          if (
            due >= r.start &&
            (!r.end || due <= r.end) &&
            !s.skippedOccurrences.includes(id) &&
            !s.entries.some((e) => e.id === id)
          )
            s.entries.push({
              id,
              kind: r.kind,
              description: r.description,
              amount: r.amount,
              date: due,
              categoryId: r.categoryId,
              accountId: r.accountId,
              person: r.person,
              splitA: r.splitA,
              paidDate: null,
              recurringId: r.id,
            });
        }
      }
      break;
    }
    case "import": {
      if (s.imports.some((i) => i.hash === c.hash))
        throw new Error("Este arquivo já foi importado.");
      for (const e of c.entries) {
        fresh(s, e.id);
        validateEntry(s, e);
        s.entries.push({ ...e, batchId: c.id });
      }
      s.imports.push({
        id: c.id,
        hash: c.hash,
        date,
        description: c.description,
      });
      break;
    }
    case "undoImport": {
      const batch = requireItem(s.imports, c.id, "Importação");
      const created = s.audit.find((a) => a.action === "import:" + batch.id);
      const changed = s.audit.some(
        (a) => a.action === "edited-import:" + batch.id,
      );
      if (changed)
        throw new Error(
          "Importação já editada ou conciliada; ajuste os lançamentos individualmente.",
        );
      s.entries = s.entries.filter((e) => e.batchId !== c.id);
      s.imports = s.imports.filter((i) => i.id !== c.id);
      void created;
      break;
    }
    case "delete": {
      if (c.entity === "entry") {
        const e = requireItem(s.entries, c.id, "Lançamento");
        if (e.cardId)
          throw new Error(
            "Use um estorno para preservar o histórico do cartão.",
          );
        if (e.recurringId && !s.skippedOccurrences.includes(e.id))
          s.skippedOccurrences.push(e.id);
        s.entries = s.entries.filter((e) => e.id !== c.id);
      } else if (c.entity === "rule") {
        s.rules = s.rules.filter((r) => r.id !== c.id);
      } else if (c.entity === "account") {
        if (
          s.entries.some((e) => e.accountId === c.id) ||
          s.rules.some((e) => e.accountId === c.id) ||
          s.payments.some((p) => p.accountId === c.id) ||
          s.movements.some((m) => m.accountId === c.id) ||
          s.transfers.some((t) => t.from === c.id || t.to === c.id)
        )
          throw new Error("Conta possui histórico.");
        s.accounts = s.accounts.filter((a) => a.id !== c.id);
      } else if (c.entity === "card") {
        if (s.entries.some((e) => e.cardId === c.id))
          throw new Error("Cartão possui histórico.");
        s.cards = s.cards.filter((a) => a.id !== c.id);
      } else if (c.entity === "goal") {
        if (s.movements.some((m) => m.goalId === c.id))
          throw new Error("Meta possui movimentações.");
        s.goals = s.goals.filter((g) => g.id !== c.id);
      } else {
        if (
          s.entries.some((e) => e.categoryId === c.id) ||
          s.rules.some((r) => r.categoryId === c.id)
        )
          throw new Error(
            "Categoria em uso. Arquive-a para preservar o histórico.",
          );
        s.categories = s.categories.filter((g) => g.id !== c.id);
      }
      break;
    }
  }
  if (
    c.type === "entry" ||
    c.type === "payEntry" ||
    (c.type === "delete" && c.entity === "entry")
  ) {
    const id = c.type === "entry" ? c.value.id : c.id;
    const old = input.entries.find((e) => e.id === id);
    if (old?.batchId)
      s.audit.push({
        actor,
        action: "edited-import:" + old.batchId,
        at: new Date().toISOString(),
      });
  }
  if (c.type !== "materialize")
    s.audit.push({
      actor,
      action: c.type === "import" ? "import:" + c.id : c.type,
      at: new Date().toISOString(),
    });
  return stateSchema.parse(s);
}
