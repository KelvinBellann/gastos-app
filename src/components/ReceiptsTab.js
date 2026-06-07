"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import ReceiptUpload from "./ReceiptUpload";

function formatBRLFromCents(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDatePT(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
}

export default function ReceiptsTab({ userId, monthKey }) {
  const [receipts, setReceipts] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [receiptItems, setReceiptItems] = useState({});

  async function loadReceipts() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("receipts")
        .select("*")
        .eq("user_id", userId)
        .eq("month_key", monthKey)
        .order("receipt_date", { ascending: false });

      setReceipts(data || []);
    } finally {
      setLoading(false);
    }
  }

  async function loadReceiptItems(receiptId) {
    if (receiptItems[receiptId]) return;

    const { data } = await supabase
      .from("receipt_items")
      .select("*")
      .eq("receipt_id", receiptId)
      .order("position");

    setReceiptItems((prev) => ({ ...prev, [receiptId]: data || [] }));
  }

  async function deleteReceipt(receiptId) {
    if (!window.confirm("Deletar este recibo?")) return;

    try {
      await supabase.from("receipt_items").delete().eq("receipt_id", receiptId);
      await supabase.from("receipts").delete().eq("id", receiptId);
      await loadReceipts();
    } catch (err) {
      console.error("Erro ao deletar:", err);
    }
  }

  useEffect(() => {
    loadReceipts();
  }, [monthKey]);

  const totalSpent = useMemo(() => {
    return receipts.reduce((sum, r) => {
      const items = receiptItems[r.id] || [];
      return sum + items.reduce((s, i) => s + (i.total_price_cents || 0), 0);
    }, 0);
  }, [receipts, receiptItems]);

  const storeStats = useMemo(() => {
    const stats = {};
    receipts.forEach((receipt) => {
      if (!stats[receipt.store_name]) {
        stats[receipt.store_name] = { count: 0, total: 0 };
      }
      stats[receipt.store_name].count += 1;
      const items = receiptItems[receipt.id] || [];
      const subtotal = items.reduce((s, i) => s + (i.total_price_cents || 0), 0);
      stats[receipt.store_name].total += subtotal;
    });
    return stats;
  }, [receipts, receiptItems]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setShowUpload(true)}
          className="flex-1 bg-[#3D3D3D] text-white py-3 rounded-lg font-bold hover:bg-[#2C2C2C] transition flex items-center justify-center gap-2"
        >
          📸 Novo Recibo
        </button>
      </div>

      {receipts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center">
          <p className="text-stone-500">Nenhum recibo cadastrado neste mês</p>
          <p className="text-xs text-stone-400 mt-2">
            Clique em "Novo Recibo" para começar
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#EDF4F0] border border-stone-200 rounded-xl p-3 text-center">
              <p className="text-xs text-stone-600 mb-1">Recibos</p>
              <p className="text-lg font-bold text-[#2D5F45]">{receipts.length}</p>
            </div>
            <div className="bg-[#F4EDEE] border border-stone-200 rounded-xl p-3 text-center">
              <p className="text-xs text-stone-600 mb-1">Total Gasto</p>
              <p className="text-lg font-bold text-[#7A3030]">
                {formatBRLFromCents(totalSpent)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-stone-100 p-4">
            <h3 className="font-bold text-stone-900 mb-3">🏪 Lojas</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(storeStats).map(([store, stats]) => (
                <div
                  key={store}
                  className="bg-stone-50 p-3 rounded-lg border border-stone-200"
                >
                  <p className="text-xs font-medium text-stone-600 truncate">
                    {store}
                  </p>
                  <p className="text-sm font-bold text-stone-900 mt-1">
                    {stats.count}x
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatBRLFromCents(stats.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="bg-white rounded-xl border border-stone-100">
                <button
                  onClick={() => {
                    setExpandedId(expandedId === receipt.id ? null : receipt.id);
                    loadReceiptItems(receipt.id);
                  }}
                  className="w-full p-4 flex items-center justify-between hover:bg-stone-50 transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-stone-900 truncate">
                      {receipt.store_name}
                    </p>
                    <p className="text-xs text-stone-500 mt-1">
                      {formatDatePT(receipt.receipt_date)}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-bold text-stone-900">
                      {formatBRLFromCents(
                        (receiptItems[receipt.id] || []).reduce(
                          (sum, i) => sum + (i.total_price_cents || 0),
                          0
                        )
                      )}
                    </p>
                    <p className="text-xs text-stone-500">
                      {(receiptItems[receipt.id] || []).length} itens
                    </p>
                  </div>
                  <div className="ml-2 text-stone-400">
                    {expandedId === receipt.id ? "▼" : "▶"}
                  </div>
                </button>

                {expandedId === receipt.id && (
                  <div className="border-t border-stone-100 p-4 space-y-2">
                    {(receiptItems[receipt.id] || []).map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-stone-700 flex-1 truncate">
                          {item.product_name}
                        </span>
                        <span className="text-stone-500 text-xs ml-2">
                          x{item.quantity}
                        </span>
                        <span className="font-bold text-stone-900 ml-2 min-w-max">
                          {formatBRLFromCents(item.total_price_cents)}
                        </span>
                      </div>
                    ))}

                    <div className="border-t border-stone-200 pt-2 mt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span>
                        {formatBRLFromCents(
                          (receiptItems[receipt.id] || []).reduce(
                            (sum, i) => sum + (i.total_price_cents || 0),
                            0
                          )
                        )}
                      </span>
                    </div>

                    <button
                      onClick={() => deleteReceipt(receipt.id)}
                      className="w-full text-red-600 hover:text-red-700 text-sm font-medium mt-2 py-1"
                    >
                      🗑️ Deletar Recibo
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {showUpload && (
        <ReceiptUpload
          userId={userId}
          monthKey={monthKey}
          onSuccess={() => loadReceipts()}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
