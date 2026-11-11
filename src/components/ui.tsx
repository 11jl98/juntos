"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, ArrowUpRight, Wallet } from "lucide-react";
import type { Command, State } from "@/domain/types";
export type Dialog = {
  kind: string;
  id?: string;
  revision?: number;
  mode?: "subscription" | "purchase";
};
export type FinanceProps = {
  state: State;
  month: string;
  dispatch: (c: Command, expectedRevision?: number) => Promise<boolean>;
  open: (d: Dialog) => void;
  person?: string;
};
export function Button({
  children,
  onClick,
  secondary = false,
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`button ${secondary ? "secondary" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function Section({
  title,
  subtitle,
  children,
  action,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Empty({
  title = "Tudo pronto para começar",
  text = "Adicione os primeiros registros do casal.",
  onClick,
}: {
  title?: string;
  text?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <Wallet size={30} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onClick && (
        <Button onClick={onClick}>
          <Plus size={16} />
          Adicionar
        </Button>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Progress({
  value,
  color = "purple",
}: {
  value: number;
  color?: string;
}) {
  return (
    <div
      className={`progress ${color}`}
      role="progressbar"
      aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Fechar">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Metric({
  label,
  value,
  note,
  color = "purple",
  icon,
}: {
  label: string;
  value: string;
  note: string;
  color?: string;
  icon: ReactNode;
}) {
  return (
    <article className={`metric ${color}`}>
      <div className="metric-top">
        <span className="metric-icon">{icon}</span>
        <span>{label}</span>
        <ArrowUpRight size={16} />
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
export function Download({
  text,
  name,
  label = "Exportar CSV",
}: {
  text: string;
  name: string;
  label?: string;
}) {
  return (
    <Button
      secondary
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([text], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      {label}
    </Button>
  );
}
