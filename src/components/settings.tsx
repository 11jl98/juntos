"use client";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  Users,
  Copy,
  Wallet,
  History,
  Download as DownloadIcon,
} from "lucide-react";
import {
  accountBalance,
  accountOutflows,
  primaryAccount,
} from "@/domain/finance";
import { brl, dateLabel, money, monthLabel, today } from "@/domain/money";
import { parseCSV, exportCSV } from "@/domain/csv";
import { entrySchema, type Entry } from "@/domain/types";
import { Section, Button, Field, Download, type FinanceProps } from "./ui";
const fields = [
  "tipo",
  "descricao",
  "valor",
  "data",
  "categoria",
  "conta",
  "pessoa",
  "status",
];
function AccountHistory({
  state,
  accountId,
  month,
}: {
  state: FinanceProps["state"];
  accountId: string;
  month: string;
}) {
  const rows = accountOutflows(state, accountId, month);
  const account = state.accounts.find((account) => account.id === accountId);
  return (
    <details className="account-history">
      <summary aria-label={`Histórico de saídas de ${account?.name}`}>
        <History size={16} aria-hidden="true" />
        Histórico de saídas
      </summary>
      <div className="spread account-history-heading">
        <span>{monthLabel(month)}</span>
        <strong>
          Total: {brl(rows.reduce((total, row) => total + row.amount, 0))}
        </strong>
      </div>
      {rows.length ? (
        <ul className="account-outflows">
          {rows.map((row) => (
            <li key={row.id}>
              <div>
                <strong>{row.description}</strong>
                <small className="block muted">
                  {dateLabel(row.date)} · {row.kind}
                </small>
              </div>
              <span className="amount">−{brl(row.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" role="status">
          Nenhuma saída nesta conta no mês selecionado.
        </p>
      )}
    </details>
  );
}
export function Settings({
  state: s,
  month,
  open,
  dispatch,
  invite,
  canInvite = true,
  mode,
}: {
  invite: (email: string) => Promise<string>;
  canInvite?: boolean;
  mode: string;
} & FinanceProps) {
  const [email, setEmail] = useState(""),
    [link, setLink] = useState(""),
    [message, setMessage] = useState(""),
    [rows, setRows] = useState<Record<string, string>[]>([]),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [fileName, setFileName] = useState(""),
    [hash, setHash] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [busy, setBusy] = useState(false);
  const preview: Entry[] = [],
    errors: string[] = [];
  const norm = (v: string) => v.trim().toLocaleLowerCase("pt-BR");
  rows.forEach((r, i) => {
    try {
      const val = (k: string) => r[mapping[k]] ?? "";
      const cat = s.categories.find(
          (c) => norm(c.name) === norm(val("categoria")),
        ),
        account = s.accounts.find((a) => norm(a.name) === norm(val("conta")));
      if (!cat || !account)
        throw new Error(
          "Categoria ou conta desconhecida. Cadastre antes da importação.",
        );
      const person = s.names.findIndex((n) => norm(n) === norm(val("pessoa")));
      if (person < 0)
        throw new Error("Pessoa não corresponde aos nomes do casal.");
      const kind = norm(val("tipo"));
      if (!["receita", "despesa"].includes(kind))
        throw new Error("Tipo deve ser receita ou despesa.");
      const status = norm(val("status"));
      if (!["pago", "pendente", "recebido"].includes(status))
        throw new Error("Status deve ser pago, recebido ou pendente.");
      const date = val("data").includes("/")
        ? val("data").split("/").reverse().join("-")
        : val("data");
      preview.push(
        entrySchema.parse({
          id: `csv-${hash.slice(0, 20)}-${i}`,
          kind: kind === "receita" ? "income" : "expense",
          description: val("descricao"),
          amount: money(val("valor")),
          date,
          categoryId: cat.id,
          accountId: account.id,
          person: person === 0 ? "a" : "b",
          splitA: 50,
          paidDate: status === "pendente" ? null : date,
        }),
      );
    } catch (e) {
      errors.push(
        `Linha ${i + 2}: ${e instanceof Error ? e.message : "Inválida"}`,
      );
    }
  });
  const duplicates = preview.filter((e) =>
    s.entries.some(
      (x) =>
        x.amount === e.amount &&
        x.date === e.date &&
        x.description === e.description &&
        x.kind === e.kind,
    ),
  ).length;
  async function readFile(file: File | undefined) {
    if (!file) return;
    setMessage("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Limite de 5 MB.");
      const text = await file.text();
      const parsed = parseCSV(text);
      setRows(parsed);
      setFileName(file.name);
      setMapping(
        Object.fromEntries(
          fields.map((f) => [
            f,
            Object.keys(parsed[0] ?? {}).find((k) => norm(k) === f) ?? "",
          ]),
        ),
      );
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text),
      );
      setHash(
        Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      );
      setReviewed(false);
    } catch (e) {
      setRows([]);
      setMessage(e instanceof Error ? e.message : "Arquivo inválido.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">DO JEITO DE VOCÊS</span>
          <h1>Nosso espaço</h1>
          <p>Contas, categorias e tudo o que mantém o plano organizado.</p>
        </div>
      </div>
      <div className="two-col">
        <Section title="Quem constrói esse plano" action={<Users size={20} />}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await dispatch({
                type: "names",
                names: [String(f.get("a")), String(f.get("b"))],
              });
            }}
          >
            <div className="form-grid">
              <Field label="Pessoa 1">
                <input
                  name="a"
                  defaultValue={s.names[0]}
                  key={s.names[0]}
                  required
                  maxLength={60}
                />
              </Field>
              <Field label="Pessoa 2">
                <input
                  name="b"
                  defaultValue={s.names[1]}
                  key={s.names[1]}
                  required
                  maxLength={60}
                />
              </Field>
            </div>
            <Button type="submit" secondary>
              Salvar nomes
            </Button>
          </form>
          <hr />
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                setLink(await invite(email));
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Erro ao convidar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="E-mail do seu par">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!canInvite}
              />
            </Field>
            <Button type="submit" secondary disabled={busy || !canInvite}>
              {busy ? "Gerando…" : "Gerar convite"}
            </Button>
            <p className="form-note">
              Somente o criador pode convidar. O link vale por 7 dias e só
              funciona com o e-mail informado. Vocês compartilham todos os
              registros.
            </p>
          </form>
          {link && (
            <div className="invite-result">
              <input value={link} readOnly aria-label="Link de convite" />
              <Button
                secondary
                onClick={() => {
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => setMessage("Convite copiado."))
                    .catch(() => setMessage("Selecione e copie o link acima."));
                }}
              >
                <Copy size={15} />
                Copiar
              </Button>
            </div>
          )}
          {mode === "demo" && (
            <p className="form-note">
              Na demonstração, convites não são enviados nem ativados.
            </p>
          )}
        </Section>
        <Section
          title="Contas de uso diário"
          action={
            <Button secondary onClick={() => open({ kind: "account" })}>
              <Plus size={15} />
              Conta
            </Button>
          }
        >
          {s.accounts.map((a) => (
            <div className="settings-row" key={a.id}>
              <span className="metric-icon">
                <Wallet size={18} />
              </span>
              <div className="grow">
                <strong>
                  {a.name}
                  {primaryAccount(s, a.owner)?.id === a.id && (
                    <span className="pill green">Principal</span>
                  )}
                </strong>
                <p>
                  {s.names[a.owner === "a" ? 0 : 1]} ·{" "}
                  {brl(accountBalance(s, a.id))}
                  {a.kind === "benefit" ? " · Vale-alimentação" : ""}
                </p>
              </div>
              <button
                className="icon-button"
                aria-label={`Editar ${a.name}`}
                onClick={() => open({ kind: "account", id: a.id })}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-button danger"
                aria-label={`Excluir ${a.name}`}
                onClick={() => {
                  if (confirm("Excluir conta sem histórico?"))
                    void dispatch({
                      type: "delete",
                      entity: "account",
                      id: a.id,
                    });
                }}
              >
                <Trash2 size={16} />
              </button>
              <AccountHistory state={s} accountId={a.id} month={month} />
            </div>
          ))}
          {!s.accounts.length && (
            <p className="muted">
              Adicione uma conta para cada pessoa antes de lançar receitas e
              despesas.
            </p>
          )}
          <p className="form-note">
            As reservas ficam nas metas, separadas do saldo de uso diário.
          </p>
          <Button secondary onClick={() => open({ kind: "transfer" })}>
            Transferir ou registrar acerto
          </Button>
        </Section>
      </div>
      <Section
        title="Categorias"
        subtitle="Marque as despesas da casa para compor a análise de moradia"
        action={
          <Button secondary onClick={() => open({ kind: "category" })}>
            <Plus size={15} />
            Categoria
          </Button>
        }
      >
        <div className="category-grid">
          {s.categories.map((c) => (
            <button
              className="category-tile"
              key={c.id}
              onClick={() => open({ kind: "category", id: c.id })}
            >
              <span
                className={`dot ${c.group === "fun" ? "pink" : "purple"}`}
              />
              <span>
                <strong>{c.name}</strong>
                <small>
                  {c.archived
                    ? "Arquivada"
                    : c.housing
                      ? "Moradia"
                      : c.group === "fun"
                        ? "Diversão"
                        : "Essenciais"}
                </small>
              </span>
              <Pencil size={14} />
            </button>
          ))}
        </div>
      </Section>
      <Section
        title="Importar e exportar"
        subtitle="CSV de receitas e despesas à vista. Importação revisada antes de salvar."
        action={<DownloadIcon size={20} />}
      >
        <div className="toolbar">
          <label className="upload-button">
            <Upload size={17} />
            Escolher arquivo CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void readFile(e.target.files?.[0])}
            />
          </label>
          <Download
            label="Baixar modelo CSV"
            name="juntos-modelo.csv"
            text={exportCSV([
              {
                tipo: "despesa",
                descricao: "Exemplo de mercado",
                valor: "125,50",
                data: today(),
                categoria: "Mercado",
                conta: s.accounts[0]?.name ?? "Cadastre a conta",
                pessoa: s.names[0],
                status: "pendente",
              },
            ])}
          />
        </div>
        <p className="form-note">
          Máximo 5.000 linhas / 5 MB. Gastos importados são divididos 50/50;
          podem ser ajustados depois. Cartões devem ser cadastrados na área de
          faturas.
        </p>
        {!!rows.length && (
          <>
            <h3>
              {fileName} · {rows.length} linhas
            </h3>
            <div className="mapping-grid">
              {fields.map((f) => (
                <Field label={f} key={f}>
                  <select
                    value={mapping[f] ?? ""}
                    onChange={(e) => {
                      setMapping({ ...mapping, [f]: e.target.value });
                      setReviewed(false);
                    }}
                  >
                    <option value="">Selecione a coluna</option>
                    {Object.keys(rows[0]).map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            {errors.length ? (
              <div className="error" role="alert">
                <strong>{errors.length} linha(s) precisam de ajuste.</strong>
                <ul>
                  {errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Prévia (primeiras 5)</th>
                        <th>Data</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 5).map((e) => (
                        <tr key={e.id}>
                          <td>{e.description}</td>
                          <td>{e.date}</td>
                          <td>{brl(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {duplicates > 0 && (
                  <p className="error">
                    {duplicates} possível(is) duplicata(s). Revise antes de
                    continuar.
                  </p>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={reviewed}
                    onChange={(e) => setReviewed(e.target.checked)}
                  />
                  Revisei os dados e as possíveis duplicatas.
                </label>
                <Button
                  disabled={!reviewed || busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (
                        await dispatch({
                          type: "import",
                          id: crypto.randomUUID(),
                          hash,
                          description: fileName,
                          entries: preview,
                        })
                      ) {
                        setRows([]);
                        setMessage("Importação concluída.");
                      }
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Importar {preview.length} lançamentos
                </Button>
              </>
            )}
          </>
        )}
        {s.imports.map((b) => (
          <div className="settings-row" key={b.id}>
            <div>
              <strong>{b.description}</strong>
              <p>{b.date}</p>
            </div>
            <Button
              secondary
              onClick={() => {
                if (
                  confirm(
                    "Desfazer este lote? Só é permitido se os registros não foram editados ou conciliados.",
                  )
                )
                  void dispatch({ type: "undoImport", id: b.id });
              }}
            >
              Desfazer lote
            </Button>
          </div>
        ))}
      </Section>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </>
  );
}
