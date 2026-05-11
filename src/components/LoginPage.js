"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function validate() {
    setError("");
    if (!email.trim()) {
      setError("Digite seu email");
      return false;
    }
    if (password.length < 6) {
      setError("Senha deve ter pelo menos 6 caracteres");
      return false;
    }
    return true;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setSuccessMsg("✓ Conta criada! Confirme seu email ou faça login agora.");
    setPassword("");
    setLoading(false);
    setTimeout(() => {
      setMode("signin");
      setSuccessMsg("");
    }, 2000);
  }

  return (
    <div className="min-h-screen gradient-login flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full p-4 mb-4">
            <span className="text-4xl">💰</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Controle de Gastos</h1>
          <p className="text-sm text-gray-600 mt-2">Gerencie suas receitas e despesas</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setMode("signin");
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 rounded-md font-medium transition ${
              mode === "signin"
                ? "bg-white text-indigo-600 shadow"
                : "text-gray-600"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setSuccessMsg("");
            }}
            className={`flex-1 py-2 rounded-md font-medium transition ${
              mode === "signup"
                ? "bg-white text-indigo-600 shadow"
                : "text-gray-600"
            }`}
          >
            Criar conta
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition"
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition pr-10"
                disabled={loading}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition"
                disabled={loading}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl text-sm bg-green-50 text-green-700 border border-green-200">
              {successMsg}
            </div>
          )}

          {/* Button */}
          <button
            type="submit"
            disabled={loading || !email || password.length < 6}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold py-3 rounded-xl hover:shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Processando..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          {mode === "signin"
            ? "Não tem conta? Clique em Criar conta acima."
            : "Já tem conta? Clique em Entrar acima."}
        </p>
      </div>
    </div>
  );
}
