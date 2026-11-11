import { emptyState, applyCommand } from "./commands";
export function demoState(month: string) {
  let s = emptyState();
  s.names = ["Ana", "Lucas"];
  s.accounts = [
    {
      id: "a",
      name: "Conta Ana",
      owner: "a",
      opening: 120000,
      openingDate: month + "-01",
      primary: true,
    },
    {
      id: "b",
      name: "Conta Lucas",
      owner: "b",
      opening: 80000,
      openingDate: month + "-01",
      primary: true,
    },
  ];
  s.cards = [
    {
      id: "card-a",
      name: "Nubank",
      owner: "a",
      limit: 800000,
      closing: 5,
      due: 12,
      color: "purple",
    },
    {
      id: "card-b",
      name: "Cartão do casal",
      owner: "b",
      limit: 500000,
      closing: 12,
      due: 20,
      color: "blue",
    },
  ];
  const rows: [string, string, number, string, string, "a" | "b", boolean][] = [
    ["income", "Salário Ana", 540000, "05", "salary", "a", true],
    ["income", "Salário Lucas", 380000, "05", "salary", "b", true],
    ["expense", "Aluguel do nosso lar", 180000, "08", "housing", "a", true],
    ["expense", "Condomínio", 38000, "10", "housing", "b", true],
    ["expense", "Compras da semana", 42680, "09", "market", "a", true],
    ["expense", "Internet fibra", 11990, "15", "housing", "b", false],
    ["expense", "Energia elétrica", 18640, "18", "housing", "a", false],
    ["expense", "Jantar de sexta", 14800, "07", "leisure", "b", true],
    ["expense", "Gasolina", 22000, "11", "transport", "a", true],
    ["expense", "Plano de saúde", 32000, "22", "health", "b", false],
  ];
  rows.forEach(
    ([kind, description, amount, day, categoryId, person, paid], i) => {
      s = applyCommand(
        s,
        {
          type: "entry",
          value: {
            id: "demo-" + i,
            kind: kind as "income" | "expense",
            description,
            amount,
            date: month + "-" + day,
            categoryId,
            accountId: person,
            person,
            splitA: 50,
            paidDate: paid ? month + "-" + day : null,
          },
        },
        "demo",
        month + "-01",
      );
    },
  );
  s = applyCommand(
    s,
    {
      type: "purchase",
      id: "sofa",
      description: "Sofá para nossa casa",
      amount: 240000,
      date: month + "-01",
      firstDue: month + "-12",
      count: 6,
      cardId: "card-a",
      categoryId: "housing",
      person: "a",
      splitA: 50,
    },
    "demo",
    month + "-01",
  );
  const y = Number(month.slice(0, 4));
  s.goals = [
    {
      id: "reserve",
      name: "Nossa tranquilidade",
      target: 1800000,
      initial: 480000,
      deadline: `${y + 1}-12-01`,
      group: "reserve",
      priority: 1,
    },
    {
      id: "travel",
      name: "Uma viagem a dois",
      target: 800000,
      initial: 240000,
      deadline: `${y + 1}-07-01`,
      group: "reserve",
      priority: 2,
    },
    {
      id: "future",
      name: "Construir nosso futuro",
      target: 1200000,
      initial: 160000,
      deadline: `${y + 2}-12-01`,
      group: "invest",
      priority: 3,
    },
  ];
  s = applyCommand(
    s,
    {
      type: "movement",
      value: {
        id: "saved",
        goalId: "reserve",
        amount: 60000,
        date: month + "-06",
        accountId: "a",
        planned: false,
      },
    },
    "demo",
    month + "-01",
  );
  s = applyCommand(s, { type: "materialize", month }, "demo", month + "-01");
  return s;
}
