import test from "node:test";
import assert from "node:assert/strict";
import { applyCommand, emptyState } from "../src/domain/commands";
import {
  invoice,
  settlement,
  summarize,
  goalPlans,
} from "../src/domain/finance";
import { firstInvoice } from "../src/domain/money";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { Forms } from "../src/components/forms";
import { Auth } from "../src/components/auth";
import { Cards } from "../src/components/cards";
import { Entries } from "../src/components/entries";
import { Planning } from "../src/components/planning";
import { assertRevision } from "../src/domain/revision";
import { DEFAULT_BUDGET } from "../src/domain/types";
function fixture() {
  const s = emptyState();
  s.accounts = [
    {
      id: "a",
      name: "Ana",
      owner: "a",
      opening: 0,
      openingDate: "2026-01-01",
      primary: true,
    },
    {
      id: "b",
      name: "Beto",
      owner: "b",
      opening: 0,
      openingDate: "2026-01-01",
      primary: true,
    },
  ];
  s.cards = [
    {
      id: "c",
      name: "C",
      owner: "a",
      limit: 100000,
      closing: 5,
      due: 12,
      color: "purple",
    },
  ];
  return s;
}
const run = (
  s: ReturnType<typeof fixture>,
  c: Parameters<typeof applyCommand>[1],
) => applyCommand(s, c, "test", "2026-11-10");
function charge(
  s: ReturnType<typeof fixture>,
  id: string,
  month: string,
  amount = 10000,
  splitA = 50,
) {
  return run(s, {
    type: "purchase",
    id,
    description: id,
    amount,
    date: month + "-01",
    firstDue: month + "-12",
    count: 1,
    cardId: "c",
    categoryId: "housing",
    person: "a",
    splitA,
  });
}
function pay(
  s: ReturnType<typeof fixture>,
  id: string,
  month: string,
  amount = 10000,
) {
  return run(s, {
    type: "payInvoice",
    id,
    cardId: "c",
    month,
    amount,
    accountId: "a",
    person: "a",
    date: month + "-12",
  });
}
test("first invoice always follows actual clamped closing date", () =>
  assert.equal(firstInvoice("2027-02-01", 30, 31), "2027-03-31"));
