"use client";
import { useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Check,
  Repeat2,
  ArrowLeftRight,
} from "lucide-react";
import { allocate, brl, dateLabel, today } from "@/domain/money";
import { exportCSV } from "@/domain/csv";
import { Button, Section, Empty, Download, type FinanceProps } from "./ui";
export function Entries({
  state: s,
  month,
  open,
  dispatch,
  person = "all",
  onPersonChange,
}: FinanceProps) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
  const accountRules = s.rules.filter((rule) => !rule.cardId);
  const rows = s.entries
    .filter(
      (e) =>
        e.date.startsWith(month) &&
        (person === "all" || e.person === person) &&
        e.description.toLowerCase().includes(search.toLowerCase()) &&
        (status === "all" || (status === "paid" ? !!e.paidDate : !e.paidDate)),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">CADA REAL CONTA</span>
          <h1>Lançamentos</h1>
          <p>O que entra, o que sai e como vocês dividem.</p>
        </div>
        <Button onClick={() => open({ kind: "entry" })}>
          <Plus size={17} />
          Novo lançamento
        </Button>
      </div>
      <Section
        title="Movimentações do mês"
        action={
          <Download
            text={exportCSV(
              rows.map((e) => ({
                tipo: e.kind === "income" ? "receita" : "despesa",
                descricao: e.description,
                valor: (e.amount / 100).toFixed(2).replace(".", ","),
                data: e.date,
                categoria:
                  s.categories.find((c) => c.id === e.categoryId)?.name ?? "",
                conta:
                  e.accountDebits
                    ?.map((debit) => {
                      const account = s.accounts.find(
                        (a) => a.id === debit.accountId,
                      );
                      return `${account?.name ?? "Conta"} (${brl(debit.amount)})`;
                    })
                    .join(" + ") ??
                  s.accounts.find((a) => a.id === e.accountId)?.name ??
                  "",
                pessoa:
                  e.kind === "income" || e.splitA === 100 || e.splitA === 0
                    ? s.names[
                        e.kind === "income"
                          ? e.person === "a"
                            ? 0
                            : 1
                          : e.splitA === 100
                            ? 0
                            : 1
                      ]
                    : `${s.names[0]} e ${s.names[1]}`,
                status: e.paidDate ? "pago" : "pendente",
                cartao: s.cards.find((c) => c.id === e.cardId)?.name ?? "",
                parcela: e.part ?? "",
                total_parcelas: e.parts ?? "",
                mes_filtro: month,
                pessoa_filtro: person,
              })),
            )}
            name={`juntos-lancamentos-${month}-${person}.csv`}
          />
        }
      >
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              placeholder="Buscar um lançamento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar lançamento"
            />
          </label>
          {onPersonChange && (
            <select
              aria-label="Filtrar pessoa"
              value={person}
              onChange={(e) => onPersonChange(e.target.value)}
            >
              <option value="all">Nós dois</option>
              <option value="a">{s.names[0]}</option>
              <option value="b">{s.names[1]}</option>
            </select>
          )}
          <select
            aria-label="Situação"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todas as situações</option>
            <option value="pending">Pendentes</option>
            <option value="paid">Concluídos</option>
          </select>
          <Button secondary onClick={() => open({ kind: "transfer" })}>
            <ArrowLeftRight size={16} />
            Acerto
          </Button>
        </div>
        {rows.length ? (
          <div className="table-wrap entries-table">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data / competência</th>
                  <th>Responsáveis</th>
                  <th>Divisão</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.description}</strong>
                      <small className="block muted">
                        {s.categories.find((c) => c.id === e.categoryId)?.name}
                        {e.cardId
                          ? e.recurringId
                            ? " · Assinatura no cartão"
                            : e.part
                              ? ` · ${e.part}/${e.parts} no cartão`
                              : " · No cartão"
                          : e.recurringId
                            ? " · Recorrente"
                            : ""}
                      </small>
                      {e.accountDebits && (
                        <small className="block muted">
                          {e.accountDebits
                            .map((debit) => {
                              const account = s.accounts.find(
                                (a) => a.id === debit.accountId,
                              );
                              return `${account?.name ?? "Conta"}: ${brl(debit.amount)}`;
                            })
                            .join(" · ")}
                        </small>
                      )}
                    </td>
                    <td data-label="Data / competência">{dateLabel(e.date)}</td>
                    <td data-label="Responsáveis">
                      {e.kind === "income" || e.splitA === 100 || e.splitA === 0
                        ? s.names[
                            e.kind === "income"
                              ? e.person === "a"
                                ? 0
                                : 1
                              : e.splitA === 100
                                ? 0
                                : 1
                          ]
                        : `${s.names[0]} e ${s.names[1]}`}
                    </td>
                    <td data-label="Divisão">
                      {e.kind === "income" ? (
                        "—"
                      ) : (
                        <div className="entry-split">
                          <span>
                            {e.splitA === 100 || e.splitA === 0
                              ? "Individual"
                              : `${e.splitA}% / ${100 - e.splitA}%`}
                          </span>
                          {allocate(e.amount, [e.splitA, 100 - e.splitA]).map(
                            (share, index) =>
                              (index === 0 ? e.splitA > 0 : e.splitA < 100) && (
                                <small className="block muted" key={index}>
                                  {s.names[index]}: {brl(share)}
                                </small>
                              ),
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      data-label="Valor"
                      className={`amount ${e.kind === "income" ? "positive" : ""}`}
                    >
                      {e.kind === "income" ? "+" : "−"}
                      {brl(e.amount)}
                    </td>
                    <td data-label="Situação">
                      <span
                        className={`pill ${e.paidDate ? "green" : e.date < today() && !e.cardId ? "coral" : "amber"}`}
                      >
                        {e.paidDate
                          ? "Concluído"
                          : e.cardId
                            ? "Na fatura"
                            : e.date < today()
                              ? "Atrasado"
                              : "Pendente"}
                      </span>
                    </td>
                    <td data-label="Ações">
                      <div className="row-actions">
                        {!e.cardId && (
                          <>
                            <button
                              className="icon-button"
                              aria-label={`Editar ${e.description}`}
                              onClick={() => open({ kind: "entry", id: e.id })}
                            >
                              <Pencil size={15} />
                            </button>
                            {!e.paidDate && (
                              <button
                                className="icon-button"
                                aria-label={`Confirmar ${e.description}`}
                                onClick={() =>
                                  dispatch({
                                    type: "payEntry",
                                    id: e.id,
                                    date: today(),
                                  })
                                }
                              >
                                <Check size={16} />
                              </button>
                            )}
                            <button
                              className="icon-button danger"
                              aria-label={`Excluir ${e.description}`}
                              onClick={() => {
                                if (
                                  confirm(
                                    "Excluir este lançamento? O saldo será recalculado.",
                                  )
                                )
                                  void dispatch({
                                    type: "delete",
                                    entity: "entry",
                                    id: e.id,
                                  });
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                        {e.cardId && (
                          <button
                            className="text-button"
                            onClick={() => open({ kind: "refund", id: e.id })}
                          >
                            Estornar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhum lançamento neste filtro"
            onClick={() => open({ kind: "entry" })}
          />
        )}
      </Section>
      <Section
        title="Receitas e contas recorrentes"
        subtitle="Geração mensal sem duplicar os lançamentos"
        action={
          <Button secondary onClick={() => open({ kind: "recurring" })}>
            <Repeat2 size={16} />
            Nova recorrência
          </Button>
        }
      >
        {accountRules.length ? (
          <div className="settings-list">
            {accountRules.map((r) => (
              <div className="settings-row" key={r.id}>
                <div>
                  <strong>{r.description}</strong>
                  <p>
                    {r.cardId
                      ? `Assinatura no ${s.cards.find((c) => c.id === r.cardId)?.name ?? "cartão"}`
                      : `Dia ${r.start.slice(8)}`}{" "}
                    · {brl(r.amount)} ·{" "}
                    {r.end ? `até ${dateLabel(r.end)}` : "sem data final"}
                  </p>
                </div>
                <div className="row-actions">
                  <Button
                    secondary
                    onClick={() => open({ kind: "recurring", id: r.id })}
                  >
                    Editar futuras
                  </Button>
                  <button
                    className="icon-button danger"
                    aria-label="Encerrar recorrência"
                    onClick={() => {
                      if (
                        confirm(
                          "Parar novas ocorrências? Lançamentos já gerados permanecem.",
                        )
                      )
                        void dispatch({
                          type: "delete",
                          entity: "rule",
                          id: r.id,
                        });
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Cadastre salários, aluguel e assinaturas para facilitar os próximos
            meses.
          </p>
        )}
      </Section>
    </>
  );
}
