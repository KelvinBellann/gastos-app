"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, Camera, Receipt, Trash } from "@phosphor-icons/react";
import { deleteReceipt, listReceiptsWithItems, restoreRows } from "@/lib/localDb";
import { formatDatePT } from "@/lib/dates";
import { formatBRLFromCents, sumCents } from "@/lib/money";
import ReceiptUpload from "./ReceiptUpload";
import { Button, Card, CardHeader, EmptyState, useToast } from "./ui";

export default function ReceiptsTab({ monthKey, onError }) {
  const toast = useToast();
  const [receipts, setReceipts] = useState([]);
  const [itemsByReceipt, setItemsByReceipt] = useState({});
  const [showUpload, setShowUpload] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  async function loadReceipts() {
    try {
      // Itens de todos os recibos do mes de uma vez: carregando so ao expandir, os totais
      // por loja ficavam em R$ 0,00 ate abrir cada recibo
      const data = await listReceiptsWithItems(monthKey);
      setReceipts(data.receipts);
      setItemsByReceipt(data.itemsByReceipt);
    } catch (e) {
      onError?.(e.message);
    }
  }

  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega so ao trocar de mes
  }, [monthKey]);

  async function handleDelete(receipt) {
    try {
      const removed = await deleteReceipt(receipt.id);
      setExpandedId(null);
      await loadReceipts();
      toast({
        message: `Recibo de ${receipt.store_name} excluído.`,
        onAction: async () => {
          await restoreRows(removed);
          await loadReceipts();
        },
      });
    } catch (e) {
      onError?.(`Não foi possível excluir: ${e.message}`);
    }
  }

  const receiptTotal = (id) => sumCents(itemsByReceipt[id] || [], "total_price_cents");

  const totalSpent = receipts.reduce((s, r) => s + receiptTotal(r.id), 0);

  const storeStats = useMemo(() => {
    const stats = {};
    for (const r of receipts) {
      stats[r.store_name] ||= { count: 0, total: 0 };
      stats[r.store_name].count += 1;
      stats[r.store_name].total += sumCents(itemsByReceipt[r.id] || [], "total_price_cents");
    }
    return Object.entries(stats).sort((a, b) => b[1].total - a[1].total);
  }, [receipts, itemsByReceipt]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
      <div className="space-y-4 lg:col-span-5">
        <section aria-label="Resumo dos recibos" className="rounded-2xl bg-hero p-5 text-on-hero sm:p-6">
          <p className="text-sm text-on-hero-mute">Total em recibos</p>
          <p className="num mt-0.5 text-4xl font-semibold tracking-tight text-primary">{formatBRLFromCents(totalSpent)}</p>
          <p className="num mt-2 text-sm text-on-hero-mute">
            {receipts.length} {receipts.length === 1 ? "recibo" : "recibos"} em {storeStats.length}{" "}
            {storeStats.length === 1 ? "loja" : "lojas"}
          </p>
          <Button className="mt-5 w-full" onClick={() => setShowUpload(true)}>
            <Camera size={18} weight="bold" aria-hidden="true" />
            Ler nota fiscal
          </Button>
        </section>

        {storeStats.length > 0 && (
          <Card aria-labelledby="lojas-titulo">
            <CardHeader id="lojas-titulo" title="Lojas" />
            <ul className="divide-y divide-line">
              {storeStats.map(([store, s]) => (
                <li key={store} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate text-ink">{store}</span>
                  <span className="num text-xs text-mute">{s.count}x</span>
                  <span className="num w-24 text-right font-medium text-ink">{formatBRLFromCents(s.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Card aria-labelledby="recibos-titulo" className="lg:col-span-7">
        <CardHeader id="recibos-titulo" title="Recibos do mês" />
        {receipts.length === 0 ? (
          <EmptyState icon={Receipt} title="Nenhum recibo neste mês">
            Tire uma foto da nota fiscal em &quot;Ler nota fiscal&quot;. O texto é lido no próprio aparelho.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {receipts.map((receipt) => {
              const items = itemsByReceipt[receipt.id] || [];
              const open = expandedId === receipt.id;
              const panelId = `recibo-${receipt.id}`;
              return (
                <li key={receipt.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : receipt.id)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition-[background-color] duration-150 hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{receipt.store_name}</p>
                      <p className="num text-xs text-mute">
                        {formatDatePT(receipt.receipt_date)}, {items.length} {items.length === 1 ? "item" : "itens"}
                      </p>
                    </div>
                    <span className="num text-sm font-semibold text-ink">{formatBRLFromCents(receiptTotal(receipt.id))}</span>
                    <CaretDown
                      size={16}
                      aria-hidden="true"
                      className={`shrink-0 text-mute transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                    />
                  </button>

                  {open && (
                    <div id={panelId} className="mb-3 rounded-xl bg-surface-2 p-3">
                      {items.length === 0 ? (
                        <p className="text-[13px] text-mute">Recibo sem itens.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <caption className="sr-only">Itens do recibo de {receipt.store_name}</caption>
                          <thead className="sr-only">
                            <tr>
                              <th scope="col">Produto</th>
                              <th scope="col">Quantidade</th>
                              <th scope="col">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => (
                              <tr key={item.id}>
                                <td className="max-w-0 truncate py-1 pr-2 text-body">{item.product_name}</td>
                                <td className="num w-12 py-1 text-right text-xs text-mute">{item.quantity}x</td>
                                <td className="num w-24 py-1 text-right font-medium text-ink">
                                  {formatBRLFromCents(item.total_price_cents)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-line">
                              <th scope="row" colSpan={2} className="pt-2 text-left font-semibold">
                                Total
                              </th>
                              <td className="num pt-2 text-right font-semibold">{formatBRLFromCents(receiptTotal(receipt.id))}</td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(receipt)}>
                          <Trash size={16} aria-hidden="true" />
                          Excluir recibo
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {showUpload && (
        <ReceiptUpload
          monthKey={monthKey}
          onSuccess={(count) => {
            loadReceipts();
            toast({ message: `Recibo salvo com ${count} ${count === 1 ? "item" : "itens"}.` });
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
