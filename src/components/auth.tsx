"use client";
import { useState } from "react";
import { HeartHandshake, ArrowRight, ShieldCheck } from "lucide-react";
import { browserSupabase, configured } from "@/lib/supabase";
import { Button, Field } from "./ui";
export function Auth({
  onDemo,
  allowSignup = false,
  recovery = false,
  onRecovered,
}: {
  onDemo: () => void;
  allowSignup?: boolean;
  recovery?: boolean;
  onRecovered?: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/">
          <HeartHandshake size={32} />
          <span>
            juntos<span className="brand-period">.</span>
          </span>
        </a>
        <span className="eyebrow">FINANÇAS A DOIS</span>
        <h1>
          Os nossos planos.
          <br />O nosso dinheiro.
          <br />
          <em>O nosso futuro.</em>
        </h1>
        <p>
          Um espaço para organizar as contas, cuidar do presente e conquistar o
          que vocês sonham.
        </p>
        <div className="auth-visual">
          <span>contas em dia</span>
          <strong>
            + sonhos
            <br />
            compartilhados
          </strong>
          <span className="auth-heart">↗</span>
        </div>
        <small>
          <ShieldCheck size={16} />
          Um espaço privado. Duas pessoas. Tudo compartilhado.
        </small>
      </section>
      <section className="auth-form">
        <span className="pill purple">BEM-VINDOS AO JUNTOS</span>
        <h2>
          {recovery
            ? "Sua nova senha"
            : mode === "signup"
              ? "Comecem um novo capítulo"
              : mode === "reset"
                ? "Recuperar acesso"
                : "Que bom ter vocês aqui"}
        </h2>
        <p>
          {recovery
            ? "Defina uma senha segura para continuar."
            : mode === "signup"
              ? "Cada um terá seu acesso ao mesmo espaço."
              : "Entrem para cuidar dos planos de vocês."}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const client = browserSupabase();
              if (!client)
                throw new Error(
                  "Configure as variáveis do Supabase para usar contas reais. A demonstração está disponível abaixo.",
                );
              const f = new FormData(e.currentTarget),
                email = String(f.get("email") ?? ""),
                password = String(f.get("password") ?? "");
              let error;
              if (recovery) {
                ({ error } = await client.auth.updateUser({ password }));
                if (!error) onRecovered?.();
              } else if (mode === "login") {
                ({ error } = await client.auth.signInWithPassword({
                  email,
                  password,
                }));
              } else if (mode === "signup") {
                if (!allowSignup)
                  throw new Error(
                    "Novos cadastros exigem um convite do casal.",
                  );
                ({ error } = await client.auth.signUp({
                  email,
                  password,
                  options: { emailRedirectTo: window.location.origin },
                }));
                if (!error)
                  setMessage(
                    "Verifique seu e-mail para confirmar o cadastro. Depois, entre com sua senha.",
                  );
              } else {
                ({ error } = await client.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/?recover=1",
                }));
                if (!error)
                  setMessage(
                    "Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha.",
                  );
              }
              if (error) throw error;
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : "Não foi possível entrar.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {!recovery && (
            <Field label="Seu e-mail">
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@email.com"
              />
            </Field>
          )}
          {(mode !== "reset" || recovery) && (
            <Field label="Senha">
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={
                  recovery || mode === "signup"
                    ? "new-password"
                    : "current-password"
                }
                placeholder="Pelo menos 8 caracteres"
              />
            </Field>
          )}
          <Button type="submit" disabled={busy || !configured()}>
            {busy
              ? "Aguarde…"
              : recovery
                ? "Salvar nova senha"
                : mode === "signup"
                  ? "Criar minha conta"
                  : mode === "reset"
                    ? "Enviar link"
                    : "Entrar no nosso espaço"}
            <ArrowRight size={16} />
          </Button>
        </form>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
        {!configured() && (
          <p className="notice">
            O ambiente ainda não está conectado ao Supabase. Explore o app com
            dados fictícios.
          </p>
        )}
        {!recovery && (
          <>
            <div className="auth-switch">
              {allowSignup && (
                <button
                  className="text-button"
                  onClick={() => {
                    setMessage("");
                    setMode(mode === "signup" ? "login" : "signup");
                  }}
                >
                  {mode === "signup"
                    ? "Já tenho uma conta"
                    : "Criar uma conta pelo convite"}
                </button>
              )}
              <button
                className="text-button"
                onClick={() => {
                  setMessage("");
                  setMode(mode === "reset" ? "login" : "reset");
                }}
              >
                {mode === "reset"
                  ? "Voltar para entrar"
                  : "Esqueci minha senha"}
              </button>
            </div>
            <hr />
            <Button secondary onClick={onDemo}>
              Explorar demonstração
            </Button>
            <p className="form-note">
              Dados fictícios, sem cadastro e sem conexão com bancos.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
