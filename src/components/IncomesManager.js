"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import MoneyInput from "./MoneyInput";

function formatBRLFromCents(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function IncomesManager({ userId, monthKey, income, onUpdate }) {
  const [variableIncomes, setVariableIncomes] = useState([]);
  const [showAddVariable, setShowAddVariable] = useState(false);
  const [newVariable, setNewVariable] = useState({
    description: "",
    amount: 0,
    date_from: new Date().toISOString().split("T")[0],
    date_to: new Date().toISOString().split("T")[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadVariableIncomes();
  }, [monthKey]);

  async function loadVariableIncomes() {
    const { data, error: err } = await supabase
      .from("variable_incomes")
      .select("*")
      .eq("user_id", userId)
      .eq("month_key", monthKey)
      .order("date_from");

    if (!err) {
      setVariableIncomes(data || []);
    }
  }

  async function addVariableIncome() {
    setError("");

    if (!newVariable.description.trim()) {
      setError("Descrição é obrigatória");
      return;
    }

    if (!newVariable.amount || newVariable.amount <= 0) {
      setError("Valor deve ser maior que zero");
      return;
    }

    if (new Date(newVariable.date_from) > new Date(newVariable.date_to)) {
      setError("Data 'De' não pode ser maior que 'Para'");
      return;
    }

    setLoading(true);

    try {
      const { error: err } = await supabase.from("variable_incomes").insert({
        user_id: userId,
        month_key: monthKey,
        description: newVariable.description.trim(),
        amount_cents: newVariable.amount,
        date_from: newVariable.date_from,
        date_to: newVariable.date_to,
      });

      if (err) {
        setError(err.message);
      } else {
        setNewVariable({
          description: "",
          amount: 0,
          date_from: new Date().toISOString().split("T")[0],
          date_to: new Date().toISOString().split("T")[0],
        });
        setShowAddVariable(false);
        await loadVariableIncomes();
      }
    } finally {
      setLoading(false);
    }
  }

  async function deleteVariableIncome(id) {
    if (!window.confirm("Excluir esta receita variável?")) return;

    setLoading(true);

    try {
      const { error: err } = await supabase
        .from("variable_incomes")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
      } else {
        await loadVariableIncomes();
      }
    } finally {
      setLoading(false);
    }
  }

  const totalFixed =
    (income?.salary_net_cents || 0) +
    (income?.multibenefits_cents || 0) +
    (income?.food_cents || 0) +
    (income?.spouse_salary_cents || 0);

  const totalVariable = variableIncomes.reduce(
    (sum, v) => sum + (v.amount_cents || 0),
    0
  );

  const grandTotal = totalFixed + totalVariable;

  return (
    <div className="space-y-4">
      {/* Fixed Incomes */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <h3 className="text-lg font-bold text-stone-900 mb-1">
          📊 Receitas Fixas (Todo mês)
        </h3>
        <p className="text-xs text-stone-500 mb-3">
          Valores que se repetem mensalmente
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-stone-700 mb-1 block">
              Seu salário
            </label>
            <input
              type="text"
              value={
                income?.salary_net_cents
                  ? formatBRLFromCents(income.salary_net_cents)
                  : ""
              }
              onChange={(e) => {
                const onlyNumbers = e.target.value.replace(/\D/g, "");
                const cents = parseInt(onlyNumbers) || 0;
                onUpdate({ ...income, salary_net_cents: cents });
              }}
              placeholder="R$ 0,00"
              className="w-full border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-700 mb-1 block">
              Multibenefícios
            </label>
            <input
              type="text"
              value={
                income?.multibenefits_cents
                  ? formatBRLFromCents(income.multibenefits_cents)
                  : ""
              }
              onChange={(e) => {
                const onlyNumbers = e.target.value.replace(/\D/g, "");
                const cents = parseInt(onlyNumbers) || 0;
                onUpdate({ ...income, multibenefits_cents: cents });
              }}
              placeholder="R$ 0,00"
              className="w-full border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-700 mb-1 block">
              Alimentação
            </label>
            <input
              type="text"
              value={
                income?.food_cents
                  ? formatBRLFromCents(income.food_cents)
                  : ""
              }
              onChange={(e) => {
                const onlyNumbers = e.target.value.replace(/\D/g, "");
                const cents = parseInt(onlyNumbers) || 0;
                onUpdate({ ...income, food_cents: cents });
              }}
              placeholder="R$ 0,00"
              className="w-full border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-600"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-stone-700 mb-1 block">
              Salário esposa
            </label>
            <input
              type="text"
              value={
                income?.spouse_salary_cents
                  ? formatBRLFromCents(income.spouse_salary_cents)
                  : ""
              }
              onChange={(e) => {
                const onlyNumbers = e.target.value.replace(/\D/g, "");
                const cents = parseInt(onlyNumbers) || 0;
                onUpdate({ ...income, spouse_salary_cents: cents });
              }}
              placeholder="R$ 0,00"
              className="w-full border border-stone-300 rounded-lg p-2 text-sm focus:outline-none focus:border-stone-600"
            />
          </div>
        </div>

        <div className="mt-3 p-2 bg-stone-50 rounded-lg border border-stone-200">
          <p className="text-sm font-bold text-stone-700">
            Total Fixo: {formatBRLFromCents(totalFixed)}
          </p>
        </div>
      </div>

      {/* Variable Incomes */}
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              💰 Receitas Variáveis
            </h3>
            <p className="text-xs text-stone-500">Com período específico</p>
          </div>
          <button
            onClick={() => setShowAddVariable(!showAddVariable)}
            className="bg-[#3D3D3D] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[#2C2C2C] transition text-sm"
          >
            {showAddVariable ? "✕" : "+ Adicionar"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm mb-3">
            {error}
          </div>
        )}

        {showAddVariable && (
          <div className="bg-stone-50 p-3 rounded-lg mb-3 space-y-2 border border-stone-200">
            <input
              type="text"
              placeholder="Ex: Bônus, Freelance, etc"
              value={newVariable.description}
              onChange={(e) =>
                setNewVariable({ ...newVariable, description: e.target.value })
              }
              className="w-full border border-stone-300 rounded p-2 text-xs"
            />

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium text-stone-600">De</label>
                <input
                  type="date"
                  value={newVariable.date_from}
                  onChange={(e) =>
                    setNewVariable({
                      ...newVariable,
                      date_from: e.target.value,
                    })
                  }
                  className="w-full border border-stone-300 rounded p-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-600">Para</label>
                <input
                  type="date"
                  value={newVariable.date_to}
                  onChange={(e) =>
                    setNewVariable({ ...newVariable, date_to: e.target.value })
                  }
                  className="w-full border border-stone-300 rounded p-1 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-stone-600">
                  Valor
                </label>
                <input
                  type="text"
                  placeholder="0,00"
                  value={
                    newVariable.amount > 0
                      ? (newVariable.amount / 100).toFixed(2)
                      : ""
                  }
                  onChange={(e) => {
                    const onlyNumbers = e.target.value.replace(/\D/g, "");
                    const cents = parseInt(onlyNumbers) || 0;
                    setNewVariable({ ...newVariable, amount: cents });
                  }}
                  className="w-full border border-stone-300 rounded p-1 text-xs"
                />
              </div>
            </div>

            <button
              onClick={addVariableIncome}
              disabled={loading}
              className="w-full bg-[#4A7C59] text-white py-1.5 rounded font-bold hover:bg-[#3D6A4A] transition disabled:opacity-60 text-sm"
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}

        {variableIncomes.length === 0 ? (
          <p className="text-stone-500 text-sm py-2">
            Nenhuma receita variável
          </p>
        ) : (
          <div className="space-y-2">
            {variableIncomes.map((v) => (
              <div
                key={v.id}
                className="flex justify-between items-center p-2 bg-stone-50 rounded border border-stone-200"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 text-sm">
                    {v.description}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(v.date_from).toLocaleDateString("pt-BR")} até{" "}
                    {new Date(v.date_to).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="text-right ml-2">
                  <p className="font-bold text-stone-900 text-sm">
                    {formatBRLFromCents(v.amount_cents)}
                  </p>
                  <button
                    onClick={() => deleteVariableIncome(v.id)}
                    className="text-red-600 hover:text-red-700 text-xs"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {variableIncomes.length > 0 && (
          <div className="mt-3 p-2 bg-stone-50 rounded-lg border border-stone-200">
            <p className="text-sm font-bold text-stone-700">
              Total Variável: {formatBRLFromCents(totalVariable)}
            </p>
          </div>
        )}
      </div>

      {/* Grand Total */}
      <div className="bg-gradient-to-r from-[#EDF4F0] to-[#F4EDEE] rounded-2xl border border-stone-200 p-4">
        <p className="text-sm text-stone-600 mb-1">Total de Receitas</p>
        <p className="text-2xl font-bold text-stone-900">
          {formatBRLFromCents(grandTotal)}
        </p>
        <div className="text-xs text-stone-500 mt-2 space-y-1">
          <p>Fixas: {formatBRLFromCents(totalFixed)}</p>
          <p>Variáveis: {formatBRLFromCents(totalVariable)}</p>
        </div>
      </div>
    </div>
  );
}