test("account owner cannot change after settlement transfer", () => {
  let s = fixture();
  s = run(s, {
    type: "transfer",
    id: "t",
    from: "a",
    to: "b",
    amount: 10000,
    date: "2026-11-01",
    settle: true,
  });
  assert.throws(() =>
    run(s, { type: "account", value: { ...s.accounts[0], owner: "b" } }),
  );
  assert.throws(() =>
    run(s, {
      type: "account",
      value: { ...s.accounts[0], openingDate: "2026-12-01" },
    }),
  );
});
test("opening an expense editor preserves its custom split", () => {
  const s = fixture();
  s.entries.push({
    id: "e",
    kind: "expense",
    description: "Rent",
    amount: 10000,
    date: "2026-11-10",
    categoryId: "housing",
    accountId: "a",
    person: "a",
    splitA: 70,
    paidDate: null,
  });
  const html = renderToStaticMarkup(
    createElement(Forms, {
      state: s,
      month: "2026-11",
      dialog: { kind: "entry", id: "e" },
      onClose: () => {},
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /<option value="custom" selected="">/);
  assert.match(html, /name="splitA"[^>]*value="70"/);
});
test("new expenses inherit the configured planning split", () => {
  const s = fixture();
  s.budgets["2026-11"] = {
    ...DEFAULT_BUDGET,
    splitMode: "fixed",
    splitA: 70,
  };
  const html = renderToStaticMarkup(
    createElement(Forms, {
      state: s,
      month: "2026-11",
      dialog: { kind: "entry" },
      onClose: () => {},
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /<option value="configured" selected="">/);
});
test("expense form explains automatic debits from primary accounts", () => {
  const html = renderToStaticMarkup(
    createElement(Forms, {
      state: fixture(),
      month: "2026-11",
      dialog: { kind: "entry" },
      onClose: () => {},
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /cotas serão debitadas automaticamente/);
  assert.match(html, /conta não precisa ser selecionada/);
  assert.doesNotMatch(html, /Quem paga/);
});
test("income form identifies the owner of each optional account", () => {
  const s = fixture();
  s.entries.push({
    id: "salary",
    kind: "income",
    description: "Salário",
    amount: 100000,
    date: "2026-11-05",
    categoryId: "salary",
    accountId: "a",
    person: "a",
    splitA: 50,
    paidDate: null,
  });
  const html = renderToStaticMarkup(
    createElement(Forms, {
      state: s,
      month: "2026-11",
      dialog: { kind: "entry", id: "salary" },
      onClose: () => {},
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /Ana · Você/);
  assert.match(html, /Beto · Seu amor/);
});
test("planning shows discretionary card and non-card spending with safeguards", () => {
  const s = fixture();
  s.entries.push(
    {
      id: "fun-cash",
      kind: "expense",
      description: "Cinema",
      amount: 10000,
      date: "2026-11-05",
      categoryId: "leisure",
      accountId: "a",
      person: "a",
      splitA: 100,
      paidDate: null,
    },
    {
      id: "fun-card",
      kind: "expense",
      description: "Show",
      amount: 20000,
      date: "2026-11-06",
      categoryId: "leisure",
      accountId: "a",
      person: "a",
      splitA: 100,
      paidDate: null,
      cardId: "c",
    },
  );
  const html = renderToStaticMarkup(
    createElement(Planning, {
      state: s,
      month: "2026-11",
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /Gastos que podem abrir espaço para metas/);
  assert.match(html, /Cartão:.*200,00.*À vista \/ outros:.*100,00/);
  assert.match(html, /nem cria aportes/);
});
test("new card purchases default to the cardholder as an individual expense", () => {
  const s = fixture();
  const html = renderToStaticMarkup(
    createElement(Forms, {
      state: s,
      month: "2026-11",
      dialog: { kind: "purchase" },
      onClose: () => {},
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /<option value="individual" selected="">/);
  assert.match(html, /C · Você/);
  assert.match(html, /titular deste cartão/);
});
test("subscription is created from the card purchase dialog", () => {
  const s = fixture();
  const html = renderToStaticMarkup(
    createElement(Forms, {
      state: s,
      month: "2026-11",
      dialog: { kind: "purchase", id: "c", mode: "subscription" },
      onClose: () => {},
      open: () => {},
      dispatch: async () => true,
    }),
  );
  assert.match(html, /Nova assinatura no cartão/);
  assert.match(html, /value="subscription" selected=""/);
  assert.match(html, /Cartão/);
  assert.match(html, /Data da primeira cobrança na fatura/);
  assert.match(html, /Não é um parcelamento/);
  assert.doesNotMatch(html, /Número de parcelas/);
});
test("card subscriptions are managed in Cards, not listed in Entries", () => {
  const s = fixture();
  s.rules.push({
    id: "netflix",
    kind: "expense",
    description: "Netflix",
    amount: 5590,
    categoryId: "leisure",
    cardId: "c",
    person: "a",
    splitA: 100,
    start: "2026-11-12",
    end: null,
  });
  const props = {
    state: s,
    month: "2026-11",
    open: () => {},
    dispatch: async () => true,
  };
  const cardsHtml = renderToStaticMarkup(createElement(Cards, props));
  const entriesHtml = renderToStaticMarkup(createElement(Entries, props));
  assert.match(cardsHtml, /Assinaturas mensais/);
  assert.match(cardsHtml, /Netflix/);
  assert.match(cardsHtml, /Editar futuras/);
  assert.doesNotMatch(entriesHtml, /Netflix/);
});
test("account creation is hidden unless the visitor has a household invitation", () => {
  const login = renderToStaticMarkup(
    createElement(Auth, { onDemo: () => {}, allowSignup: false }),
  );
  const invited = renderToStaticMarkup(
    createElement(Auth, { onDemo: () => {}, allowSignup: true }),
  );
  assert.doesNotMatch(login, /Criar uma conta pelo convite/);
  assert.match(invited, /Criar uma conta pelo convite/);
});
test("opened form revision rejects stale edit even after a background refresh", () => {
  assert.throws(() => assertRevision(3, 4), /atualiz/i);
  assert.doesNotThrow(() => assertRevision(4, 4));
});
test("materializing March generates skipped January and February recurring obligations", () => {
  let s = fixture();
  s = run(s, {
    type: "recurring",
    value: {
      id: "r",
      description: "Rent",
      kind: "expense",
      amount: 10000,
      categoryId: "housing",
      accountId: "a",
      person: "a",
      splitA: 50,
      start: "2026-01-31",
      end: null,
    },
  });
  s = run(s, { type: "materialize", month: "2026-03" });
  assert.deepEqual(
    s.entries.map((e) => e.date),
    ["2026-01-31", "2026-02-28", "2026-03-31"],
  );
  assert.equal(summarize(s, "2026-03").pending, 30000);
});
test("deleting a recurrence occurrence does not resurrect it on materialize", () => {
  let s = fixture();
  s = run(s, {
    type: "recurring",
    value: {
      id: "r",
      description: "Rent",
      kind: "expense",
      amount: 10000,
      categoryId: "housing",
      accountId: "a",
      person: "a",
      splitA: 50,
      start: "2026-11-01",
      end: null,
    },
  });
  s = run(s, { type: "materialize", month: "2026-11" });
  s = run(s, { type: "delete", entity: "entry", id: "r:2026-11" });
  s = run(s, { type: "materialize", month: "2026-11" });
  assert.equal(s.entries.length, 0);
});
test("future receipt remains pending in past monthly projection", () => {
  const s = fixture();
  s.entries.push({
    id: "income",
    kind: "income",
    description: "Salary",
    amount: 10000,
    date: "2026-11-10",
    categoryId: "salary",
    accountId: "a",
    person: "a",
    splitA: 100,
    paidDate: "2026-12-01",
  });
  assert.equal(summarize(s, "2026-11").received, 0);
  assert.equal(summarize(s, "2026-11").projected, 10000);
});
test("planned withdrawals cannot reserve the same savings twice", () => {
  let s = fixture();
  s.goals.push({
    id: "g",
    name: "Goal",
    initial: 10000,
    target: 20000,
    deadline: "2027-01-01",
    priority: 1,
    group: "reserve",
  });
  s = run(s, {
    type: "movement",
    value: {
      id: "w1",
      goalId: "g",
      amount: -7000,
      accountId: "a",
      date: "2026-11-10",
      planned: true,
    },
  });
  assert.throws(() =>
    run(s, {
      type: "movement",
      value: {
        id: "w2",
        goalId: "g",
        amount: -7000,
        accountId: "a",
        date: "2026-11-11",
        planned: true,
      },
    }),
  );
});
test("future goal contribution does not rewrite historical goal balance", () => {
  const s = fixture();
  s.goals.push({
    id: "g",
    name: "Goal",
    initial: 0,
    target: 30000,
    deadline: "2027-01-01",
    priority: 1,
    group: "reserve",
  });
  s.movements.push({
    id: "x",
    goalId: "g",
    amount: 10000,
    date: "2026-12-05",
    accountId: "a",
    planned: false,
  });
  assert.equal(goalPlans(s, "2026-11")[0].saved, 0);
});
test("cross invoice refund cannot silently cancel an earlier unpaid invoice", () => {
  let s = charge(fixture(), "jan", "2026-01");
  s = run(s, {
    type: "refund",
    id: "refund",
    entryId: "jan-1",
    amount: 10000,
    date: "2026-02-12",
  });
  assert.equal(invoice(s, "c", "2026-01").open, 10000);
  assert.equal(summarize(s, "2026-02").pending, 10000);
});
test("paying refunded old invoice still allocates cash and funds a later credited purchase", () => {
  let s = charge(fixture(), "jan", "2026-01");
  s = charge(s, "feb", "2026-02", 10000, 0);
  s = run(s, {
    type: "refund",
    id: "refund",
    entryId: "jan-1",
    amount: 10000,
    date: "2026-02-12",
  });
  s = pay(s, "payment", "2026-01");
  assert.equal(
    s.payments[0].allocations.reduce((n, a) => n + a.amount, 0),
    10000,
  );
  assert.equal(invoice(s, "c", "2026-02").open, 0);
  assert.equal(settlement(s), 10000);
});
test("credit carries once through multiple invoices without an unrelated overdue invoice consuming it", () => {
  let s = charge(fixture(), "old", "2026-01", 10000);
  s = charge(s, "feb", "2026-02", 10000);
  s = pay(s, "paid-feb", "2026-02");
  s = run(s, {
    type: "refund",
    id: "r",
    entryId: "feb-1",
    amount: 10000,
    date: "2026-02-12",
  });
  s = charge(s, "mar", "2026-03", 4000);
  s = charge(s, "apr", "2026-04", 7000);
  assert.equal(invoice(s, "c", "2026-03").open, 0);
  assert.equal(invoice(s, "c", "2026-03").credit, 6000);
  assert.equal(invoice(s, "c", "2026-04").open, 1000);
  assert.equal(summarize(s, "2026-04").pending, 11000);
});
test("import rollback rejects a reconciled batch and leaves unrelated entries intact", () => {
  let s = fixture();
  const e = {
    id: "imported",
    kind: "expense" as const,
    description: "Test",
    amount: 1000,
    date: "2026-11-10",
    categoryId: "housing",
    accountId: "a",
    person: "a" as const,
    splitA: 50,
    paidDate: null,
  };
  s = run(s, {
    type: "import",
    id: "batch",
    hash: "hash",
    description: "file.csv",
    entries: [e],
  });
  s = run(s, { type: "payEntry", id: e.id, date: "2026-11-10" });
  assert.throws(() => run(s, { type: "undoImport", id: "batch" }));
});

test("editing future recurrence preserves unvisited previous months", () => {
  let s = fixture();
  s = run(s, {
    type: "recurring",
    value: {
      id: "r",
      description: "Rent",
      kind: "expense",
      amount: 10000,
      categoryId: "housing",
      accountId: "a",
      person: "a",
      splitA: 50,
      start: "2026-01-10",
      end: null,
    },
  });
  s = run(s, {
    type: "recurring",
    value: { ...s.rules[0], amount: 20000, start: "2026-03-10" },
  });
  s = run(s, { type: "materialize", month: "2026-03" });
  assert.deepEqual(
    s.entries.map((e) => [e.date, e.amount]),
    [
      ["2026-01-10", 10000],
      ["2026-02-10", 10000],
      ["2026-03-10", 20000],
    ],
  );
});

test("partially paid same invoice refund releases only already funded excess", () => {
  let s = charge(fixture(), "one", "2026-01", 10000);
  s = pay(s, "first", "2026-01", 6000);
  s = run(s, {
    type: "refund",
    id: "r",
    entryId: "one-1",
    amount: 8000,
    date: "2026-01-12",
  });
  assert.equal(invoice(s, "c", "2026-01").credit, 4000);
  assert.equal(settlement(s), 1000);
  s = charge(s, "two", "2026-02", 6000, 0);
  assert.equal(invoice(s, "c", "2026-02").open, 2000);
  assert.equal(settlement(s), 5000);
  s = pay(s, "second", "2026-02", 2000);
  assert.equal(settlement(s), 7000);
});
