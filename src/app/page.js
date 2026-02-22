"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    setBusy(false);
  }

  async function signUp() {
    setBusy(true);
    setMsg("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else setMsg("Conta criada. Se pedir confirmação por e-mail, confirme e depois faça login.");
    setBusy(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  if (session) {
    return <Dashboard session={session} onSignOut={signOut} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-semibold">Controle de Gastos</h1>
        <p className="text-sm text-gray-600 mt-1">Login para acessar seus dados.</p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
          />
          <input
            className="w-full border rounded-xl p-3"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />

          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

          <div className="flex gap-2">
            <button
              onClick={signIn}
              disabled={busy}
              className="flex-1 rounded-xl bg-black text-white p-3 disabled:opacity-60"
            >
              Entrar
            </button>
            <button
              onClick={signUp}
              disabled={busy}
              className="flex-1 rounded-xl border p-3 disabled:opacity-60"
            >
              Criar conta
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}