"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { normalizeProductName } from "@/lib/receiptParser";

function formatBRLFromCents(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function StoreComparison({ userId, monthKey }) {
  const [receipts, setReceipts] = useState([]);
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStores, setSelectedStores] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [receiptsRes, itemsRes] = await Promise.all([
        supabase
          .from("receipts")
          .select("*")
          .eq("user_id", userId)
          .eq("month_key", monthKey),
        supabase
          .from("receipt_items")
          .select("*")
          .eq("receipts(user_id)", userId)
          .eq("receipts(month_key)", monthKey),
      ]);

      const receiptsData = receiptsRes.data || [];
      setReceipts(receiptsData);
      setStores([...new Set(receiptsData.map((r) => r.store_name))]);

      if (receiptsRes.data && receiptsRes.data.length > 0) {
        const receiptIds = receiptsData.map((r) => r.id);
        const { data: allItems } = await supabase
          .from("receipt_items")
          .select("*")
          .in("receipt_id", receiptIds);

        setItems(allItems || []);

        if (selectedStores.length === 0 && receiptsData.length > 0) {
          setSelectedStores([receiptsData[0].store_name]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [monthKey]);

  const comparisonData = useMemo(() => {
    if (selectedStores.length === 0) return { products: [], storePrices: {} };

    const receiptsByStore = {};
    receipts.forEach((receipt) => {
      if (selectedStores.includes(receipt.store_name)) {
        if (!receiptsByStore[receipt.store_name]) {
          receiptsByStore[receipt.store_name] = [];
        }
        receiptsByStore[receipt.store_name].push(receipt.id);
      }
    });

    const productMap = {};

    items.forEach((item) => {
      const receiptId = item.receipt_id;
      const receipt = receipts.find((r) => r.id === receiptId);

      if (!receipt || !selectedStores.includes(receipt.store_name)) return;

      const normalized = normalizeProductName(item.product_name);
      if (!normalized) return;

      if (!productMap[normalized]) {
        productMap[normalized] = {};
      }

      if (!productMap[normalized][receipt.store_name]) {
        productMap[normalized][receipt.store_name] = [];
      }

      productMap[normalized][receipt.store_name].push({
        price: item.unit_price_cents,
        total: item.total_price_cents,
      });
    });

    const products = Object.entries(productMap)
      .map(([name, storePrices]) => {
        const avgsByStore = {};
        let minPrice = Infinity;
        let bestStore = "";

        Object.entries(storePrices).forEach(([store, prices]) => {
          const avg = Math.round(
            prices.reduce((sum, p) => sum + p.price, 0) / prices.length
          );
          avgsByStore[store] = avg;
          if (avg < minPrice) {
            minPrice = avg;
            bestStore = store;
          }
        });

        return {
          name,
          storePrices: avgsByStore,
          bestStore,
          minPrice,
        };
      })
      .sort((a, b) => b.minPrice - a.minPrice);

    return { products, selectedStores };
  }, [selectedStores, receipts, items]);

  const storeStats = useMemo(() => {
    const stats = {};
    selectedStores.forEach((store) => {
      const storeReceipts = receipts.filter((r) => r.store_name === store);
      const totalItems = items.filter((item) => {
        const receipt = receipts.find((r) => r.id === item.receipt_id);
        return receipt && receipt.store_name === store;
      });

      const total = totalItems.reduce((sum, item) => sum + item.total_price_cents, 0);
      stats[store] = {
        receipts: storeReceipts.length,
        items: totalItems.length,
        total,
      };
    });
    return stats;
  }, [selectedStores, receipts, items]);

  if (loading) {
    return <div className="text-center py-8 text-stone-500">Carregando...</div>;
  }

  if (stores.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center">
        <p className="text-stone-500">Nenhum recibo para comparar</p>
        <p className="text-xs text-stone-400 mt-2">
          Envie recibos na aba anterior para ver comparações
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-stone-100 p-4">
        <h3 className="font-bold text-stone-900 mb-3">🏪 Selecione as lojas</h3>
        <div className="flex flex-wrap gap-2">
          {stores.map((store) => (
            <button
              key={store}
              onClick={() => {
                if (selectedStores.includes(store)) {
                  setSelectedStores(
                    selectedStores.filter((s) => s !== store)
                  );
                } else {
                  setSelectedStores([...selectedStores, store]);
                }
              }}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition ${
                selectedStores.includes(store)
                  ? "bg-[#3D3D3D] text-white"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {store}
            </button>
          ))}
        </div>
      </div>

      {selectedStores.length > 0 && (
        <>
          <div className="grid gap-2">
            {selectedStores.map((store) => (
              <div
                key={store}
                className="bg-stone-50 border border-stone-200 rounded-lg p-3"
              >
                <p className="text-sm font-bold text-stone-900">{store}</p>
                <div className="flex justify-between text-xs text-stone-600 mt-1">
                  <span>{storeStats[store]?.receipts || 0} recibos</span>
                  <span>
                    {formatBRLFromCents(storeStats[store]?.total || 0)} total
                  </span>
                </div>
              </div>
            ))}
          </div>

          {comparisonData.products.length > 0 ? (
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
              <div className="p-4 border-b border-stone-200">
                <h3 className="font-bold text-stone-900">
                  📊 Comparação de Preços ({comparisonData.products.length}{" "}
                  produtos)
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="text-left p-3 font-bold text-stone-900">
                        Produto
                      </th>
                      {selectedStores.map((store) => (
                        <th
                          key={store}
                          className="text-right p-3 font-bold text-stone-900 whitespace-nowrap"
                        >
                          {store}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonData.products.map((product) => (
                      <tr
                        key={product.name}
                        className="border-b border-stone-100 hover:bg-stone-50 transition"
                      >
                        <td className="p-3 text-stone-900 font-medium">
                          {product.name}
                        </td>
                        {selectedStores.map((store) => {
                          const price = product.storePrices[store];
                          const isBest =
                            product.bestStore === store && price !== undefined;
                          return (
                            <td
                              key={store}
                              className={`p-3 text-right font-bold whitespace-nowrap ${
                                isBest ? "bg-green-50 text-green-700" : ""
                              }`}
                            >
                              {price !== undefined
                                ? formatBRLFromCents(price)
                                : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-stone-50 border-t border-stone-200">
                <p className="text-xs text-stone-600">
                  🟢 Melhor preço | Preços são unitários (primeira compra detectada)
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center">
              <p className="text-stone-500 text-sm">
                Nenhum produto encontrado para comparar
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
