"use client";

import { useEffect, useMemo, useState } from "react";
import { Scales } from "@phosphor-icons/react";
import { listReceiptsWithItems } from "@/lib/localDb";
import { normalizeProductName } from "@/lib/receiptParser";
import { formatBRLFromCents, sumCents } from "@/lib/money";
import { Card, CardHeader, EmptyState } from "./ui";

export default function StoreComparison({ monthKey }) {
  const [receipts, setReceipts] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const data = await listReceiptsWithItems(monthKey);
      const storeNames = [...new Set(data.receipts.map((r) => r.store_name))];
      setReceipts(data.receipts);
      setItems(Object.values(data.itemsByReceipt).flat());
      // Forma funcional: mantem as lojas que existem no mes novo; sem nenhuma, seleciona ate duas
      setSelectedStores((prev) => {
        const kept = prev.filter((s) => storeNames.includes(s));
        return kept.length > 0 ? kept : storeNames.slice(0, 2);
      });
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega so ao trocar de mes
  }, [monthKey]);

  const stores = useMemo(() => [...new Set(receipts.map((r) => r.store_name))], [receipts]);
  const storeByReceipt = useMemo(() => Object.fromEntries(receipts.map((r) => [r.id, r.store_name])), [receipts]);

  const products = useMemo(() => {
    const map = {};
    for (const item of items) {
      const store = storeByReceipt[item.receipt_id];
      if (!store || !selectedStores.includes(store)) continue;
      const name = normalizeProductName(item.product_name);
      if (!name) continue;
      ((map[name] ||= {})[store] ||= []).push(item.unit_price_cents);
    }
    return Object.entries(map)
      .map(([name, byStore]) => {
        const avg = {};
        let bestStore = "";
        let minPrice = Infinity;
        for (const [store, prices] of Object.entries(byStore)) {
          avg[store] = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
          if (avg[store] < minPrice) {
            minPrice = avg[store];
            bestStore = store;
          }
        }
        // So destaca o melhor preco quando o produto aparece em mais de uma loja
        return { name, avg, bestStore: Object.keys(avg).length > 1 ? bestStore : "", stores: Object.keys(avg).length };
      })
      .sort((a, b) => b.stores - a.stores || a.name.localeCompare(b.name, "pt-BR"));
  }, [items, storeByReceipt, selectedStores]);

  const storeTotals = useMemo(() => {
    const totals = {};
    for (const store of selectedStores) {
      const ids = new Set(receipts.filter((r) => r.store_name === store).map((r) => r.id));
      totals[store] = {
        receipts: ids.size,
        total: sumCents(items.filter((i) => ids.has(i.receipt_id)), "total_price_cents"),
      };
    }
    return totals;
  }, [selectedStores, receipts, items]);

  function toggleStore(store) {
    setSelectedStores((prev) => (prev.includes(store) ? prev.filter((s) => s !== store) : [...prev, store]));
  }

  if (error) {
    return <p role="alert" className="text-sm text-negative">{error}</p>;
  }

  if (stores.length === 0) {
    return (
      <Card>
        <EmptyState icon={Scales} title="Nada para comparar neste mês">
          A comparação usa os itens dos recibos. Leia notas de pelo menos duas lojas na aba Recibos.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card aria-labelledby="comparar-lojas-titulo">
        <CardHeader
          id="comparar-lojas-titulo"
          title="Lojas na comparação"
          description="Preço unitário médio de cada produto nas compras do mês."
        />
        <div role="group" aria-label="Lojas" className="flex flex-wrap gap-1.5">
          {stores.map((store) => {
            const on = selectedStores.includes(store);
            return (
              <button
                key={store}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStore(store)}
                className={`h-9 max-w-full truncate rounded-full px-3.5 text-[13px] font-medium transition-[background-color,color] duration-150 ${
                  on ? "bg-ink text-canvas" : "bg-surface-2 text-body hover:text-ink"
                }`}
              >
                {store}
              </button>
            );
          })}
        </div>

        {selectedStores.length > 0 && (
          <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selectedStores.map((store) => (
              <div key={store} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="truncate text-[13px] text-body">{store}</dt>
                <dd className="num mt-0.5 flex items-baseline justify-between gap-2">
                  <span className="text-base font-semibold text-ink">{formatBRLFromCents(storeTotals[store]?.total)}</span>
                  <span className="text-xs text-mute">
                    {storeTotals[store]?.receipts} {storeTotals[store]?.receipts === 1 ? "recibo" : "recibos"}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {selectedStores.length === 0 ? (
        <p className="text-sm text-mute">Selecione ao menos uma loja.</p>
      ) : (
        <Card aria-labelledby="comparar-precos-titulo" flush className="overflow-hidden">
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardHeader
              id="comparar-precos-titulo"
              title="Preços"
              description={`${products.length} ${products.length === 1 ? "produto" : "produtos"}. O menor preço aparece destacado.`}
            />
          </div>
          {products.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState title="Nenhum produto nos recibos dessas lojas" />
            </div>
          ) : (
            <div className="relative overflow-x-auto" role="region" aria-label="Tabela de preços" tabIndex={0}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-line bg-surface-2 text-xs text-mute">
                    <th scope="col" className="sticky left-0 bg-surface-2 px-4 py-2.5 text-left font-medium sm:px-5">
                      Produto
                    </th>
                    {selectedStores.map((store) => (
                      <th key={store} scope="col" className="max-w-40 truncate px-4 py-2.5 text-right font-medium">
                        {store}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {products.map((p) => (
                    <tr key={p.name}>
                      <th
                        scope="row"
                        className="sticky left-0 max-w-[12rem] truncate bg-surface px-4 py-2.5 text-left font-medium capitalize text-ink sm:px-5"
                      >
                        {p.name}
                      </th>
                      {selectedStores.map((store) => {
                        const price = p.avg[store];
                        const best = p.bestStore === store;
                        return (
                          <td key={store} className="num whitespace-nowrap px-4 py-2.5 text-right">
                            {price === undefined ? (
                              <span className="text-mute" aria-label="sem registro">
                                -
                              </span>
                            ) : (
                              <span
                                className={best ? "rounded-full bg-primary-pale px-2 py-0.5 font-semibold text-primary-ink" : "text-ink"}
                              >
                                {formatBRLFromCents(price)}
                                {best && <span className="sr-only"> (menor preço)</span>}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
