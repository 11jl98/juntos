"use client";
import { useState } from "react";
import { Home, TrendingUp } from "lucide-react";
import {
  summarize,
  categorySpending,
  settlement,
  rentScenario,
} from "@/domain/finance";
import { brl, addMonths, monthLabel, money } from "@/domain/money";
import { Section, Progress, Field, Metric, type FinanceProps } from "./ui";
export function Reports({ state: s, month }: FinanceProps) {
  const t = summarize(s, month),
    cats = categorySpending(s, month),
    housing = cats.filter((c) => c.housing).reduce((n, c) => n + c.total, 0);
  const [oldRent, setOldRent] = useState(""),
    [newRent, setNewRent] = useState("");
  let delta: number | null = null;
  let scenario: ReturnType<typeof rentScenario> | null = null;
  try {
    if (oldRent && newRent) {
      delta = money(newRent) - money(oldRent);
      scenario = rentScenario(
        s,
        month,
        housing,
        money(oldRent),
        money(newRent),
      );
    }
  } catch {}
  const history = Array.from({ length: 6 }, (_, i) =>
    addMonths(month + "-01", i - 5).slice(0, 7),
  ).map((m) => ({ month: m, ...summarize(s, m) }));
  const max = Math.max(1, ...history.flatMap((x) => [x.income, x.expense]));
  const debt = settlement(s);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ENXERGAR PARA DECIDIR</span>
          <h1>O retrato das nossas finanças</h1>
          <p>Entendam os hábitos e testem possibilidades.</p>
        </div>
      </div>
      <div className="two-col">
        <Section
          title="Entradas e gastos"
          subtitle="Últimos seis meses · valores previstos cadastrados"
        >
          <div className="bar-chart">
            {history.map((h) => (
              <div className="bar-column" key={h.month}>
                <div className="bar-pair">
                  <span
                    className="bar income"
                    style={{
                      height: `${(Math.max(0, h.income) / max) * 170}px`,
                    }}
                    title={`Receitas ${brl(h.income)}`}
                  />
                  <span
                    className="bar expense"
                    style={{
                      height: `${(Math.max(0, h.expense) / max) * 170}px`,
                    }}
                    title={`Gastos ${brl(h.expense)}`}
                  />
                </div>
                <small>{monthLabel(h.month).split(" ")[0].slice(0, 3)}</small>
              </div>
            ))}
          </div>
          <div className="chart-key">
            <span>
              <i className="dot green" />
              Receitas
            </span>
            <span>
              <i className="dot coral" />
              Gastos
            </span>
          </div>
          <details>
            <summary>Ver valores do gráfico</summary>
            <table>
              <tbody>
                {history.map((h) => (
                  <tr key={h.month}>
                    <td>{h.month}</td>
                    <td>{brl(h.income)}</td>
                    <td>{brl(h.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Section>
        <Section
          title="Para onde vai o dinheiro"
          subtitle="Despesas por categoria neste mês"
        >
          {cats.length ? (
            cats.map((c, i) => (
              <div className="category-report" key={c.id}>
                <div className="spread">
                  <strong>{c.name}</strong>
                  <span>{brl(c.total)}</span>
                </div>
                <Progress
                  value={t.expense > 0 ? (c.total / t.expense) * 100 : 0}
                  color={["purple", "pink", "blue", "green"][i % 4]}
                />
              </div>
            ))
          ) : (
            <p className="muted">
              Cadastrem despesas para visualizar a distribuição.
            </p>
          )}
        </Section>
      </div>
      <Section
        title="Nosso lar cabe no orçamento?"
        subtitle="Simulação de capacidade de pagamento, sem avaliação de preço de mercado"
      >
        <div className="two-col">
          <div>
            <Metric
              label="Custo total de moradia"
              value={brl(housing)}
              note={
                t.income
                  ? `${((housing / t.income) * 100).toFixed(1)}% da renda prevista`
                  : "Percentual indisponível: renda zero"
              }
              icon={<Home size={20} />}
              color="blue"
            />
            <p className="form-note">
              Inclui categorias marcadas como moradia: aluguel, contas e
              manutenção cadastradas. Outras despesas e receitas ficam
              constantes nesta simulação.
            </p>
          </div>
          <div className="simulation">
            <h3>E se o aluguel mudasse?</h3>
            <div className="form-grid">
              <Field label="Aluguel atual (R$)">
                <input
                  value={oldRent}
                  onChange={(e) => setOldRent(e.target.value)}
                  inputMode="decimal"
                  placeholder="1.800,00"
                />
              </Field>
              <Field label="Aluguel simulado (R$)">
                <input
                  value={newRent}
                  onChange={(e) => setNewRent(e.target.value)}
                  inputMode="decimal"
                  placeholder="2.200,00"
                />
              </Field>
            </div>
            {delta !== null ? (
              <>
                <p>
                  Diferença no aluguel: <strong>{brl(delta)} por mês</strong> e{" "}
                  <strong>{brl(delta * 12)} em 12 meses</strong>
                </p>
                <p>
                  Moradia total simulada:{" "}
                  <strong>{brl(scenario!.housing)}</strong>
                  {scenario!.incomeShare !== null && (
                    <> · {scenario!.incomeShare.toFixed(1)}% da renda</>
                  )}
                </p>
                <p>
                  Resultado mensal: {brl(t.result)} →{" "}
                  <strong
                    className={scenario!.result < 0 ? "negative" : "positive"}
                  >
                    {brl(scenario!.result)}
                  </strong>
                </p>
                <p>
                  Capacidade para metas: {brl(t.capacity)} →{" "}
                  <strong className="positive">
                    {brl(scenario!.capacity)}
                  </strong>
                  {scenario!.capacityDelta !== 0 && (
                    <> · diferença de {brl(scenario!.capacityDelta)}</>
                  )}
                </p>
                <p className="form-note">
                  {delta < 0
                    ? `Reduzir o aluguel poderia liberar ${brl(-delta)} por mês (${brl(-delta * 12)} em 12 meses) para objetivos.`
                    : delta > 0
                      ? `O novo aluguel exigiria ${brl(delta)} a mais por mês (${brl(delta * 12)} em 12 meses).`
                      : "O aluguel não muda neste cenário."}{" "}
                  Caução, mudança, transporte e alterações de condomínio/contas
                  não estão incluídos; os demais gastos e receitas permanecem
                  constantes.
                </p>
              </>
            ) : (
              <p className="muted">Preencha os dois valores para simular.</p>
            )}
          </div>
        </div>
      </Section>
      <div className="two-col">
        <Section
          title="O equilíbrio entre vocês"
          subtitle="Acertos de todo o histórico, somente sobre valores pagos"
        >
          <h3 className="settlement-value">{brl(Math.abs(debt))}</h3>
          <p>
            {debt === 0
              ? "Tudo acertado."
              : `${debt > 0 ? s.names[1] : s.names[0]} deve acertar com ${debt > 0 ? s.names[0] : s.names[1]}.`}
          </p>
        </Section>
        <Section title="Leiam os números com contexto">
          <div className="insight">
            <TrendingUp size={25} />
            <p>
              Meses em andamento ou sem todos os registros são incompletos.
              Faturas pagas e transferências não aumentam o consumo. Uma sobra
              prevista não garante que o dinheiro já esteja disponível hoje.
            </p>
          </div>
        </Section>
      </div>
    </>
  );
}
