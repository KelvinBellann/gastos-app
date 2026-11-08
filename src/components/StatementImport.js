"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, FileArrowUp, ImagesSquare, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { insertExpenses, listAllExpenses } from "@/lib/localDb";
import { extractStatementText } from "@/lib/receiptOCR";
import { mergeStatementPages, parseStatementText, readBankFile } from "@/lib/statementParser";
import { buildStatementEntries, prepareStatementRows } from "@/lib/statementClassifier";
import { formatDatePT, isValidISODate } from "@/lib/dates";
import { totalsByCategory } from "@/lib/expenses";
import { formatBRLFromCents, sumCents } from "@/lib/money";
import MoneyInput from "./MoneyInput";
import { CATEGORIES, getCategory } from "./categories";
import { Banner, Button, ChoiceChip, Field, IconButton, INPUT_CLASS } from "./ui";

// Fixos aparecem em todos os meses; uma linha de extrato e um gasto de um dia so
const CATEGORY_OPTIONS = CATEGORIES.filter((c) => c.value !== "fixos");

const ACCOUNT_TYPES = [
  { value: "account", label: "Conta" },
  { value: "card", label: "Cartão de crédito" },
];

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

export default function StatementImport({ onImported, onClose }) {
  const [step, setStep] = useState("source");
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [ignoredIncoming, setIgnoredIncoming] = useState(0);
  const [accountType, setAccountType] = useState("account");
  const [editingId, setEditingId] = useState(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const dialogRef = useRef(null);
  const objectUrlsRef = useRef(new Set());

  const busy = Boolean(status);

  // Dialogo nativo: foco preso dentro, Esc fecha e o fundo fica inerte
  useEffect(() => {
    const dialog = dialogRef.current;
    const objectUrls = objectUrlsRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function addImages(fileList) {
    const files = [...(fileList || [])];
    if (files.length === 0) return;
    if (files.some((f) => !f.type.startsWith("image/"))) {
      setError("Escolha só imagens aqui. Arquivos do banco vão no botão abaixo.");
      return;
    }
    setError("");
    const added = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);
      return { url, file };
    });
    setImages((prev) => [...prev, ...added]);
  }

  function removeImage(url) {
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
    setImages((prev) => prev.filter((image) => image.url !== url));
  }

  async function startReview(transactions, type) {
    const prepared = prepareStatementRows(transactions, await listAllExpenses());
    if (prepared.rows.length === 0) {
      throw new Error(
        transactions.length > 0
          ? "Só encontrei entradas de dinheiro neste extrato, nenhum gasto."
          : "Não encontrei lançamentos neste extrato."
      );
    }
    setRows(prepared.rows);
    setIgnoredIncoming(prepared.ignoredIncoming);
    setAccountType(type);
    setEditingId(null);
    setStep("review");
  }

  async function handleReadImages() {
    setError("");
    try {
      const pages = [];
      for (const [index, image] of images.entries()) {
        setStatus(`Lendo imagem ${index + 1} de ${images.length}...`);
        const ocr = await extractStatementText(image.file);
        if (!ocr.success) throw new Error(ocr.error || "falha ao ler a imagem");
        pages.push(parseStatementText(ocr.text));
      }
      const type = pages.some((p) => p.accountType === "card") ? "card" : "account";
      await startReview(mergeStatementPages(pages.map((p) => p.transactions)), type);
    } catch (err) {
      setError(`Não foi possível ler o extrato: ${err.message} Tente uma foto mais nítida e reta.`);
    } finally {
      setStatus("");
    }
  }

  async function handleBankFile(file) {
    if (!file) return;
    setError("");
    setStatus("Lendo o arquivo...");
    try {
      const { transactions, accountType: type } = await readBankFile(file);
      await startReview(transactions, type);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Forma funcional do setState, como na conferencia da nota: varios campos mudam em sequencia
  function updateRow(id, patch) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const selected = rows.filter((row) => row.selected);
  const total = sumCents(selected);
  const summary = Object.entries(totalsByCategory(selected)).sort((a, b) => b[1] - a[1]);

  async function handleImport() {
    setError("");
    const invalid = selected.filter((row) => !row.description.trim() || !isValidISODate(row.date) || !(row.amount_cents > 0));
    if (invalid.length > 0) {
      setEditingId(invalid[0].id);
      setError(`${plural(invalid.length, "lançamento está", "lançamentos estão")} sem descrição, data ou valor.`);
      return;
    }
    setStatus("Importando...");
    try {
      onImported?.(await insertExpenses(buildStatementEntries(selected, accountType)));
    } catch (err) {
      setError(`Não foi possível importar: ${err.message}`);
      setStatus("");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="extrato-titulo"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose?.();
      }}
      onClick={(e) => e.target === dialogRef.current && !busy && onClose?.()}
      className="m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/50 animate-rise"
    >
      <div
        className="flex flex-col"
        style={{ maxHeight: "calc(100dvh - 2rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          {step === "review" && (
            <IconButton label="Voltar para a escolha do extrato" onClick={() => setStep("source")} disabled={busy}>
              <ArrowLeft size={18} aria-hidden="true" />
            </IconButton>
          )}
          <h2 id="extrato-titulo" className="flex-1 text-base font-semibold">
            {step === "source" ? "Importar extrato" : "Conferir lançamentos"}
          </h2>
          <IconButton label="Fechar" onClick={onClose} disabled={busy}>
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
          {error && <Banner>{error}</Banner>}

          {step === "source" && (
            <>
              <p className="text-[13px] text-mute">
                O app lê o extrato, separa em mercado, banco, assinaturas e outras categorias, e você confere antes de salvar.
                Nada sai do aparelho.
              </p>

              <section aria-labelledby="extrato-foto" className="space-y-3 rounded-xl bg-surface-2 p-4">
                <h3 id="extrato-foto" className="text-sm font-semibold">
                  Foto ou print do extrato
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => cameraInputRef.current?.click()} disabled={busy}>
                    <Camera size={18} aria-hidden="true" />
                    Tirar foto
                  </Button>
                  <Button variant="secondary" onClick={() => galleryInputRef.current?.click()} disabled={busy}>
                    <ImagesSquare size={18} aria-hidden="true" />
                    Escolher
                  </Button>
                </div>

                {images.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {images.map((image, index) => (
                      <li key={image.url} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- blob local, next/image nao otimiza */}
                        <img
                          src={image.url}
                          alt={`Imagem ${index + 1} do extrato`}
                          width={64}
                          height={80}
                          className="h-20 w-16 rounded-lg border border-line bg-surface object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remover imagem ${index + 1}`}
                          onClick={() => removeImage(image.url)}
                          disabled={busy}
                          className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-canvas"
                        >
                          <Trash size={13} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {images.length > 0 && (
                  <Button className="w-full" onClick={handleReadImages} disabled={busy}>
                    {status || `Ler ${plural(images.length, "imagem", "imagens")}`}
                  </Button>
                )}

                <p className="text-[13px] text-mute">
                  Extrato comprido pode ir em várias imagens. A primeira leitura precisa de internet para baixar o modelo.
                </p>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    addImages(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                  aria-label="Foto do extrato"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    addImages(e.target.files);
                    e.target.value = "";
                  }}
                  className="hidden"
                  aria-label="Imagens do extrato"
                />
              </section>

              <section aria-labelledby="extrato-arquivo" className="space-y-3 rounded-xl bg-surface-2 p-4">
                <h3 id="extrato-arquivo" className="text-sm font-semibold">
                  Arquivo do banco
                </h3>
                <p className="text-[13px] text-mute">No app do banco, exporte o extrato ou a fatura em OFX, CSV ou PDF.</p>
                <Button variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={busy}>
                  <FileArrowUp size={18} aria-hidden="true" />
                  {status === "Lendo o arquivo..." ? status : "Escolher arquivo"}
                </Button>
                {/* Sem accept de proposito: o iOS nao conhece .ofx e deixaria o arquivo cinza no seletor */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => handleBankFile(e.target.files?.[0])}
                  className="hidden"
                  aria-label="Arquivo do banco"
                />
              </section>
            </>
          )}

          {step === "review" && (
            <>
              {summary.length > 0 && (
                <section aria-label="Total por categoria" className="rounded-xl bg-primary-pale px-3 py-2.5 text-primary-ink">
                  <ul className="grid grid-cols-1 gap-x-5 gap-y-1 min-[420px]:grid-cols-2">
                    {summary.map(([value, cents]) => {
                      const { Icon, label } = getCategory(value);
                      return (
                        <li key={value} className="flex items-center gap-1.5 text-[13px]">
                          <Icon size={14} className="shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{label}</span>
                          <span className="num font-semibold">{formatBRLFromCents(cents)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium text-body">Este extrato é de</legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {ACCOUNT_TYPES.map(({ value, label }) => (
                    <ChoiceChip
                      key={value}
                      name="tipo-extrato"
                      value={value}
                      checked={accountType === value}
                      onChange={setAccountType}
                    >
                      {label}
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>

              {ignoredIncoming > 0 && (
                <p className="text-[13px] text-mute">
                  {plural(ignoredIncoming, "entrada de dinheiro ficou", "entradas de dinheiro ficaram")} de fora: só os gastos são
                  importados.
                </p>
              )}

              <ul className="space-y-2">
                {rows.map((row) => (
                  <li key={row.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        aria-label={`Importar ${row.description || "lançamento"}`}
                        checked={row.selected}
                        onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded accent-[var(--focus)]"
                      />
                      <div className={`min-w-0 flex-1 ${row.selected ? "" : "opacity-60"}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="min-w-0 flex-1 break-words text-sm font-medium">{row.description || "Sem descrição"}</span>
                          <span className="num shrink-0 text-sm font-semibold">{formatBRLFromCents(row.amount_cents)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="num shrink-0 text-xs text-mute">{formatDatePT(row.date)}</span>
                          <select
                            aria-label={`Categoria de ${row.description || "lançamento"}`}
                            value={row.category}
                            onChange={(e) => updateRow(row.id, { category: e.target.value })}
                            className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-ink"
                          >
                            {CATEGORY_OPTIONS.map(({ value, label }) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <IconButton
                            label={`Editar ${row.description || "lançamento"}`}
                            className="!h-8 !w-8"
                            aria-expanded={editingId === row.id}
                            onClick={() => setEditingId((id) => (id === row.id ? null : row.id))}
                          >
                            <PencilSimple size={15} aria-hidden="true" />
                          </IconButton>
                        </div>
                      </div>
                    </div>

                    {row.note && <p className="mt-1.5 pl-[1.875rem] text-xs font-medium text-warning-ink">{row.note}</p>}

                    {editingId === row.id && (
                      <div className="mt-3 grid grid-cols-2 gap-2 pl-[1.875rem]">
                        <Field label="Descrição" htmlFor={`extrato-desc-${row.id}`} className="col-span-2">
                          <input
                            id={`extrato-desc-${row.id}`}
                            autoComplete="off"
                            value={row.description}
                            onChange={(e) => updateRow(row.id, { description: e.target.value })}
                            className={`${INPUT_CLASS} h-10 text-sm`}
                          />
                        </Field>
                        <Field label="Data" htmlFor={`extrato-data-${row.id}`}>
                          <input
                            id={`extrato-data-${row.id}`}
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(row.id, { date: e.target.value })}
                            className={`${INPUT_CLASS} h-10 min-w-0 px-2 text-sm`}
                          />
                        </Field>
                        <Field label="Valor" htmlFor={`extrato-valor-${row.id}`}>
                          <MoneyInput
                            id={`extrato-valor-${row.id}`}
                            value={row.amount_cents}
                            onChange={(cents) => updateRow(row.id, { amount_cents: Number(cents) || 0 })}
                            className="h-10 text-sm"
                          />
                        </Field>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {step === "review" && (
          <div className="border-t border-line p-4">
            <Button className="w-full" onClick={handleImport} disabled={busy || selected.length === 0}>
              {status ||
                (selected.length === 0
                  ? "Nenhum gasto marcado"
                  : `Importar ${plural(selected.length, "gasto", "gastos")} · ${formatBRLFromCents(total)}`)}
            </Button>
          </div>
        )}
      </div>
    </dialog>
  );
}
