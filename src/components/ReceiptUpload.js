"use client";

import { useState, useRef } from "react";
import { extractTextFromImage } from "@/lib/receiptOCR";
import { parseReceipt } from "@/lib/receiptParser";
import { supabase } from "@/lib/supabaseClient";
import MoneyInput from "./MoneyInput";

export default function ReceiptUpload({ userId, monthKey, onSuccess, onClose }) {
  const [step, setStep] = useState("upload");
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ocrResult, setOcrResult] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const fileInputRef = useRef(null);

  function handleFileSelect(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem válida");
      return;
    }

    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    setError("");
  }

  async function handleProcessImage() {
    if (!image) {
      setError("Selecione uma imagem");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const ocrData = await extractTextFromImage(image);

      if (!ocrData.success) {
        throw new Error(ocrData.error || "Falha ao processar imagem");
      }

      const parsed = parseReceipt(ocrData.text);
      setOcrResult(ocrData);
      setEditedData(parsed);
      setStep("review");
    } catch (err) {
      setError("Erro ao processar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateItemField(index, field, value) {
    const updated = [...editedData.items];
    updated[index] = { ...updated[index], [field]: value };
    setEditedData({ ...editedData, items: updated });
  }

  function removeItem(index) {
    const updated = editedData.items.filter((_, i) => i !== index);
    setEditedData({ ...editedData, items: updated });
  }

  async function handleSaveReceipt() {
    setLoading(true);
    setError("");

    try {
      const { data: receiptData, error: receiptError } = await supabase
        .from("receipts")
        .insert({
          user_id: userId,
          month_key: monthKey,
          store_name: editedData.storeName,
          receipt_date: editedData.receiptDate,
          raw_text: editedData.rawText,
          confidence_score: ocrResult.confidence,
        })
        .select()
        .single();

      if (receiptError) throw receiptError;

      const itemsToInsert = editedData.items.map((item) => ({
        receipt_id: receiptData.id,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        total_price_cents: item.totalPriceCents,
        position: item.position,
      }));

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from("receipt_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-stone-900">
              {step === "upload" ? "📸 Upload da Nota Fiscal" : "✓ Revisar Extração"}
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 text-2xl"
            >
              ✕
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {step === "upload" && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:bg-stone-50 transition"
              >
                <p className="text-4xl mb-2">📷</p>
                <p className="font-medium text-stone-900">Clique para selecionar</p>
                <p className="text-sm text-stone-500">ou arraste uma imagem</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                className="hidden"
              />

              {imagePreview && (
                <div>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full rounded-lg max-h-64 object-cover"
                  />
                  <button
                    onClick={() => {
                      setImage(null);
                      setImagePreview("");
                    }}
                    className="text-stone-500 hover:text-stone-700 text-sm mt-2"
                  >
                    Trocar imagem
                  </button>
                </div>
              )}

              <button
                onClick={handleProcessImage}
                disabled={!image || loading}
                className="w-full bg-[#3D3D3D] text-white py-3 rounded-lg font-bold hover:bg-[#2C2C2C] transition disabled:opacity-60"
              >
                {loading ? "Processando..." : "Processar com OCR"}
              </button>
            </div>
          )}

          {step === "review" && editedData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-600">Loja</label>
                  <input
                    type="text"
                    value={editedData.storeName}
                    onChange={(e) =>
                      setEditedData({ ...editedData, storeName: e.target.value })
                    }
                    className="w-full border border-stone-300 rounded-lg p-2 text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-600">Data</label>
                  <input
                    type="date"
                    value={editedData.receiptDate}
                    onChange={(e) =>
                      setEditedData({ ...editedData, receiptDate: e.target.value })
                    }
                    className="w-full border border-stone-300 rounded-lg p-2 text-sm mt-1"
                  />
                </div>
              </div>

              <div>
                <h3 className="font-bold text-stone-900 mb-2 flex items-center gap-2">
                  📦 Itens ({editedData.items.length})
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {editedData.items.map((item, idx) => (
                    <div key={idx} className="bg-stone-50 p-3 rounded-lg space-y-2">
                      <input
                        type="text"
                        placeholder="Produto"
                        value={item.productName}
                        onChange={(e) => updateItemField(idx, "productName", e.target.value)}
                        className="w-full border border-stone-300 rounded p-1 text-xs"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          placeholder="Qtd"
                          value={item.quantity}
                          onChange={(e) => updateItemField(idx, "quantity", parseFloat(e.target.value) || 1)}
                          className="border border-stone-300 rounded p-1 text-xs"
                        />
                        <div>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Preço"
                            value={item.unitPriceCents > 0 ? (item.unitPriceCents / 100).toLocaleString("pt-BR") : ""}
                            onChange={(e) => {
                              const onlyNumbers = e.target.value.replace(/\D/g, "");
                              const cents = parseInt(onlyNumbers) || 0;
                              updateItemField(idx, "unitPriceCents", cents);
                              updateItemField(idx, "totalPriceCents", Math.round(cents * item.quantity));
                            }}
                            className="border border-stone-300 rounded p-1 text-xs w-full"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-red-600 hover:text-red-700 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-stone-100 p-3 rounded-lg">
                <p className="text-sm text-stone-700">
                  <strong>Total:</strong> R$ {(editedData.items.reduce((sum, item) => sum + item.totalPriceCents, 0) / 100).toFixed(2)}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setStep("upload")}
                  className="flex-1 bg-stone-200 text-stone-900 py-2 rounded-lg font-bold hover:bg-stone-300 transition"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSaveReceipt}
                  disabled={loading}
                  className="flex-1 bg-[#3D3D3D] text-white py-2 rounded-lg font-bold hover:bg-[#2C2C2C] transition disabled:opacity-60"
                >
                  {loading ? "Salvando..." : "Salvar Recibo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
