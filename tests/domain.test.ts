import test from "node:test";
import assert from "node:assert/strict";
import {
  allocate,
  money,
  installmentAmounts,
  firstInvoice,
  addMonths,
} from "../src/domain/money";
import { emptyState, applyCommand } from "../src/domain/commands";
import {
  summarize,
  goalPlans,
  accountBalance,
  settlement,
  splitProportional,
} from "../src/domain/finance";
import { parseCSV, exportCSV } from "../src/domain/csv";

function fixture() {
  let s = emptyState();
  s = applyCommand(
    s,
    {
      type: "account",
      value: {
        id: "a",
        name: "Conta Ana",
        owner: "a",
        opening: 0,
        openingDate: "2026-01-01",
      },
    },
    "ana",
    "2026-11-01",
  );
  return s;
}
test("money parses Brazilian decimals without floating rounding errors", () => {
  assert.equal(money("1.234,56"), 123456);
  assert.equal(money("0,29"), 29);
  assert.throws(() => money("NaN"));
  assert.throws(() => money("1,999"));
});
test("allocation preserves every cent deterministically", () => {
  assert.deepEqual(allocate(101, [50, 50]), [51, 50]);
  assert.deepEqual(
    allocate(800000, [50, 30, 10, 10]),
    [400000, 240000, 80000, 80000],
  );
  assert.throws(() => allocate(-1, [1]));
});
test("installments sum exactly with residue in last", () =>
  assert.deepEqual(installmentAmounts(10000, 3), [3333, 3333, 3334]));
