"use client";

import { useSyncExternalStore } from "react";
import Dashboard from "@/components/Dashboard";
import { Skeleton, ToastProvider } from "@/components/ui";

const subscribe = () => () => {};

export default function Home() {
  // false no servidor e na hidratacao, true depois. Os dados vivem no localStorage, entao
  // o painel so renderiza no navegador; assim o HTML do servidor nunca diverge do cliente.
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isClient) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col gap-4 px-4 py-6" aria-busy="true">
        <span className="sr-only">Carregando...</span>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </main>
    );
  }

  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}
