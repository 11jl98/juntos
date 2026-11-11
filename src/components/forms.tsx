"use client";
import { useState, type FormEvent } from "react";
import { Field, Modal, Button, type FinanceProps, type Dialog } from "./ui";
import type { Command, Person } from "@/domain/types";
import { DEFAULT_BUDGET } from "@/domain/types";
import {
  money,
  today,
  firstInvoice,
  brl,
  addMonths,
  allocate,
} from "@/domain/money";
import { splitProportional, invoice, primaryAccount } from "@/domain/finance";
const titles: Record<string, string> = {
  entry: "Novo lançamento",
  account: "Conta bancária",
  category: "Categoria",
  card: "Cartão de crédito",
  goal: "Uma nova conquista",
  movement: "Movimentar uma meta",
  purchase: "Compra no cartão",
  payInvoice: "Registrar pagamento da fatura",
  refund: "Estornar uma parcela",
  budget: "Planejamento do mês",
  transfer: "Transferência ou acerto",
  recurring: "Receita, conta ou assinatura recorrente",
};
export function Forms({
  dialog,
  onClose,
  state: s,
  month,
  dispatch,
}: FinanceProps & { dialog: Dialog; onClose: () => void }) {
  const { kind, id } = dialog;
  const entry = s.entries.find((e) => e.id === id),
    account = s.accounts.find((a) => a.id === id),
    category = s.categories.find((c) => c.id === id),
    card = s.cards.find((c) => c.id === id),
    goal = s.goals.find((g) => g.id === id),
    rule = s.rules.find((r) => r.id === id);
  const budget = s.budgets[month] ?? DEFAULT_BUDGET;
  const nominalStart = rule
    ? today().slice(0, 7) + "-" + rule.start.slice(8)
    : today();
  const ruleStart = rule
    ? rule.start > today()
      ? rule.start
      : addMonths(nominalStart, addMonths(nominalStart, 0) < today() ? 1 : 0)
    : today();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [budgetSplitMode, setBudgetSplitMode] = useState(budget.splitMode),
    [entryKind, setEntryKind] = useState<"income" | "expense">(
      entry?.kind ?? rule?.kind ?? "expense",
    ),
    [entryStatus, setEntryStatus] = useState(
      entry?.paidDate ? "paid" : "pending",
    ),
    [split, setSplit] = useState(
      kind === "purchase" || (kind === "recurring" && !!rule?.cardId)
        ? "individual"
        : (entry ?? rule)
          ? (entry ?? rule)!.splitA === 0 || (entry ?? rule)!.splitA === 100
            ? "individual"
            : (entry ?? rule)!.splitA === 50
              ? "equal"
              : "custom"
          : budget.splitMode === "income"
            ? "proportional"
            : "configured",
    ),
    [purchaseCard, setPurchaseCard] = useState(
      card?.id ?? s.cards[0]?.id ?? "",
    ),
    [purchaseMode, setPurchaseMode] = useState<"purchase" | "subscription">(
      dialog.mode === "subscription" ? "subscription" : "purchase",
    ),
    [purchaseDate, setPurchaseDate] = useState(today());
  const field = (
    label: string,
    name: string,
    value: string | number = "",
    type = "text",
    required = true,
  ) => (
    <Field label={label}>
      <input
        key={name === "firstDue" ? purchaseCard + purchaseDate : name}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        step={type === "number" ? "any" : undefined}
      />
    </Field>
  );
  const people = (
    value: Person = "a",
    name = "person",
    label = "Quem paga / recebe",
  ) => (
    <Field label={label}>
      <select name={name} defaultValue={value}>
        <option value="a">{s.names[0]}</option>
        <option value="b">{s.names[1]}</option>
      </select>
    </Field>
  );
  const accounts = (
    name = "accountId",
    value = account?.id ??
      entry?.accountId ??
      rule?.accountId ??
      s.accounts[0]?.id,
    label?: string,
  ) => (
    <Field
      label={
        label ??
        (name === "from"
          ? "Conta de origem"
          : name === "to"
            ? "Conta de destino"
            : "Conta")
      }
    >
      <select name={name} defaultValue={value} required>
        {s.accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} · {s.names[a.owner === "a" ? 0 : 1]}
          </option>
        ))}
      </select>
    </Field>
  );
  const categories = () => (
    <Field label="Categoria">
      <select
        name="categoryId"
        defaultValue={entry?.categoryId ?? rule?.categoryId ?? "housing"}
      >
        {s.categories
          .filter((c) => !c.archived || c.id === entry?.categoryId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>
    </Field>
  );
  const division = () => (
    <>
      <Field label="Divisão da despesa">
        <select value={split} onChange={(e) => setSplit(e.target.value)}>
          <option value="equal">Meio a meio</option>
          <option value="proportional">Proporcional à renda do mês</option>
          <option value="configured">Padrão definido no planejamento</option>
          <option value="custom">Percentual personalizado</option>
          <option value="individual">Individual (quem paga)</option>
        </select>
      </Field>
      {split === "custom" &&
        field(
          `Parte de ${s.names[0]} (%)`,
          "splitA",
          entry?.splitA ?? rule?.splitA ?? 50,
          "number",
        )}
      <p className="form-note">
        A divisão fica registrada nesta despesa. Alterar a renda depois não muda
        o histórico.
      </p>
    </>
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const f = new FormData(e.currentTarget);
      const v = (name: string) => String(f.get(name) ?? "");
      const n = (name: string) => Number(v(name));
      const m = (name: string) => money(v(name));
      const uid = id ?? crypto.randomUUID();
      const person = (
        (kind === "entry" || kind === "recurring") && entryKind === "expense"
          ? kind === "recurring" && rule?.cardId
            ? (s.cards.find((c) => c.id === rule.cardId)?.owner ??
              rule.person ??
              "a")
            : split === "individual"
              ? v("responsible") || entry?.person || rule?.person || "a"
              : (entry?.person ?? rule?.person ?? "a")
          : kind === "purchase"
            ? s.cards.find((c) => c.id === purchaseCard)?.owner
            : v("person")
      ) as Person;
      const splitA = () =>
        v("kind") === "income"
          ? 50
          : split === "equal"
            ? 50
            : split === "proportional"
              ? splitProportional(s, month)
              : split === "configured"
                ? budget.splitA
                : split === "individual"
                  ? person === "a"
                    ? 100
                    : 0
                  : n("splitA");
      const expenseSplitA =
        (kind === "entry" || (kind === "recurring" && !rule?.cardId)) &&
        entryKind === "expense"
          ? splitA()
          : undefined;
      const expenseShares =
        expenseSplitA === undefined
          ? []
          : allocate(m("amount"), [expenseSplitA, 100 - expenseSplitA]);
      const expenseAccounts = expenseShares.flatMap((share, index) => {
        if (!share) return [];
        const owner = index === 0 ? "a" : "b";
        const target = primaryAccount(s, owner);
        if (!target)
          throw new Error(
            `Defina a conta principal de ${s.names[owner === "a" ? 0 : 1]} em Nosso espaço.`,
          );
        return [target];
      });
      let c: Command;
      switch (kind) {
        case "entry":
          c = {
            type: "entry",
            value: {
              id: uid,
              kind: v("kind") as "income" | "expense",
              description: v("description"),
              amount: m("amount"),
              date: v("date"),
              categoryId: v("categoryId"),
              accountId:
                entryKind === "income"
                  ? v("accountId") || undefined
                  : expenseAccounts[0]?.id,
              person,
              splitA: expenseSplitA ?? splitA(),
              paidDate: v("status") === "paid" ? v("paidDate") : null,
            },
          };
          break;
        case "account":
          c = {
            type: "account",
            value: {
              id: uid,
              name: v("name"),
              owner: person,
              opening: m("opening"),
              openingDate: v("openingDate"),
              primary: f.has("primary"),
            },
          };
          break;
        case "category":
          c = {
            type: "category",
            value: {
              id: uid,
              name: v("name"),
              group: v("group") as "essential" | "fun",
              housing: f.has("housing"),
              archived: f.has("archived"),
            },
          };
          break;
        case "card":
          c = {
            type: "card",
            value: {
              id: uid,
              name: v("name"),
              owner: person,
              limit: m("limit"),
              closing: n("closing"),
              due: n("due"),
              color: v("color") as "purple" | "blue" | "green",
            },
          };
          break;
        case "goal":
          c = {
            type: "goal",
            value: {
              id: uid,
              name: v("name"),
              target: m("target"),
              initial: m("initial"),
              deadline: v("deadline"),
              group: v("group") as "reserve" | "invest",
              priority: n("priority"),
            },
          };
          break;
        case "movement":
          c = {
            type: "movement",
            value: {
              id: crypto.randomUUID(),
              goalId: id!,
              amount: m("amount") * (v("direction") === "out" ? -1 : 1),
              date: v("date"),
              accountId: v("accountId"),
              planned: v("status") === "planned",
            },
          };
          break;
        case "purchase":
          c =
            purchaseMode === "subscription"
              ? {
                  type: "recurring",
                  value: {
                    id: crypto.randomUUID(),
                    kind: "expense",
                    description: v("description"),
                    amount: m("amount"),
                    categoryId: v("categoryId"),
                    cardId: purchaseCard,
                    person,
                    splitA: splitA(),
                    start: v("firstDue"),
                    end: null,
                  },
                }
              : {
                  type: "purchase",
                  id: crypto.randomUUID(),
                  description: v("description"),
                  amount: m("amount"),
                  date: purchaseDate,
                  firstDue: v("firstDue"),
                  count: n("count"),
                  cardId: purchaseCard,
                  categoryId: v("categoryId"),
                  person,
                  splitA: splitA(),
                };
          break;
        case "payInvoice":
          c = {
            type: "payInvoice",
            id: crypto.randomUUID(),
            cardId: id!,
            month,
            amount: m("amount"),
            date: v("date"),
            accountId: v("accountId"),
            person,
          };
          break;
        case "refund":
          c = {
            type: "refund",
            id: crypto.randomUUID(),
            entryId: id!,
            amount: m("amount"),
            date: v("date"),
          };
          break;
        case "budget":
          c = {
            type: "budget",
            month,
            percentages: [n("p0"), n("p1"), n("p2"), n("p3")],
            margin: m("margin"),
            splitMode: v("splitMode") as "income" | "fixed",
            splitA: v("splitA") ? n("splitA") : budget.splitA,
          };
          break;
        case "transfer":
          c = {
            type: "transfer",
            id: crypto.randomUUID(),
            from: v("from"),
            to: v("to"),
            amount: m("amount"),
            date: v("date"),
            settle: f.has("settle"),
          };
          break;
        case "recurring":
          c = {
            type: "recurring",
            value: {
              id: uid,
              kind: v("kind") as "income" | "expense",
              description: v("description"),
              amount: m("amount"),
              categoryId: v("categoryId"),
              accountId:
                entryKind === "income"
                  ? v("accountId") || undefined
                  : rule?.cardId
                    ? undefined
                    : expenseAccounts[0]?.id,
              cardId: rule?.cardId,
              person,
              splitA: entryKind === "expense" ? splitA() : 50,
              start: v("start"),
              end: v("end") || null,
            },
          };
          break;
        default:
          throw new Error("Formulário desconhecido.");
      }
      if (await dispatch(c, dialog.revision)) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise os campos.");
    } finally {
      setBusy(false);
    }
  }
  const chosen = s.cards.find((c) => c.id === purchaseCard);
  return (
    <Modal
      title={
        kind === "purchase" && purchaseMode === "subscription"
          ? "Nova assinatura no cartão"
          : (titles[kind] ?? "Editar")
      }
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <fieldset disabled={busy} className="form-grid">
          {(kind === "entry" || kind === "recurring") && (
            <>
              <Field label="Tipo">
                <select
                  name="kind"
                  value={entryKind}
                  onChange={(e) =>
                    setEntryKind(e.target.value as "income" | "expense")
                  }
                >
                  <option value="expense">Despesa</option>
                  <option value="income">Receita</option>
                </select>
              </Field>
              {field(
                "Descrição",
                "description",
                entry?.description ?? rule?.description ?? "",
              )}
              {field(
                "Valor (R$)",
                "amount",
                (entry?.amount ?? rule?.amount ?? 0) / 100,
              )}
              {kind === "entry" ? (
                <>
                  {field(
                    entryKind === "income"
                      ? "Data prevista para receber"
                      : "Vencimento / competência",
                    "date",
                    entry?.date ?? today(),
                    "date",
                  )}
                  <Field label="Situação">
                    <select
                      name="status"
                      value={entryStatus}
                      onChange={(e) => setEntryStatus(e.target.value)}
                    >
                      <option value="pending">
                        {entryKind === "income" ? "Prevista" : "Pendente"}
                      </option>
                      <option value="paid">
                        {entryKind === "income" ? "Recebida" : "Paga"}
                      </option>
                    </select>
                  </Field>
                  {(entryKind === "expense" || entryStatus === "paid") &&
                    field(
                      entryKind === "income"
                        ? "Data do recebimento"
                        : "Data do pagamento",
                      "paidDate",
                      entry?.paidDate ?? today(),
                      "date",
                    )}
                </>
              ) : (
                <>
                  {field(
                    kind === "recurring" && rule?.cardId
                      ? "Data da primeira cobrança na fatura"
                      : "Início / mudança válida a partir de",
                    "start",
                    ruleStart,
                    "date",
                  )}
                  {field(
                    "Última ocorrência (opcional)",
                    "end",
                    rule?.end ?? "",
                    "date",
                    false,
                  )}
                </>
              )}
              {kind === "recurring" &&
                entryKind === "expense" &&
                rule?.cardId && (
                  <p className="form-note">
                    Assinatura vinculada ao cartão{" "}
                    {s.cards.find((c) => c.id === rule.cardId)?.name}. Novas
                    assinaturas são cadastradas em Cartões → Compra.
                  </p>
                )}
              {entryKind === "income" ? (
                <Field label="Conta (opcional)">
                  <select
                    name="accountId"
                    defaultValue={entry?.accountId ?? rule?.accountId ?? ""}
                  >
                    <option value="">Sem conta vinculada</option>
                    {s.accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {s.names[a.owner === "a" ? 0 : 1]}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : kind === "recurring" && rule?.cardId ? (
                <p className="form-note">
                  Uma cobrança será adicionada à fatura selecionada a cada mês.
                  Não é um parcelamento.
                </p>
              ) : (
                <p className="form-note">
                  As cotas serão debitadas automaticamente das contas principais
                  dos responsáveis. A conta não precisa ser selecionada.
                </p>
              )}
              {categories()}
              {entryKind === "income" ? (
                people(entry?.person ?? rule?.person, "person", "Quem recebe")
              ) : kind === "recurring" && rule?.cardId ? (
                <p className="form-note">
                  A divisão atual da assinatura será preservada para futuras
                  cobranças.
                </p>
              ) : split === "individual" ? (
                people(
                  entry?.person ?? rule?.person ?? "a",
                  "responsible",
                  "Responsável",
                )
              ) : (
                <p className="form-note">
                  Cada parcela será debitada da conta principal de quem é
                  responsável por ela.
                </p>
              )}
              {entryKind === "expense" && division()}
            </>
          )}
          {kind === "account" && (
            <>
              {field("Nome da conta", "name", account?.name ?? "")}
              {people(account?.owner, "person", "Titular")}
              {field(
                "Saldo inicial (R$)",
                "opening",
                (account?.opening ?? 0) / 100,
              )}
              {field(
                "Data desse saldo (inclui movimentações até este dia)",
                "openingDate",
                account?.openingDate ?? today(),
                "date",
              )}
              <label className="check">
                <input
                  type="checkbox"
                  name="primary"
                  defaultChecked={account?.primary}
                />
                Conta principal para débitos automáticos
              </label>
              <p className="form-note">
                Informe o saldo já existente nesta data. Receitas, despesas e
                pagamentos até este dia ficam nos relatórios, mas não alteram o
                saldo novamente.
              </p>
            </>
          )}
          {kind === "category" && (
            <>
              {field("Nome", "name", category?.name ?? "")}
              <Field label="Grupo">
                <select
                  name="group"
                  defaultValue={category?.group ?? "essential"}
                >
                  <option value="essential">Contas essenciais</option>
                  <option value="fun">Diversão</option>
                </select>
              </Field>
              <label className="check">
                <input
                  type="checkbox"
                  name="housing"
                  defaultChecked={category?.housing}
                />
                Faz parte do custo de moradia
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="archived"
                  defaultChecked={category?.archived}
                />
                Arquivada (mantém o histórico)
              </label>
            </>
          )}
          {kind === "card" && (
            <>
              {field("Nome do cartão", "name", card?.name ?? "")}
              {people(card?.owner, "person", "Titular")}
              {field(
                "Limite informado (R$)",
                "limit",
                (card?.limit ?? 0) / 100,
              )}
              {field(
                "Dia do fechamento",
                "closing",
                card?.closing ?? 5,
                "number",
              )}
              {field("Dia do vencimento", "due", card?.due ?? 12, "number")}
              <Field label="Cor">
                <select name="color" defaultValue={card?.color ?? "purple"}>
                  <option value="purple">Violeta</option>
                  <option value="blue">Azul</option>
                  <option value="green">Verde</option>
                </select>
              </Field>
              <p className="form-note">
                Não cadastramos número do cartão, CVV ou senhas.
              </p>
            </>
          )}
          {kind === "goal" && (
            <>
              {field("Nome da conquista", "name", goal?.name ?? "")}
              {field(
                "Quanto querem juntar (R$)",
                "target",
                (goal?.target ?? 0) / 100,
              )}
              {field(
                "Já guardado antes deste controle (R$)",
                "initial",
                (goal?.initial ?? 0) / 100,
              )}
              {field("Prazo", "deadline", goal?.deadline ?? today(), "date")}
              <Field label="Destinação">
                <select name="group" defaultValue={goal?.group ?? "reserve"}>
                  <option value="reserve">Reserva / objetivo</option>
                  <option value="invest">Investimentos</option>
                </select>
              </Field>
              {field(
                "Prioridade (1 = mais importante)",
                "priority",
                goal?.priority ?? 1,
                "number",
              )}
              <p className="form-note">
                O saldo inicial já deve estar separado da conta de uso diário.
                Projeções sem rendimentos presumidos.
              </p>
            </>
          )}
          {kind === "movement" && (
            <>
              <p className="form-note">
                {goal?.name} · Aportes transferem dinheiro para a meta, sem
                virar despesa de consumo.
              </p>
              <Field label="Movimentação">
                <select name="direction">
                  <option value="in">Guardar / aportar</option>
                  <option value="out">Retirar para a conta</option>
                </select>
              </Field>
              {field("Valor (R$)", "amount", "")}
              {accounts()}
              {field("Data", "date", today(), "date")}
              <Field label="Situação">
                <select name="status">
                  <option value="done">Já realizado</option>
                  <option value="planned">Apenas planejado</option>
                </select>
              </Field>
            </>
          )}
          {kind === "purchase" && (
            <>
              <Field label="Cartão">
                <select
                  value={purchaseCard}
                  onChange={(e) => setPurchaseCard(e.target.value)}
                  required
                >
                  {s.cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {s.names[c.owner === "a" ? 0 : 1]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de cobrança">
                <select
                  value={purchaseMode}
                  onChange={(e) =>
                    setPurchaseMode(
                      e.target.value as "purchase" | "subscription",
                    )
                  }
                >
                  <option value="purchase">Compra ou parcelamento</option>
                  <option value="subscription">Assinatura mensal</option>
                </select>
              </Field>
              {field("Descrição", "description", "")}
              {field(
                purchaseMode === "subscription"
                  ? "Valor mensal (R$)"
                  : "Valor total da compra (R$)",
                "amount",
                "",
              )}
              {purchaseMode === "purchase" && (
                <>
                  {field("Número de parcelas", "count", 1, "number")}
                  <Field label="Data da compra">
                    <input
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      required
                    />
                  </Field>
                </>
              )}
              {field(
                purchaseMode === "subscription"
                  ? "Data da primeira cobrança na fatura"
                  : "Vencimento da primeira parcela",
                "firstDue",
                chosen
                  ? firstInvoice(purchaseDate, chosen.closing, chosen.due)
                  : today(),
                "date",
              )}
              {categories()}
              <p className="form-note">
                A compra será atribuída a{" "}
                {s.names[chosen?.owner === "b" ? 1 : 0]}, titular deste cartão.
                O padrão é individual; ajuste a divisão se a compra for
                compartilhada.
              </p>
              {division()}
              {purchaseMode === "subscription" ? (
                <p className="form-note">
                  O valor será lançado uma vez por mês na fatura selecionada,
                  até a recorrência ser encerrada. Não é um parcelamento.
                </p>
              ) : (
                <p className="form-note">
                  Confira a primeira fatura com o banco. A última parcela
                  absorve os centavos restantes.
                </p>
              )}
            </>
          )}
          {kind === "payInvoice" && (
            <>
              <p className="form-note">
                {card?.name} · Fatura {month} · Em aberto:{" "}
                {brl(invoice(s, id!, month).open)}
              </p>
              {field(
                "Valor pago (R$)",
                "amount",
                invoice(s, id!, month).open / 100,
              )}
              {accounts()}
              {people(card?.owner)}
              {field("Data do pagamento", "date", today(), "date")}
              <p className="form-note">
                Permite pagamento parcial. Juros devem ser lançados
                separadamente como compra/encargo.
              </p>
            </>
          )}
          {kind === "refund" && (
            <>
              <p className="form-note">
                {entry?.description} · Parcela {entry?.part}/{entry?.parts}
              </p>
              {field("Valor do estorno (R$)", "amount", "")}
              {field(
                "Vencimento da fatura que recebe o crédito",
                "date",
                entry?.date ?? today(),
                "date",
              )}
              <p className="form-note">
                O crédito reduz a fatura escolhida e ajusta o acerto da compra
                original.
              </p>
            </>
          )}
          {kind === "budget" && (
            <>
              <p className="form-note">
                Regras para {month}. Os quatro percentuais devem somar 100%. Os
                meses anteriores não mudam.
              </p>
              <Field label="Divisão padrão das despesas compartilhadas">
                <select
                  name="splitMode"
                  value={budgetSplitMode}
                  onChange={(e) =>
                    setBudgetSplitMode(e.target.value as "income" | "fixed")
                  }
                >
                  <option value="income">
                    Proporcional à renda de cada pessoa
                  </option>
                  <option value="fixed">Percentual fixo</option>
                </select>
              </Field>
              {budgetSplitMode === "fixed" ? (
                field(
                  `Parte de ${s.names[0]} nas despesas (%)`,
                  "splitA",
                  budget.splitA,
                  "number",
                )
              ) : (
                <p className="form-note">
                  O rateio usa as rendas previstas cadastradas para cada pessoa
                  neste mês.
                </p>
              )}
              {[
                "Contas essenciais",
                "Diversão",
                "Reserva",
                "Investimentos",
              ].map((label, i) => (
                <div key={label}>
                  {field(
                    `${label} (%)`,
                    "p" + i,
                    budget.percentages[i],
                    "number",
                  )}
                </div>
              ))}
              {field(
                "Margem mínima na conta (R$)",
                "margin",
                budget.margin / 100,
              )}
              <p className="form-note">
                O perfil 50/30/10/10 é apenas um ponto de partida. Ajustem à
                realidade de vocês.
              </p>
            </>
          )}
          {kind === "transfer" && (
            <>
              {accounts("from")}
              {accounts("to", s.accounts[1]?.id)}
              {field("Valor (R$)", "amount", "")}
              {field("Data", "date", today(), "date")}
              <label className="check">
                <input type="checkbox" name="settle" />
                Esta transferência é um acerto entre nós
              </label>
              <p className="form-note">
                Transfere entre duas contas cadastradas. Não altera as receitas
                nem as despesas do casal.
              </p>
            </>
          )}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button secondary onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
