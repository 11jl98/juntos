import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v,
    "Data inválida",
  );
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const id = z.string().min(1).max(100),
  text = z.string().trim().min(1).max(160),
  cents = z.number().int().min(0).max(1_000_000_000_000),
  positive = cents.positive();
const person = z.enum(["a", "b"]),
  ratio = z.number().min(0).max(100),
  group = z.enum(["essential", "fun"]);
export const accountSchema = z.object({
  id,
  name: text,
  owner: person,
  opening: z.number().int().min(-1e12).max(1e12),
  openingDate: dateSchema,
  primary: z.boolean().default(false),
});
export const categorySchema = z.object({
  id,
  name: text,
  group,
  housing: z.boolean(),
  archived: z.boolean().default(false),
});
export const entrySchema = z.object({
  id,
  kind: z.enum(["income", "expense"]),
  description: text,
  amount: positive,
  date: dateSchema,
  categoryId: id,
  accountId: id.optional(),
  accountDebits: z
    .array(z.object({ accountId: id, amount: positive }))
    .optional(),
  person,
  splitA: ratio,
  paidDate: dateSchema.nullable(),
  cardId: id.optional(),
  purchaseId: id.optional(),
  part: z.number().int().positive().optional(),
  parts: z.number().int().positive().optional(),
  recurringId: id.optional(),
  batchId: id.optional(),
});
export const cardSchema = z.object({
  id,
  name: text,
  owner: person,
  limit: cents,
  closing: z.number().int().min(1).max(31),
  due: z.number().int().min(1).max(31),
  color: z.enum(["purple", "blue", "green"]),
});
export const goalSchema = z.object({
  id,
  name: text,
  target: positive,
  initial: cents,
  deadline: dateSchema,
  group: z.enum(["reserve", "invest"]),
  priority: z.number().int().min(1).max(99),
});
export const ruleSchema = entrySchema
  .omit({
    paidDate: true,
    date: true,
    cardId: true,
    purchaseId: true,
    part: true,
    parts: true,
    recurringId: true,
    batchId: true,
  })
  .extend({
    cardId: id.optional(),
    start: dateSchema,
    end: dateSchema.nullable(),
  });
export const movementSchema = z.object({
  id,
  goalId: id,
  amount: z
    .number()
    .int()
    .min(-1e12)
    .max(1e12)
    .refine((v) => v !== 0),
  date: dateSchema,
  accountId: id,
  planned: z.boolean(),
});
export const budgetSchema = z.object({
  percentages: z
    .tuple([ratio, ratio, ratio, ratio])
    .refine(
      (a) => Math.abs(a.reduce((s, v) => s + v, 0) - 100) < 1e-7,
      "Os percentuais devem somar 100%",
    ),
  margin: cents,
  splitMode: z.enum(["income", "fixed"]).default("income"),
  splitA: ratio.default(50),
});
export const stateSchema = z.object({
  skippedOccurrences: z.array(z.string()).default([]),
  schemaVersion: z.literal(1),
  names: z.tuple([text, text]),
  accounts: z.array(accountSchema).max(100),
  categories: z.array(categorySchema).max(200),
  entries: z.array(entrySchema).max(30000),
  cards: z.array(cardSchema).max(50),
  goals: z.array(goalSchema).max(100),
  rules: z.array(ruleSchema).max(200),
  movements: z.array(movementSchema).max(10000),
  budgets: z.record(monthSchema, budgetSchema),
  payments: z.array(
    z.object({
      id,
      cardId: id,
      month: monthSchema,
      amount: positive,
      date: dateSchema,
      accountId: id,
      person,
      allocations: z.array(z.object({ entryId: id, amount: positive })),
    }),
  ),
  refunds: z.array(
    z.object({
      id,
      entryId: id,
      cardId: id,
      amount: positive,
      date: dateSchema,
    }),
  ),
  transfers: z.array(
    z.object({
      id,
      from: id,
      to: id,
      amount: positive,
      date: dateSchema,
      settle: z.boolean(),
    }),
  ),
  imports: z.array(
    z.object({ id, hash: id, date: dateSchema, description: text }),
  ),
  audit: z.array(
    z.object({ actor: z.string(), action: z.string(), at: z.string() }),
  ),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("account"), value: accountSchema }),
  z.object({ type: z.literal("category"), value: categorySchema }),
  z.object({ type: z.literal("card"), value: cardSchema }),
  z.object({ type: z.literal("goal"), value: goalSchema }),
  z.object({ type: z.literal("entry"), value: entrySchema }),
  z.object({
    type: z.literal("delete"),
    entity: z.enum(["entry", "account", "category", "card", "goal", "rule"]),
    id,
  }),
  z.object({ type: z.literal("names"), names: z.tuple([text, text]) }),
  z.object({
    type: z.literal("budget"),
    month: monthSchema,
    percentages: budgetSchema.shape.percentages,
    margin: cents,
    splitMode: z.enum(["income", "fixed"]).default("income"),
    splitA: ratio.default(50),
  }),
  z.object({ type: z.literal("payEntry"), id, date: dateSchema }),
  z.object({
    type: z.literal("purchase"),
    id,
    description: text,
    amount: positive,
    date: dateSchema,
    firstDue: dateSchema,
    count: z.number().int().min(1).max(120),
    cardId: id,
    categoryId: id,
    person,
    splitA: ratio,
  }),
  z.object({
    type: z.literal("payInvoice"),
    id,
    cardId: id,
    month: monthSchema,
    amount: positive,
    accountId: id,
    person,
    date: dateSchema,
  }),
  z.object({
    type: z.literal("refund"),
    id,
    entryId: id,
    amount: positive,
    date: dateSchema,
  }),
  z.object({ type: z.literal("movement"), value: movementSchema }),
  z.object({ type: z.literal("confirmMovement"), id }),
  z.object({
    type: z.literal("transfer"),
    id,
    from: id,
    to: id,
    amount: positive,
    date: dateSchema,
    settle: z.boolean(),
  }),
  z.object({ type: z.literal("recurring"), value: ruleSchema }),
  z.object({ type: z.literal("materialize"), month: monthSchema }),
  z.object({
    type: z.literal("import"),
    id,
    hash: id,
    description: text,
    entries: z.array(entrySchema).min(1).max(5000),
  }),
  z.object({ type: z.literal("undoImport"), id }),
]);
export type State = z.infer<typeof stateSchema>;
export type Command = z.infer<typeof commandSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Account = z.infer<typeof accountSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Card = z.infer<typeof cardSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Person = "a" | "b";
export const DEFAULT_BUDGET = {
  percentages: [50, 30, 10, 10] as [number, number, number, number],
  margin: 0,
  splitMode: "income" as const,
  splitA: 50,
};
export const GROUPS = [
  "Contas essenciais",
  "Diversão",
  "Reserva",
  "Investimentos",
];
