"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import LoginPage from "@/components/LoginPage";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data } = await supabase.auth.getSession();
        setSession(data?.session);
      } catch (err) {
        console.error("Erro ao verificar sessão:", err);
      } finally {
        setLoading(false);
      }
    }

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setSession(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-indigo-500 to-purple-500">
        <div className="text-white text-center">
          <div className="text-4xl mb-4">💰</div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return session ? (
    <Dashboard session={session} onSignOut={handleSignOut} />
  ) : (
    <LoginPage />
  );
}