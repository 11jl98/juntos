"use client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Target,
  ArrowRight,
  Home,
  Sparkles,
  Plus,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import {
  summarize,
  goalPlans,
  categorySpending,
  settlement,
} from "@/domain/finance";
import { brl, dateLabel } from "@/domain/money";
import {
  Section,
  Metric,
  Progress,
  Empty,
  Button,
  type FinanceProps,
} from "./ui";
export function Overview({ state: s, month, open }: FinanceProps) {
  const t = summarize(s, month),
    goals = goalPlans(s, month),
    categories = categorySpending(s, month);
  const debt = settlement(s);
  const rows = s.entries
    .filter((e) => e.date.startsWith(month))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const housing = categories
    .filter((c) => c.housing)
    .reduce((n, c) => n + c.total, 0);
  return (
    <>
      <div className="welcome">
        <div>
          <div className="eyebrow">
            <span className="live-dot" /> UM PLANO, DOIS SONHOS
          </div>
          <h1>
            O futuro fica melhor <em>juntos.</em>
          </h1>
          <p>Mais clareza nas contas. Mais espaço para o que importa.</p>
        </div>
        <Button onClick={() => open({ kind: "entry" })}>
          <Plus size={18} />
          Novo lançamento
        </Button>
      </div>
      <div className="metrics">
        <Metric
          label="Receitas do mês"
          value={brl(t.income)}
          note={`${brl(t.received)} já recebidos`}
          color="green"
          icon={<ArrowDownLeft size={20} />}
        />
        <Metric
          label="Gastos previstos"
          value={brl(t.expense)}
          note={`${brl(t.pending)} a pagar até o mês`}
          color="coral"
          icon={<ArrowUpRight size={20} />}
        />
        <Metric
          label="Saldo projetado"
          value={brl(t.projected)}
          note="Após contas e aportes planejados"
          color={t.projected < 0 ? "coral" : "blue"}
          icon={<Wallet size={20} />}
        />
        <Metric
          label="Pode guardar mais"
          value={brl(t.capacity)}
          note="Limitado à sobra e ao caixa"
          icon={<Target size={20} />}
        />
      </div>
      <div className="overview-grid">
        <section className="hero-panel">
          <div className="hero-content">
            <span className="pill light">
              <Sparkles size={14} /> O DINHEIRO A FAVOR DE VOCÊS
            </span>
            <h2>
              Cada escolha de hoje.
              <br />
              Um sonho mais perto.
            </h2>
            <p>
              {t.capacity > 0
                ? `O planejamento indica ${brl(t.capacity)} disponíveis para novas metas neste mês.`
                : "Cadastrem o salário como receita mensal, não como saldo inicial da conta, para descobrir quanto podem guardar juntos."}
            </p>
            <Button onClick={() => open({ kind: "goal" })}>
              Planejar uma conquista <ArrowRight size={16} />
            </Button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="coin coin-back">↗</div>
            <div className="coin coin-front">
              <Target size={56} strokeWidth={1.3} />
            </div>
            <span className="spark spark-one">✦</span>
            <span className="spark spark-two">✦</span>
          </div>
          <div className="hero-footer">
            <span>
              <span className="avatar small">{s.names[0][0]}</span>
              <span className="avatar small second">{s.names[1][0]}</span>
            </span>
            <span>{s.names.join(" + ")} · construindo o próximo capítulo</span>
          </div>
        </section>
        <Section
          title="Seu dinheiro, com destino"
          subtitle="Distribuição planejada da renda"
          action={
            <button
              className="text-button"
              onClick={() => open({ kind: "budget" })}
            >
              Ajustar <ArrowUpRight size={14} />
            </button>
          }
        >
          <div className="allocation">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#7461e8 0 ${t.budget.percentages[0]}%,#ee81ad ${t.budget.percentages[0]}% ${t.budget.percentages[0] + t.budget.percentages[1]}%,#21b894 ${t.budget.percentages[0] + t.budget.percentages[1]}% ${100 - t.budget.percentages[3]}%,#5597ee ${100 - t.budget.percentages[3]}% 100%)`,
              }}
            >
              <div>
                <span>RENDA DO CASAL</span>
                <strong>{brl(t.income)}</strong>
                <small>100% com um propósito</small>
              </div>
            </div>
            <div className="legend">
              {[
                "Contas essenciais",
                "Diversão",
                "Reserva",
                "Investimentos",
              ].map((name, i) => (
                <div key={name}>
                  <span className={`dot group-${i}`} />
                  <span>{name}</span>
                  <strong>{t.budget.percentages[i]}%</strong>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
      <div className="two-col">
        <Section
          title="Conquistas em construção"
          subtitle="Um pouco a cada mês faz diferença"
          action={
            <button
              className="text-button"
              onClick={() => open({ kind: "goal" })}
            >
              <Plus size={15} />
              Nova meta
            </button>
          }
        >
          {goals.length ? (
            <div className="goal-list">
              {goals.slice(0, 3).map((g, i) => (
                <div className="goal-row" key={g.id}>
                  <span className={`goal-icon tone-${i % 3}`}>
                    <Target size={20} />
                  </span>
                  <div className="grow">
                    <div className="spread">
                      <strong>{g.name}</strong>
                      <small>
                        {Math.min(100, Math.round((g.saved / g.target) * 100))}%
                      </small>
                    </div>
                    <Progress
                      value={(g.saved / g.target) * 100}
                      color={g.group === "invest" ? "blue" : "purple"}
                    />
                    <div className="spread">
                      <small>
                        {brl(g.saved)}{" "}
                        <span className="muted">de {brl(g.target)}</span>
                      </small>
                      <button
                        className="text-button"
                        onClick={() => open({ kind: "movement", id: g.id })}
                      >
                        Guardar <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Qual é o próximo sonho?"
              text="Uma reserva, a viagem ou a casa de vocês."
              onClick={() => open({ kind: "goal" })}
            />
          )}
        </Section>
        <Section
          title="O que merece atenção"
          subtitle="Pequenos ajustes, grandes diferenças"
        >
          <div className="insight">
            <span className="insight-icon">
              <Home size={20} />
            </span>
            <div>
              <strong>Quanto custa o nosso lar?</strong>
              <p>
                {brl(housing)} em moradia ·{" "}
                {t.income
                  ? Math.round((housing / t.income) * 100) + "% da renda"
                  : "cadastre a renda para comparar"}
                .
              </p>
            </div>
          </div>
          <div className="insight">
            <span className="insight-icon green">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <strong>Contas claras entre vocês</strong>
              <p>
                {debt === 0
                  ? "Nenhum acerto pendente."
                  : `${debt > 0 ? s.names[1] : s.names[0]} tem ${brl(Math.abs(debt))} a acertar com ${debt > 0 ? s.names[0] : s.names[1]}.`}
              </p>
            </div>
          </div>
          <div className="insight">
            <span className="insight-icon pink">
              <Clock3 size={20} />
            </span>
            <div>
              <strong>
                {t.result < 0
                  ? "O mês precisa de um ajuste"
                  : "Planejamento com os pés no chão"}
              </strong>
              <p>
                {t.result < 0
                  ? `As despesas superam a renda em ${brl(-t.result)}.`
                  : "A projeção considera somente os registros cadastrados. Incluam as contas que ainda faltam."}
              </p>
            </div>
          </div>
        </Section>
      </div>
      <Section
        title="Últimos lançamentos"
        subtitle="A vida acontecendo, sem perder a conta"
        action={
          <button
            className="text-button"
            onClick={() => open({ kind: "entry" })}
          >
            Adicionar <Plus size={15} />
          </button>
        }
      >
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Responsável</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th className="right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="entry-title">
                        <span
                          className={`entry-icon ${e.kind === "income" ? "green" : "purple"}`}
                        >
                          {e.kind === "income" ? (
                            <ArrowDownLeft size={18} />
                          ) : (
                            <ArrowUpRight size={18} />
                          )}
                        </span>
                        <strong>{e.description}</strong>
                      </div>
                    </td>
                    <td>
                      {s.categories.find((c) => c.id === e.categoryId)?.name}
                    </td>
                    <td>
                      <span className="person-tag">
                        {s.names[e.person === "a" ? 0 : 1]}
                      </span>
                    </td>
                    <td>{dateLabel(e.date)}</td>
                    <td>
                      <span
                        className={`pill ${e.paidDate ? "green" : "amber"}`}
                      >
                        {e.paidDate
                          ? "Concluído"
                          : e.cardId
                            ? "Na fatura"
                            : "Pendente"}
                      </span>
                    </td>
                    <td
                      className={`right amount ${e.kind === "income" ? "positive" : ""}`}
                    >
                      {e.kind === "income" ? "+" : "−"} {brl(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            text="Comecem cadastrando as rendas e as contas do mês."
            onClick={() => open({ kind: "entry" })}
          />
        )}
      </Section>
    </>
  );
}
