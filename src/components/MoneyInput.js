"use client";

import { useEffect, useState } from "react";

export default function MoneyInput({
  label,
  value,
  onChange,
  placeholder = "0,00",
  disabled = false,
  autoFocus = false,
  className = ""
}) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value !== undefined && value !== null && value !== "") {
      const cents = parseInt(value) || 0;
      setDisplayValue(formatCents(cents));
    } else {
      setDisplayValue("");
    }
  }, [value]);

  function formatCents(cents) {
    if (!cents) return "";
    const reais = Math.floor(cents / 100);
    const centavos = cents % 100;
    return `${reais.toLocaleString("pt-BR")},${String(centavos).padStart(2, "0")}`;
  }

  function handleChange(e) {
    const input = e.target.value;
    const onlyNumbers = input.replace(/\D/g, "");

    if (!onlyNumbers) {
      setDisplayValue("");
      onChange("");
      return;
    }

    const cents = parseInt(onlyNumbers) || 0;
    const formatted = formatCents(cents);
    setDisplayValue(formatted);
    onChange(cents);
  }

  return (
    <label className="block">
      {label && (
        <div className="text-xs font-medium text-stone-700 mb-1">{label}</div>
      )}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600 font-medium text-sm pointer-events-none">
          R$
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`w-full border border-stone-300 rounded-lg p-3 pl-10 text-sm focus:outline-none focus:border-stone-600 focus:ring-1 focus:ring-stone-600 transition disabled:bg-stone-100 disabled:text-stone-500 ${className}`}
        />
      </div>
    </label>
  );
}
