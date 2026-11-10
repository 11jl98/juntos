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
import { brl, dateLabel, today } from "@/domain/money";
import { exportCSV } from "@/domain/csv";
import { Button, Section, Empty, Download, type FinanceProps } from "./ui";
export function Entries({
  state: s,
  month,
  open,
  dispatch,
  person = "all",
}: FinanceProps) {
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("all");
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
                conta: s.accounts.find((a) => a.id === e.accountId)?.name ?? "",
                pessoa: s.names[e.person === "a" ? 0 : 1],
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data / competência</th>
                  <th>Responsável</th>
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
                          ? ` · ${e.part}/${e.parts} no cartão`
                          : e.recurringId
                            ? " · Recorrente"
                            : ""}
                      </small>
                    </td>
                    <td>{dateLabel(e.date)}</td>
                    <td>{s.names[e.person === "a" ? 0 : 1]}</td>
                    <td>
                      {e.kind === "income"
                        ? "—"
                        : `${e.splitA}% / ${100 - e.splitA}%`}
                    </td>
                    <td
                      className={`amount ${e.kind === "income" ? "positive" : ""}`}
                    >
                      {e.kind === "income" ? "+" : "−"}
                      {brl(e.amount)}
                    </td>
                    <td>
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
                    <td>
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
        {s.rules.length ? (
          <div className="settings-list">
            {s.rules.map((r) => (
              <div className="settings-row" key={r.id}>
                <div>
                  <strong>{r.description}</strong>
                  <p>
                    Dia {r.start.slice(8)} · {brl(r.amount)} ·{" "}
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
