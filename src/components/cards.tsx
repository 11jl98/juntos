"use client";
import {
  Plus,
  CreditCard,
  Pencil,
  ShieldCheck,
  Repeat2,
  Trash2,
} from "lucide-react";
import { invoice } from "@/domain/finance";
import { brl, dateLabel } from "@/domain/money";
import { Button, Section, Empty, Progress, type FinanceProps } from "./ui";
export function Cards({ state: s, month, open, dispatch }: FinanceProps) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SEM SURPRESAS NA FATURA</span>
          <h1>Cartões do casal</h1>
          <p>Compras de hoje, compromissos dos próximos meses.</p>
        </div>
        <Button onClick={() => open({ kind: "card" })}>
          <Plus size={17} />
          Adicionar cartão
        </Button>
      </div>
      {!s.cards.length ? (
        <Section title="Seus cartões">
          <Empty
            title="Cada fatura no seu lugar"
            text="Cadastre apenas nome, limite e datas. Sem dados sensíveis."
            onClick={() => open({ kind: "card" })}
          />
        </Section>
      ) : (
        <>
          <div className="cards-grid">
            {s.cards.map((c) => {
              const inv = invoice(s, c.id, month);
              const debt = Math.max(
                0,
                s.entries
                  .filter((e) => e.cardId === c.id)
                  .reduce((v, e) => v + e.amount, 0) -
                  s.payments
                    .filter((p) => p.cardId === c.id)
                    .reduce((v, p) => v + p.amount, 0) -
                  s.refunds
                    .filter((r) => r.cardId === c.id)
                    .reduce((v, r) => v + r.amount, 0),
              );
              return (
                <article className="card-panel" key={c.id}>
                  <div className={`bank-card ${c.color}`}>
                    <div className="spread">
                      <strong>{c.name}</strong>
                      <CreditCard size={26} />
                    </div>
                    <span className="chip" />
                    <small>FATURA DO MÊS</small>
                    <h2>{brl(inv.open)}</h2>
                    <div className="spread">
                      <span>{s.names[c.owner === "a" ? 0 : 1]}</span>
                      <span>Vence dia {c.due}</span>
                    </div>
                  </div>
                  <div className="card-details">
                    <div className="spread">
                      <span>Limite disponível estimado</span>
                      <strong>{brl(Math.max(0, c.limit - debt))}</strong>
                    </div>
                    <Progress
                      value={c.limit ? (debt / c.limit) * 100 : 0}
                      color={c.color}
                    />
                    <small>
                      Comprometido: {brl(debt)} de {brl(c.limit)} · fecha dia{" "}
                      {c.closing}
                    </small>
                    <div className="card-buttons">
                      <Button
                        onClick={() => open({ kind: "purchase", id: c.id })}
                      >
                        <Plus size={15} />
                        Compra
                      </Button>
                      <Button
                        secondary
                        onClick={() =>
                          open({
                            kind: "purchase",
                            id: c.id,
                            mode: "subscription",
                          })
                        }
                      >
                        <Repeat2 size={15} />
                        Assinatura
                      </Button>
                      <Button
                        secondary
                        onClick={() => open({ kind: "payInvoice", id: c.id })}
                        disabled={!inv.open}
                      >
                        Pagar fatura
                      </Button>
                      <button
                        className="icon-button"
                        aria-label={`Editar ${c.name}`}
                        onClick={() => open({ kind: "card", id: c.id })}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                    {!s.entries.some((e) => e.cardId === c.id) && (
                      <button
                        className="text-button danger"
                        onClick={() => {
                          if (confirm("Excluir cartão sem histórico?"))
                            void dispatch({
                              type: "delete",
                              entity: "card",
                              id: c.id,
                            });
                        }}
                      >
                        Excluir cartão
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          <Section
            title="Assinaturas mensais"
            subtitle="Cobranças ligadas ao cartão, sem parcelamento"
          >
            {s.rules.filter((r) => r.cardId).length ? (
              <div className="settings-list">
                {s.rules
                  .filter((r) => r.cardId)
                  .map((r) => (
                    <div className="settings-row" key={r.id}>
                      <div className="grow">
                        <strong>{r.description}</strong>
                        <p>
                          {s.cards.find((c) => c.id === r.cardId)?.name} ·{" "}
                          {brl(r.amount)} ·
                          {r.end ? ` até ${dateLabel(r.end)}` : " ativa"}
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
                          aria-label={`Encerrar assinatura ${r.description}`}
                          onClick={() => {
                            if (
                              confirm(
                                "Encerrar futuras cobranças? Cobranças atuais e já pagas serão preservadas.",
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
                Nenhuma assinatura cadastrada nos cartões.
              </p>
            )}
          </Section>
          {s.cards.map((c) => {
            const inv = invoice(s, c.id, month);
            return (
              <Section
                key={c.id}
                title={`Fatura · ${c.name}`}
                subtitle={`Compras ${brl(inv.total)} · pagos ${brl(inv.paid)} · crédito a transportar ${brl(inv.credit)}`}
              >
                {inv.rows.length ? (
                  <div className="table-wrap invoice-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Compra</th>
                          <th>Parcela</th>
                          <th>Vencimento</th>
                          <th>Valor</th>
                          <th>Ajuste</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.rows.map((e) => (
                          <tr key={e.id}>
                            <td>
                              <strong>{e.description}</strong>
                            </td>
                            <td data-label="Tipo">
                              {e.recurringId
                                ? "Assinatura"
                                : e.part
                                  ? `${e.part}/${e.parts}`
                                  : "À vista"}
                            </td>
                            <td data-label="Vencimento">{dateLabel(e.date)}</td>
                            <td data-label="Valor">{brl(e.amount)}</td>
                            <td data-label="Ajuste">
                              <button
                                className="text-button"
                                onClick={() =>
                                  open({ kind: "refund", id: e.id })
                                }
                              >
                                Estornar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">Sem compras nesta fatura.</p>
                )}
                {s.payments
                  .filter((p) => p.cardId === c.id && p.month === month)
                  .map((p) => (
                    <p className="payment-note" key={p.id}>
                      <ShieldCheck size={16} />
                      {brl(p.amount)} pagos em {dateLabel(p.date)} por{" "}
                      {s.names[p.person === "a" ? 0 : 1]}
                    </p>
                  ))}
              </Section>
            );
          })}
        </>
      )}
    </>
  );
}
