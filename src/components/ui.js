"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle, Warning, X } from "@phosphor-icons/react";

// Classes compartilhadas. Um unico sistema de raio: cartao 2xl, campo e botao xl, chip full.
const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-sm whitespace-nowrap select-none " +
  "transition-[background-color,color,border-color,transform] duration-150 active:scale-[0.98] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";

const BUTTON_VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface-2 text-ink border border-line hover:border-line-strong hover:bg-surface",
  ghost: "text-body hover:text-ink hover:bg-surface-2",
  danger: "text-negative hover:bg-negative-pale",
};

const BUTTON_SIZES = {
  md: "h-11 px-4",
  sm: "h-9 px-3",
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...props }) {
  return (
    <button
      type={type}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...props}
    />
  );
}

// Botao so com icone: label obrigatorio, vira aria-label e title
export function IconButton({ label, children, variant = "ghost", className = "", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} h-9 w-9 shrink-0 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export const INPUT_CLASS =
  "w-full h-11 rounded-xl border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-mute " +
  "transition-[border-color] duration-150 hover:border-mute focus:border-focus focus:outline-none focus-visible:outline-2 " +
  "focus-visible:outline-offset-0 aria-[invalid=true]:border-negative disabled:opacity-60";

export function Field({ label, htmlFor, hint, error, children, className = "" }) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-body">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-mute">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ as: Tag = "section", flush = false, className = "", children, ...props }) {
  return (
    <Tag className={`rounded-2xl border border-line bg-surface ${flush ? "" : "p-4 sm:p-5"} ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, action, id }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Banner({ tone = "error", children, onDismiss }) {
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${
        isError ? "bg-negative-pale text-negative" : "bg-warning-pale text-warning-ink"
      }`}
    >
      <Warning size={18} weight="bold" aria-hidden="true" className="mt-px shrink-0" />
      <p className="min-w-0 flex-1 break-words">{children}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="-m-1 rounded-lg p-1 hover:bg-black/5"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-surface-2 px-4 py-8 text-center">
      {Icon && <Icon size={28} className="text-mute" aria-hidden="true" />}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-[40ch] text-[13px] text-mute">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-xl bg-surface-2 ${className}`} />;
}

// Radio com visual de chip. O input fica no DOM (sr-only) para teclado e leitor de tela.
export function ChoiceChip({ name, value, checked, onChange, children, className = "" }) {
  return (
    <label className={`relative cursor-pointer ${className}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <span
        className={`flex h-full items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[13px] font-medium transition-[background-color,border-color,color] duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
          checked
            ? "border-ink bg-ink text-canvas"
            : "border-line bg-surface text-body hover:border-line-strong hover:text-ink"
        }`}
      >
        {children}
      </span>
    </label>
  );
}

// ---------- Toast ----------

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  // { message, actionLabel?, onAction? }. Com acao (ex.: Desfazer) fica 6s, sem acao 3s.
  const show = useCallback((next) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ ...next, id });
    timer.current = setTimeout(() => setToast((t) => (t?.id === id ? null : t)), next.onAction ? 6000 : 3000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4"
        style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        {toast && (
          <div
            key={toast.id}
            role="status"
            className="animate-rise pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-hero py-2.5 pl-4 pr-2 text-sm text-on-hero shadow-soft"
          >
            <CheckCircle size={18} weight="fill" className="shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">{toast.message}</span>
            {toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction();
                  dismiss();
                }}
                className="rounded-lg px-2.5 py-1.5 font-semibold text-primary hover:bg-white/10"
              >
                {toast.actionLabel || "Desfazer"}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fechar notificação"
              className="rounded-lg p-1.5 text-on-hero-mute hover:bg-white/10 hover:text-on-hero"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast precisa estar dentro de ToastProvider");
  return show;
}