test("closing day goes to next invoice, leap month clamps", () => {
  assert.equal(firstInvoice("2026-11-10", 10, 17), "2026-12-17");
  assert.equal(firstInvoice("2026-11-09", 10, 5), "2026-12-05");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
});
test("opening balance is cash, never income", () => {
  let s = fixture();
  s.accounts[0].opening = 100000;
  assert.equal(summarize(s, "2026-11").income, 0);
  assert.equal(summarize(s, "2026-11").cash, 100000);
  assert.equal(summarize(s, "2026-11").capacity, 0);
});
test("received income without an account contributes to household cash", () => {
  const s = applyCommand(
    emptyState(),
    {
      type: "entry",
      value: {
        id: "salary",
        kind: "income",
        description: "Salário",
        amount: 500000,
        date: "2026-11-05",
        categoryId: "salary",
        person: "a",
        splitA: 50,
        paidDate: "2026-11-05",
      },
    },
    "ana",
    "2026-11-05",
  );
  assert.equal(summarize(s, "2026-11").income, 500000);
  assert.equal(summarize(s, "2026-11").received, 500000);
  assert.equal(summarize(s, "2026-11").cash, 500000);
});
test("account snapshots do not double count earlier income and expenses", () => {
  const s = fixture();
  s.accounts[0].opening = 475700;
  s.accounts[0].openingDate = "2026-11-10";
  s.accounts.push({
    id: "b",
    name: "Conta B",
    owner: "b",
    opening: 420000,
    openingDate: "2026-11-10",
  });
  s.entries.push(
    {
      id: "salary-a",
      kind: "income",
      description: "Salário A",
      amount: 475700,
      date: "2026-11-05",
      categoryId: "salary",
      accountId: "a",
      person: "a",
      splitA: 50,
      paidDate: "2026-11-10",
    },
    {
      id: "salary-b",
      kind: "income",
      description: "Salário B",
      amount: 420000,
      date: "2026-11-05",
      categoryId: "salary",
      person: "b",
      splitA: 50,
      paidDate: "2026-11-10",
    },
    {
      id: "rent",
      kind: "expense",
      description: "Aluguel já refletido no saldo",
      amount: 125000,
      date: "2026-11-08",
      categoryId: "housing",
      accountId: "a",
      person: "a",
      splitA: 53.11,
      paidDate: "2026-11-10",
    },
  );
  const summary = summarize(s, "2026-11");
  assert.equal(summary.income, 895700);
  assert.equal(summary.expense, 125000);
  assert.equal(summary.cash, 895700);
  assert.equal(summary.projected, 895700);
});
test("expense split follows the household members' monthly income", () => {
  const s = fixture();
  s.entries.push(
    {
      id: "salary-a",
      kind: "income",
      description: "Salário A",
      amount: 700000,
      date: "2026-11-05",
      categoryId: "salary",
      accountId: "a",
      person: "a",
      splitA: 50,
      paidDate: null,
    },
    {
      id: "salary-b",
      kind: "income",
      description: "Salário B",
      amount: 300000,
      date: "2026-11-05",
      categoryId: "salary",
      accountId: "a",
      person: "b",
      splitA: 50,
      paidDate: null,
    },
  );
  assert.equal(splitProportional(s, "2026-11"), 70);
});
test("cash payment cannot double count expense or pay twice", () => {
  let s = fixture();
  s = applyCommand(
    s,
    {
      type: "entry",
      value: {
        id: "rent",
        kind: "expense",
        description: "Aluguel",
        amount: 120000,
        date: "2026-11-10",
        categoryId: "housing",
        accountId: "a",
        person: "a",
        splitA: 50,
        paidDate: null,
      },
    },
    "ana",
    "2026-11-01",
  );
  s = applyCommand(
    s,
    { type: "payEntry", id: "rent", date: "2026-11-10" },
    "ana",
    "2026-11-10",
  );
  assert.equal(summarize(s, "2026-11").expense, 120000);
  assert.equal(accountBalance(s, "a"), -120000);
  assert.equal(settlement(s), 60000);
  assert.throws(() =>
    applyCommand(
      s,
      { type: "payEntry", id: "rent", date: "2026-11-10" },
      "ana",
      "2026-11-10",
    ),
  );
});
test("card installments and partial payments count only consumption once", () => {
  let s = fixture();
  s = applyCommand(
    s,
    {
      type: "card",
      value: {
        id: "c",
        name: "Cartão",
        owner: "a",
        limit: 500000,
        closing: 10,
        due: 17,
        color: "purple",
      },
    },
    "ana",
    "2026-11-01",
  );
  s = applyCommand(
    s,
    {
      type: "purchase",
      id: "p",
      description: "Sofá",
      amount: 30000,
      date: "2026-11-01",
      firstDue: "2026-11-17",
      count: 3,
      cardId: "c",
      categoryId: "housing",
      person: "a",
      splitA: 50,
    },
    "ana",
    "2026-11-01",
  );
  s = applyCommand(
    s,
    {
      type: "payInvoice",
      id: "pay",
      cardId: "c",
      month: "2026-11",
      amount: 6000,
      accountId: "a",
      person: "a",
      date: "2026-11-17",
    },
    "ana",
    "2026-11-17",
  );
  assert.equal(summarize(s, "2026-11").expense, 10000);
  assert.equal(accountBalance(s, "a"), -6000);
  assert.equal(settlement(s), 3000);
  assert.equal(summarize(s, "2026-12").expense, 10000);
  assert.throws(() =>
    applyCommand(
      s,
      {
        type: "payInvoice",
        id: "over",
        cardId: "c",
        month: "2026-11",
        amount: 5000,
        accountId: "a",
        person: "a",
        date: "2026-11-17",
      },
      "ana",
      "2026-11-17",
    ),
  );
});
test("goals use inclusive months and never propose money from negative cash", () => {
  let s = fixture();
  s.goals.push({
    id: "g",
    name: "Reserva",
    target: 30000,
    initial: 0,
    deadline: "2027-01-01",
    group: "reserve",
    priority: 1,
  });
  const p = goalPlans(s, "2026-11")[0];
  assert.equal(p.needed, 10000);
  assert.equal(p.suggested, 0);
  assert.equal(p.shortfall, 10000);
  assert.equal(goalPlans(s, "2027-02")[0].overdue, true);
});
test("budget sum must be 100 and revisions are monthly", () => {
  let s = fixture();
  assert.throws(() =>
    applyCommand(
      s,
      {
        type: "budget",
        month: "2026-11",
        percentages: [50, 30, 10, 20],
        margin: 0,
        splitMode: "income",
        splitA: 50,
      },
      "ana",
      "2026-11-01",
    ),
  );
  s = applyCommand(
    s,
    {
      type: "budget",
      month: "2026-11",
      percentages: [60, 20, 10, 10],
      margin: 0,
      splitMode: "fixed",
      splitA: 70,
    },
    "ana",
    "2026-11-01",
  );
  assert.deepEqual(s.budgets["2026-11"].percentages, [60, 20, 10, 10]);
  assert.equal(s.budgets["2026-11"].splitMode, "fixed");
  assert.equal(s.budgets["2026-11"].splitA, 70);
  assert.equal(s.budgets["2026-10"], undefined);
});
test("recurrence is idempotent and preserves original day across February", () => {
  let s = fixture();
  s = applyCommand(
    s,
    {
      type: "recurring",
      value: {
        id: "r",
        kind: "expense",
        description: "Internet",
        amount: 10000,
        categoryId: "housing",
        accountId: "a",
        person: "a",
        splitA: 50,
        start: "2026-01-31",
        end: null,
      },
    },
    "ana",
    "2026-01-01",
  );
  s = applyCommand(
    s,
    { type: "materialize", month: "2026-02" },
    "ana",
    "2026-02-01",
  );
  s = applyCommand(
    s,
    { type: "materialize", month: "2026-02" },
    "ana",
    "2026-02-01",
  );
  assert.equal(s.entries.filter((e) => e.date === "2026-02-28").length, 1);
  s = applyCommand(
    s,
    { type: "materialize", month: "2026-03" },
    "ana",
    "2026-03-01",
  );
  assert.equal(s.entries.filter((e) => e.date === "2026-03-31").length, 1);
});
test("rejects missing account references and invalid dates", () => {
  const s = fixture();
  assert.throws(() =>
    applyCommand(
      s,
      {
        type: "entry",
        value: {
          id: "x",
          kind: "income",
          description: "Salário",
          amount: 10000,
          date: "2026-02-30",
          categoryId: "salary",
          accountId: "missing",
          person: "a",
          splitA: 100,
          paidDate: null,
        },
      },
      "ana",
      "2026-01-01",
    ),
  );
});
test("CSV handles quoted text and export neutralizes formulas", () => {
  const rows = parseCSV(
    'tipo;descricao;valor;data\ndespesa;"Mercado; feira";"12,50";2026-11-10',
  );
  assert.equal(rows[0].descricao, "Mercado; feira");
  assert.equal(rows[0].valor, "12,50");
  assert.match(exportCSV([{ descricao: "=SUM(A1)", valor: "10" }]), /'=SUM/);
  assert.throws(() => parseCSV('a;b\n"unterminated'));
});
