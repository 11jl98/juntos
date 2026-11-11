"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  HeartHandshake,
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Target,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  RefreshCw,
  Menu,
  X,
  Download,
  WifiOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { browserSupabase } from "@/lib/supabase";
import { type State, type Command, stateSchema } from "@/domain/types";
import { applyCommand } from "@/domain/commands";
import { assertRevision } from "@/domain/revision";
import { demoState } from "@/domain/demo";
import { addMonths, today, monthLabel } from "@/domain/money";
import { Auth } from "./auth";
import { Overview } from "./overview";
import { Entries } from "./entries";
import { Cards } from "./cards";
import { Planning } from "./planning";
import { Reports } from "./reports";
import { Settings } from "./settings";
import { Forms } from "./forms";
import { Button, Field, type Dialog } from "./ui";
type Meta = {
  household: { id: string; name: string; created_by: string } | null;
  members?: { user_id: string; slot: string }[];
  slot?: string;
  updatedAt?: string;
  revision?: number;
  state?: State;
};
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const nav = [
  { id: "overview", name: "Visão geral", icon: LayoutDashboard },
  { id: "entries", name: "Lançamentos", icon: ArrowLeftRight },
  { id: "cards", name: "Cartões", icon: CreditCard },
  { id: "planning", name: "Planejamento", icon: Target },
  { id: "reports", name: "Relatórios", icon: ChartNoAxesCombined },
  { id: "settings", name: "Nosso espaço", icon: SettingsIcon },
];
export default function AppShell() {
  const [mode, setMode] = useState<"loading" | "auth" | "demo" | "live">(
      "loading",
    ),
    [user, setUser] = useState<User | null>(null),
    [state, setState] = useState<State | null>(null),
    [meta, setMeta] = useState<Meta>({ household: null }),
    [tab, setTab] = useState("overview"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [person, setPerson] = useState("all"),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [mobile, setMobile] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(true),
    [recovery, setRecovery] = useState(false),
    [install, setInstall] = useState<InstallPrompt | null>(null),
    [inviteToken, setInviteToken] = useState(""),
    [onboardingBusy, setOnboardingBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const lock = useRef(false),
    revision = useRef(0),
    userRef = useRef<string | null>(null),
    materializeAttempt = useRef("");
  const notify = useCallback(
    (text: string, error = false) => setToast({ text, error }),
    [],
  );
  const enterDemo = useCallback(() => {
    const m = today().slice(0, 7);
    setMode("demo");
    revision.current = 0;
    setState(demoState(m));
    setMonth(m);
    setMeta({ household: null });
    setTab("overview");
    setRecovery(false);
  }, []);
  async function api(path: string, body?: unknown) {
    const client = browserSupabase();
    const session = (await client?.auth.getSession())?.data.session;
    if (!session) throw new Error("Sessão expirada. Entre novamente.");
    const response = await fetch("/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Falha ao sincronizar.");
    return data;
  }
  const refresh = useCallback(async () => {
    const startUser = userRef.current;
    if (!startUser) return;
    const data: Meta = await api("finance");
    if (startUser !== userRef.current) return;
    if (data.state && (data.revision ?? 0) < revision.current) return;
    setMeta(data);
    setLoaded(true);
    revision.current = data.revision ?? 0;
    if (data.state) setState(stateSchema.parse(data.state));
    else setState(null);
  }, []);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const token = query.get("invite");
    if (token) {
      sessionStorage.setItem("juntos-invite", token);
      history.replaceState(null, "", location.pathname);
    }
    setInviteToken(token ?? sessionStorage.getItem("juntos-invite") ?? "");
    if (query.get("recover")) setRecovery(true);
    if (query.get("demo") === "1") {
      enterDemo();
      return;
    }
    const client = browserSupabase();
    if (!client) {
      setMode("auth");
      return;
    }
    void client.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      userRef.current = data.session?.user.id ?? null;
      setMode(data.session ? "live" : "auth");
    });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (userRef.current !== (session?.user.id ?? null)) {
        setLoaded(false);
        setState(null);
        revision.current = 0;
      }
      setUser(session?.user ?? null);
      userRef.current = session?.user.id ?? null;
      if (!session) {
        setState(null);
        setLoaded(false);
        setMeta({ household: null });
        setMode("auth");
      } else setMode("live");
    });
    return () => data.subscription.unsubscribe();
  }, [enterDemo]);
  useEffect(() => {
    if (mode === "live" && user) {
      void refresh().catch((e) => notify(e.message, true));
    }
  }, [mode, user, refresh, notify]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    const focus = () => {
      if (
        mode === "live" &&
        !lock.current &&
        document.visibilityState === "visible"
      )
        void refresh().catch((e) => notify(e.message, true));
    };
    window.addEventListener("focus", focus);
    const interval = setInterval(focus, 30000);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", prompt);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", focus);
      window.removeEventListener("beforeinstallprompt", prompt);
      clearInterval(interval);
    };
  }, [mode, refresh, notify]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(
      () => setToast(null),
      toast.error ? 12000 : 4000,
    );
    return () => clearTimeout(timeout);
  }, [toast]);
  async function dispatch(c: Command, expectedRevision?: number) {
    if (lock.current) return false;
    if (!online) {
      notify("Você está offline. Reconecte para salvar.", true);
      return false;
    }
    lock.current = true;
    setBusy(true);
    try {
      if (expectedRevision !== undefined)
        assertRevision(expectedRevision, revision.current);
      if (mode === "demo") {
        if (!state) return false;
        setState(applyCommand(state, c, "demo", today()));
        revision.current++;
      } else {
        await api("finance", {
          command: c,
          revision: revision.current,
          requestId: crypto.randomUUID(),
        });
        await refresh();
      }
      if (c.type !== "materialize")
        notify(
          mode === "demo"
            ? "Salvo na demonstração desta sessão."
            : "Salvo e compartilhado com vocês.",
        );
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : "Não foi possível salvar.", true);
      if (mode === "live") void refresh().catch(() => {});
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!state || busy || !online) return;
    const attemptKey = mode + ":" + month + ":" + revision.current;
    if (materializeAttempt.current === attemptKey) return;
    materializeAttempt.current = attemptKey;
    try {
      const materialized = applyCommand(
        state,
        { type: "materialize", month },
        "system",
        today(),
      );
      if (
        materialized.entries.length !== state.entries.length ||
        !state.budgets[month]
      )
        void dispatch({ type: "materialize", month });
    } catch (e) {
      notify(
        e instanceof Error
          ? e.message
          : "Não foi possível gerar as recorrências.",
        true,
      );
    }
  }, [state, month, busy, online]); // Changes are committed through the same revision gate.
  async function logout() {
    if (mode === "live") await browserSupabase()?.auth.signOut();
    setState(null);
    setMode("auth");
    setTab("overview");
    setToast(null);
  }
  if (mode === "loading")
    return (
      <div className="loading">
        <HeartHandshake size={42} />
        <p>Abrindo nosso espaço…</p>
      </div>
    );
  if (mode === "auth" || recovery)
    return (
      <>
        <Auth
          onDemo={enterDemo}
          recovery={recovery}
          onRecovered={() => {
            setRecovery(false);
            history.replaceState(null, "", "/");
            notify("Senha atualizada.");
          }}
        />
        {toast && (
          <div className="toast error" role="alert">
            {toast.text}
          </div>
        )}
      </>
    );
  if (mode === "live" && !loaded)
    return (
      <main className="loading">
        <HeartHandshake size={42} />
        <p>
          {toast?.error ? toast.text : "Carregando o espaço compartilhado…"}
        </p>
        {toast?.error && (
          <>
            <Button
              onClick={() =>
                void refresh().catch((e) => notify(e.message, true))
              }
            >
              Tentar novamente
            </Button>
            <Button secondary onClick={() => void logout()}>
              Sair
            </Button>
          </>
        )}
      </main>
    );
  if (mode === "live" && !state)
    return (
      <main className="onboarding">
        <a className="brand" href="/">
          <HeartHandshake />
          <span>juntos.</span>
        </a>
        <h1>Um espaço para vocês dois.</h1>
        <p>Crie o espaço do casal ou use o convite recebido.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setOnboardingBusy(true);
            try {
              await api(
                "household",
                inviteToken
                  ? { action: "join", token: inviteToken }
                  : {
                      action: "create",
                      name: String(f.get("name")),
                      names: [String(f.get("a")), String(f.get("b"))],
                    },
              );
              sessionStorage.removeItem("juntos-invite");
              setInviteToken("");
              await refresh();
            } catch (e) {
              notify(
                e instanceof Error ? e.message : "Não foi possível continuar.",
                true,
              );
            } finally {
              setOnboardingBusy(false);
            }
          }}
        >
          {inviteToken ? (
            <Field label="Código do convite">
              <input
                value={inviteToken}
                onChange={(e) => setInviteToken(e.target.value)}
                required
              />
            </Field>
          ) : (
            <>
              <Field label="Nome do espaço">
                <input
                  name="name"
                  defaultValue="Nosso lar"
                  required
                  maxLength={100}
                />
              </Field>
              <Field label="Seu nome">
                <input name="a" required maxLength={60} />
              </Field>
              <Field label="Nome do seu par">
                <input name="b" required maxLength={60} />
              </Field>
            </>
          )}
          <Button type="submit" disabled={onboardingBusy}>
            {onboardingBusy
              ? "Aguarde…"
              : inviteToken
                ? "Entrar no espaço compartilhado"
                : "Criar nosso espaço"}
          </Button>
        </form>
        <p>
          <button
            className="text-button"
            onClick={() => {
              const t = prompt("Cole o link ou o código do convite:");
              if (t) {
                try {
                  setInviteToken(new URL(t).searchParams.get("invite") ?? t);
                } catch {
                  setInviteToken(t);
                }
              }
            }}
          >
            Tenho um convite
          </button>
        </p>
        <Button secondary onClick={() => void logout()}>
          Sair
        </Button>
        {toast && (
          <p className="error" role="alert">
            {toast.text}
          </p>
        )}
      </main>
    );
  if (!state) return null;
  const props = {
    state,
    month,
    dispatch,
    open: (d: Dialog) => setDialog({ ...d, revision: revision.current }),
    person,
    onPersonChange: setPerson,
  };
  const changeMonth = (delta: number) =>
    setMonth(addMonths(month + "-01", delta).slice(0, 7));
  return (
    <div className="app-layout">
      {mobile && (
        <div className="nav-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setTab("overview");
          }}
        >
          <span className="brand-icon">
            <HeartHandshake size={26} />
          </span>
          <span>
            juntos<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="avatars">
            <span className="avatar">{state.names[0][0]}</span>
            <span className="avatar second">{state.names[1][0]}</span>
          </span>
          <div>
            <strong>{meta.household?.name ?? "Nosso lar"}</strong>
            <small>Nosso espaço compartilhado</small>
          </div>
        </div>
        <small className="nav-caption">NOSSO DIA A DIA</small>
        <nav aria-label="Navegação principal">
          {nav.map((n) => (
            <button
              key={n.id}
              className={tab === n.id ? "active" : ""}
              onClick={() => {
                setTab(n.id);
                setMobile(false);
                setDialog(null);
              }}
            >
              <n.icon size={20} />
              {n.name}
              {tab === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <HeartHandshake size={23} />
            <strong>
              Planos compartilhados.
              <br />
              Conquistas multiplicadas.
            </strong>
            <p>Um passo de cada vez, juntos.</p>
          </div>
          <button
            className="sidebar-link"
            onClick={() => {
              if (install) {
                void install
                  .prompt()
                  .then(() => install.userChoice)
                  .then(() => setInstall(null));
              } else
                notify(
                  "No celular, abra o menu do navegador e escolha “Adicionar à tela de início”. Requer HTTPS.",
                );
            }}
          >
            <Download size={17} />
            Instalar aplicativo
          </button>
          <button className="sidebar-link" onClick={() => void logout()}>
            <LogOut size={17} />
            {mode === "demo" ? "Sair da demonstração" : "Sair da conta"}
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir navegação"
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Nosso espaço <span>/</span>{" "}
              <strong>{nav.find((n) => n.id === tab)?.name}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <div className="month-picker">
              <button aria-label="Mês anterior" onClick={() => changeMonth(-1)}>
                <ChevronLeft size={16} />
              </button>
              <label>
                <span>{monthLabel(month)}</span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) setMonth(e.target.value);
                  }}
                  aria-label="Selecionar mês"
                />
              </label>
              <button aria-label="Próximo mês" onClick={() => changeMonth(1)}>
                <ChevronRight size={16} />
              </button>
            </div>
            <button
              className="icon-button sync-button"
              aria-label="Atualizar dados"
              disabled={busy}
              onClick={() =>
                mode === "live"
                  ? void refresh()
                      .then(() => notify("Dados atualizados."))
                      .catch((e) => notify(e.message, true))
                  : notify("Demonstração local: os dados estão atualizados.")
              }
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
            </button>
            <span className="avatar top-avatar">
              {state.names[meta.slot === "b" ? 1 : 0][0]}
            </span>
          </div>
        </header>
        {mode === "demo" && (
          <div className="demo-banner">
            <span>
              <strong>Demonstração</strong> · Dados fictícios. Alterações duram
              apenas nesta sessão.
            </span>
            <button onClick={() => void logout()}>
              Conectar meu espaço <ChevronRight size={14} />
            </button>
          </div>
        )}
        {!online && (
          <div className="offline-banner">
            <WifiOff size={17} />
            Sem conexão. Os dados podem estar desatualizados; salvamento
            indisponível.
          </div>
        )}
        <main className="content" aria-busy={busy}>
          {tab === "overview" && <Overview {...props} />}{" "}
          {tab === "entries" && <Entries {...props} />}{" "}
          {tab === "cards" && <Cards {...props} />}{" "}
          {tab === "planning" && <Planning {...props} />}{" "}
          {tab === "reports" && <Reports {...props} />}{" "}
          {tab === "settings" && (
            <Settings
              {...props}
              mode={mode}
              canInvite={
                mode === "demo" ||
                (meta.household?.created_by === user?.id &&
                  (meta.members?.length ?? 0) < 2)
              }
              invite={async (email) => {
                if (mode === "demo")
                  throw new Error(
                    "Entre em uma conta real para gerar um convite.",
                  );
                const data = await api("household", {
                  action: "invite",
                  email,
                });
                return `${location.origin}/?invite=${encodeURIComponent(data.result)}`;
              }}
            />
          )}
          <footer className="footer">
            <span>
              juntos. <span>Feito para os planos de vocês.</span>
            </span>
            <span>
              {mode === "demo"
                ? "Demonstração interativa"
                : meta.updatedAt
                  ? `Atualizado ${new Date(meta.updatedAt).toLocaleString("pt-BR")}`
                  : "Sincronizado"}
            </span>
          </footer>
        </main>
      </div>
      {dialog && (
        <Forms
          key={dialog.kind + dialog.id}
          {...props}
          dialog={dialog}
          onClose={() => setDialog(null)}
        />
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
          <button
            aria-label="Fechar aviso"
            className="icon-button"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
