"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, Plus, Trash, X } from "@phosphor-icons/react";
import { extractTextFromImage } from "@/lib/receiptOCR";
import { parseReceipt } from "@/lib/receiptParser";
import { insertReceiptWithItems } from "@/lib/localDb";
import { isValidISODate } from "@/lib/dates";
import { formatBRLFromCents, sumCents } from "@/lib/money";
import MoneyInput from "./MoneyInput";
import { Banner, Button, Field, IconButton, INPUT_CLASS } from "./ui";

export default function ReceiptUpload({ monthKey, onSuccess, onClose }) {
  const [step, setStep] = useState("upload");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [ocrResult, setOcrResult] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);

  // Dialogo nativo: foco preso dentro, Esc fecha e o fundo fica inerte
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function handleFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("O arquivo precisa ser uma imagem (JPG, PNG ou HEIC).");
      return;
    }
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    setError("");
  }

  async function handleProcessImage() {
    if (!image) return setError("Escolha uma imagem da nota primeiro.");
    setLoading(true);
    setError("");
    try {
      const ocrData = await extractTextFromImage(image);
      if (!ocrData.success) throw new Error(ocrData.error || "falha ao ler a imagem");
      setOcrResult(ocrData);
      setEditedData(parseReceipt(ocrData.text));
      setStep("review");
    } catch (err) {
      setError(`Não foi possível ler a nota: ${err.message}. Tente uma foto mais nítida e reta.`);
    } finally {
      setLoading(false);
    }
  }

  // Forma funcional do setState: duas chamadas no mesmo handler faziam spread do
  // editedData antigo e a segunda apagava o campo gravado pela primeira.
  function updateItem(index, patch) {
    setEditedData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        return { ...next, totalPriceCents: Math.round((next.unitPriceCents || 0) * (next.quantity || 0)) };
      }),
    }));
  }

  function removeItem(index) {
    setEditedData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  }

  function addItem() {
    setEditedData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { productName: "", quantity: 1, unitPriceCents: 0, totalPriceCents: 0, position: prev.items.length },
      ],
    }));
  }

  async function handleSaveReceipt() {
    setError("");
    if (!editedData.storeName?.trim()) return setError("Informe o nome da loja.");
    if (!isValidISODate(editedData.receiptDate)) return setError("Informe uma data válida para o recibo.");
    const items = editedData.items.filter((i) => i.productName.trim() && i.unitPriceCents > 0);

    setLoading(true);
    try {
      await insertReceiptWithItems(
        {
          month_key: monthKey,
          store_name: editedData.storeName.trim(),
          receipt_date: editedData.receiptDate,
          raw_text: editedData.rawText,
          confidence_score: ocrResult?.confidence ?? 0,
        },
        items.map((item, position) => ({
          product_name: item.productName.trim(),
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          total_price_cents: item.totalPriceCents,
          position,
        }))
      );
      onSuccess?.(items.length);
      onClose?.();
    } catch (err) {
      setError(`Não foi possível salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const total = editedData ? sumCents(editedData.items, "totalPriceCents") : 0;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="upload-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!loading) onClose?.();
      }}
      onClick={(e) => e.target === dialogRef.current && !loading && onClose?.()}
      className="m-auto w-[calc(100%-2rem)] max-w-xl overscroll-contain rounded-2xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/50 animate-rise"
      style={{ maxHeight: "calc(100dvh - 2rem)" }}
    >
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        {step === "review" && (
          <IconButton label="Voltar para a foto" onClick={() => setStep("upload")} disabled={loading}>
            <ArrowLeft size={18} aria-hidden="true" />
          </IconButton>
        )}
        <h2 id="upload-titulo" className="flex-1 text-base font-semibold">
          {step === "upload" ? "Ler nota fiscal" : "Conferir itens"}
        </h2>
        <IconButton label="Fechar" onClick={onClose} disabled={loading}>
          <X size={18} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="space-y-4 p-5">
        {error && <Banner>{error}</Banner>}

        {step === "upload" && (
          <>
            {imagePreview ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- preview em data URL local, next/image nao otimiza */}
                <img
                  src={imagePreview}
                  alt="Foto da nota fiscal escolhida"
                  width={640}
                  height={256}
                  className="h-64 w-full rounded-xl bg-surface-2 object-contain"
                />
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={loading}>
                  Trocar imagem
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  handleFileSelect(e.dataTransfer.files?.[0]);
                }}
                className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-[background-color,border-color] duration-150 ${
                  dragging ? "border-focus bg-primary-pale" : "border-line-strong hover:bg-surface-2"
                }`}
              >
                <Camera size={32} className="text-mute" aria-hidden="true" />
                <span className="text-sm font-medium">Tirar foto ou escolher imagem</span>
                <span className="text-[13px] text-mute">No computador, também dá para arrastar o arquivo aqui.</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="hidden"
              aria-label="Imagem da nota fiscal"
            />

            <p className="text-[13px] text-mute">
              A leitura roda no próprio navegador. A primeira vez demora mais porque baixa o modelo de leitura.
            </p>

            <Button className="w-full" onClick={handleProcessImage} disabled={!image || loading}>
              {loading ? "Lendo a nota..." : "Ler a nota"}
            </Button>
          </>
        )}

        {step === "review" && editedData && (
          <>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
              <Field label="Loja" htmlFor="recibo-loja">
                <input
                  id="recibo-loja"
                  autoComplete="off"
                  value={editedData.storeName}
                  onChange={(e) => setEditedData({ ...editedData, storeName: e.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Data" htmlFor="recibo-data">
                <input
                  id="recibo-data"
                  type="date"
                  value={editedData.receiptDate}
                  onChange={(e) => setEditedData({ ...editedData, receiptDate: e.target.value })}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  Itens <span className="num font-normal text-mute">({editedData.items.length})</span>
                </h3>
                <Button variant="ghost" size="sm" onClick={addItem}>
                  <Plus size={16} weight="bold" aria-hidden="true" />
                  Item
                </Button>
              </div>

              {editedData.items.length === 0 ? (
                <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-[13px] text-mute">
                  Nenhum item reconhecido. Adicione os itens manualmente.
                </p>
              ) : (
                <ul className="max-h-[40dvh] space-y-2 overflow-y-auto overscroll-contain pr-1">
                  {editedData.items.map((item, idx) => (
                    <li key={idx} className="grid grid-cols-[minmax(0,1fr)_4rem_7.5rem_auto] items-center gap-2 rounded-xl bg-surface-2 p-2">
                      <input
                        aria-label={`Produto ${idx + 1}`}
                        autoComplete="off"
                        placeholder="Produto"
                        value={item.productName}
                        onChange={(e) => updateItem(idx, { productName: e.target.value })}
                        className={`${INPUT_CLASS} h-10 text-sm`}
                      />
                      <input
                        aria-label={`Quantidade do produto ${idx + 1}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 1 })}
                        className={`${INPUT_CLASS} num h-10 px-2 text-sm`}
                      />
                      <MoneyInput
                        aria-label={`Preço unitário do produto ${idx + 1}`}
                        value={item.unitPriceCents}
                        onChange={(cents) => updateItem(idx, { unitPriceCents: Number(cents) || 0 })}
                        className="h-10 text-sm"
                      />
                      <IconButton label={`Remover produto ${idx + 1}`} variant="danger" onClick={() => removeItem(idx)}>
                        <Trash size={16} aria-hidden="true" />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-primary-pale px-3 py-2.5 text-primary-ink">
              <span className="text-sm">Total</span>
              <span className="num text-base font-semibold">{formatBRLFromCents(total)}</span>
            </div>

            <Button className="w-full" onClick={handleSaveReceipt} disabled={loading}>
              {loading ? "Salvando..." : "Salvar recibo"}
            </Button>
          </>
        )}
      </div>
    </dialog>
  );
}
