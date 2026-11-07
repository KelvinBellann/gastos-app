"use client";

import { useId, useState } from "react";
import { INPUT_CLASS } from "./ui";

function formatCents(cents) {
  if (!cents) return "";
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  return `${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
}

function formatFromProp(value) {
  if (value === undefined || value === null || value === "") return "";
  return formatCents(parseInt(value) || 0);
}

// Campo de dinheiro que digita da direita para a esquerda: "1", "12", "1,23", "12,34".
// onChange recebe centavos (inteiro) ou "" quando o campo fica vazio.
export default function MoneyInput({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = "0,00",
  disabled = false,
  className = "",
  ...rest
}) {
  const autoId = useId();
  const inputId = id || autoId;
  const [displayValue, setDisplayValue] = useState(() => formatFromProp(value));
  const [prevValue, setPrevValue] = useState(value);

  // Estado derivado da prop no render (padrao "prop anterior"): o useEffect que copiava
  // value para displayValue era barrado pelo lint do React Compiler e atrasava um commit.
  // Comparacao com !== (nao Object.is) preserva a semantica do array de deps antigo.
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayValue(formatFromProp(value));
  }

  function handleChange(e) {
    const onlyNumbers = e.target.value.replace(/\D/g, "");

    if (!onlyNumbers) {
      setDisplayValue("");
      onChange("");
      return;
    }

    const cents = parseInt(onlyNumbers) || 0;
    setDisplayValue(formatCents(cents));
    onChange(cents);
  }

  const input = (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-mute"
      >
        R$
      </span>
      <input
        id={inputId}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`${INPUT_CLASS} num pl-10 ${className}`}
        {...rest}
      />
    </div>
  );

  if (!label) return input;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-medium text-body">
        {label}
      </label>
      {input}
    </div>
  );
}
