"use client";
import { useState } from "react";
import { Plus, Target, Pencil, AlertCircle, Check, Trash2 } from "lucide-react";
import { summarize, goalPlans, discretionarySpending } from "@/domain/finance";
import { GROUPS } from "@/domain/types";
import { brl, dateLabel } from "@/domain/money";
import {
  Button,
  Section,
  Progress,
  Empty,
  Field,
  type FinanceProps,
} from "./ui";
export function Planning({ state: s, month, open, dispatch }: FinanceProps) {
  const t = summarize(s, month),
    goals = goalPlans(s, month);
  const [cutPercent, setCutPercent] = useState(25);
  const discretionary = discretionarySpending(s, month);
  const discretionaryTotal = discretionary.reduce(
    (total, category) => total + category.total,
    0,
  );
  const monthlySavings = Math.round((discretionaryTotal * cutPercent) / 100);
  const capacityWithSavings = Math.max(
    0,
    Math.min(
      t.result + monthlySavings - t.contributed,
      t.projected + monthlySavings - t.budget.margin,
    ),
  );
  const additionalGoalCapacity = Math.max(0, capacityWithSavings - t.capacity);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">SONHOS COM DATA E PLANO</span>
          <h1>Planejar para conquistar</h1>
          <p>Definam prioridades. Acompanhem cada passo.</p>
        </div>
        <Button onClick={() => open({ kind: "goal" })}>
          <Plus size={17} />
          Nova meta
        </Button>
      </div>
      <Section
        title="Uma função para cada parte da renda"
        subtitle={`Base prevista: ${brl(t.income)} · divisão padrão: ${t.budget.splitMode === "income" ? "proporcional à renda" : `${t.budget.splitA}% / ${100 - t.budget.splitA}%`} · percentuais ajustáveis para este mês`}
        action={
          <Button secondary onClick={() => open({ kind: "budget" })}>
            <Pencil size={15} />
            Editar regras
          </Button>
        }
      >
        <div className="budget-grid">
          {GROUPS.map((g, i) => (
            <div className={`budget-card group-${i}`} key={g}>
              <div className="spread">
                <strong>{g}</strong>
                <span className="budget-percent">
                  {t.budget.percentages[i]}%
                </span>
              </div>
              <h3>{brl(t.limits[i])}</h3>
              <Progress
                value={t.limits[i] ? (t.used[i] / t.limits[i]) * 100 : 0}
                color={["purple", "pink", "green", "blue"][i]}
              />
              <p>
                {brl(t.used[i])}{" "}
                {i < 2
                  ? "em gastos com renda livre"
                  : "aportados / comprometidos"}
              </p>
              <small className={t.used[i] > t.limits[i] ? "negative" : ""}>
                {t.used[i] > t.limits[i]
                  ? `Excedeu ${brl(t.used[i] - t.limits[i])}`
                  : `Restam ${brl(t.limits[i] - t.used[i])}`}
              </small>
            </div>
          ))}
        </div>
      </Section>
      <div className="notice">
        <AlertCircle size={19} />
        <p>
          <strong>O orçamento é uma intenção. A sobra é o limite.</strong> A
          capacidade adicional neste mês é {brl(t.capacity)}. Nenhuma sugestão
          movimenta dinheiro automaticamente.
        </p>
      </div>
      <Section
        title="Gastos que podem abrir espaço para metas"
        subtitle="Oportunidades em categorias marcadas como Diversão, incluindo compras no cartão e outros lançamentos."
      >
        <div className="form-grid">
          <Field label="Redução hipotética dos gastos variáveis">
            <select
              value={cutPercent}
              onChange={(e) => setCutPercent(Number(e.target.value))}
            >
              <option value={10}>10%</option>
              <option value={25}>25%</option>
              <option value={50}>50%</option>
            </select>
          </Field>
        </div>
        {discretionary.length ? (
          <>
            <div className="settings-list">
              {discretionary.map((category) => (
                <div className="settings-row" key={category.id}>
                  <div className="grow">
                    <strong>{category.name}</strong>
                    <p>
                      Cartão: {brl(category.card)} · À vista / outros:{" "}
                      {brl(category.cash)}
                    </p>
                  </div>
                  <strong>{brl(category.total)}</strong>
                </div>
              ))}
            </div>
            <p>
              Reduzindo {cutPercent}% em um mês semelhante, a economia potencial
              seria <strong>{brl(monthlySavings)} por mês</strong> (
              {brl(monthlySavings * 12)} em 12 meses).
            </p>
            <p>
              Capacidade para metas: {brl(t.capacity)} →{" "}
              <strong className="positive">{brl(capacityWithSavings)}</strong>
              {additionalGoalCapacity > 0 && (
                <> · até {brl(additionalGoalCapacity)} a mais</>
              )}
            </p>
          </>
        ) : (
          <p className="muted">
            Ainda não há gastos em categorias marcadas como Diversão neste mês.
            Nenhuma despesa essencial será sugerida como evitável.
          </p>
        )}
        <p className="form-note">
          É uma simulação, não uma classificação automática de compras como
          dispensáveis. Compras e parcelas já contratadas não são canceladas; a
          estimativa não muda o saldo nem cria aportes. Revisem os lançamentos
          antes de decidir o que redirecionar às metas.
        </p>
      </Section>
      <div className="goals-grid">
        {goals.map((g) => (
          <Section
            key={g.id}
            title={g.name}
            subtitle={`${g.group === "reserve" ? "Reserva" : "Investimentos"} · prioridade ${g.priority}`}
            action={
              <button
                className="icon-button"
                aria-label={`Editar meta ${g.name}`}
                onClick={() => open({ kind: "goal", id: g.id })}
              >
                <Pencil size={16} />
              </button>
            }
          >
            <div className="goal-big">
              <Target size={27} />
              <strong>{brl(g.saved)}</strong>
              <span>de {brl(g.target)}</span>
            </div>
            <Progress value={(g.saved / g.target) * 100} />
            <p className="muted">Prazo: {dateLabel(g.deadline)}</p>
            <dl className="key-values">
              <div>
                <dt>Necessário por mês</dt>
                <dd>{brl(g.needed)}</dd>
              </div>
              <div>
                <dt>Pode destinar agora</dt>
                <dd className="positive">{brl(g.suggested)}</dd>
              </div>
              <div>
                <dt>Ainda falta viabilizar</dt>
                <dd className={g.shortfall ? "negative" : ""}>
                  {brl(g.shortfall)}
                </dd>
              </div>
            </dl>
            {g.overdue && (
              <p className="error">
                Prazo vencido. Revisem o prazo ou o valor da meta.
              </p>
            )}
            <div className="spread">
              <Button onClick={() => open({ kind: "movement", id: g.id })}>
                Registrar aporte / retirada
              </Button>
              {!s.movements.some((m) => m.goalId === g.id) && (
                <button
                  className="icon-button danger"
                  aria-label="Excluir meta"
                  onClick={() => {
                    if (confirm("Excluir esta meta?"))
                      void dispatch({
                        type: "delete",
                        entity: "goal",
                        id: g.id,
                      });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </Section>
        ))}
      </div>
      {!goals.length && (
        <Section title="As próximas conquistas">
          <Empty
            title="Todo sonho começa com um plano"
            onClick={() => open({ kind: "goal" })}
          />
        </Section>
      )}
      <Section
        title="Aportes e retiradas"
        subtitle="Histórico do mês, separado das despesas de consumo"
      >
        {s.movements.filter((m) => m.date.startsWith(month)).length ? (
          <div className="settings-list">
            {s.movements
              .filter((m) => m.date.startsWith(month))
              .map((m) => (
                <div className="settings-row" key={m.id}>
                  <div>
                    <strong>
                      {s.goals.find((g) => g.id === m.goalId)?.name}
                    </strong>
                    <p>
                      {dateLabel(m.date)} ·{" "}
                      {m.amount >= 0 ? "Aporte" : "Retirada"} ·{" "}
                      {m.planned ? "Planejado" : "Realizado"}
                    </p>
                  </div>
                  <strong>{brl(Math.abs(m.amount))}</strong>
                  {m.planned && (
                    <Button
                      secondary
                      onClick={() =>
                        dispatch({ type: "confirmMovement", id: m.id })
                      }
                    >
                      <Check size={15} />
                      Confirmar
                    </Button>
                  )}
                </div>
              ))}
          </div>
        ) : (
          <p className="muted">Nenhuma movimentação de metas neste mês.</p>
        )}
      </Section>
    </>
  );
}
