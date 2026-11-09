"use client";

import { useEffect, useRef } from "react";
import { DownloadSimple, UploadSimple, X } from "@phosphor-icons/react";
import { Button, IconButton } from "./ui";

export default function BackupDialog({ onExport, onImport, onClose }) {
  const dialogRef = useRef(null);

  // Dialogo nativo: foco preso dentro, Esc fecha e o fundo fica inerte
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="backup-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => e.target === dialogRef.current && onClose?.()}
      className="m-auto w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-2xl bg-surface p-0 text-ink shadow-soft backdrop:bg-black/50 animate-rise"
    >
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <h2 id="backup-titulo" className="flex-1 text-base font-semibold">
          Backup dos dados
        </h2>
        <IconButton label="Fechar" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </IconButton>
      </div>

      <div className="space-y-4 p-5">
        <p className="text-[13px] text-mute">
          Guarda gastos, receitas, recibos, plano e avisos em um arquivo. Exporte antes de atualizar o app: se algo der
          errado, o arquivo traz tudo de volta.
        </p>

        <div className="space-y-1.5">
          <Button className="w-full" onClick={onExport}>
            <DownloadSimple size={18} aria-hidden="true" />
            Exportar meus dados
          </Button>
          <p className="text-xs text-mute">No iPhone, toque em Salvar em Arquivos e escolha uma pasta.</p>
        </div>

        <div className="space-y-1.5">
          <Button variant="secondary" className="w-full" onClick={onImport}>
            <UploadSimple size={18} aria-hidden="true" />
            Importar um backup
          </Button>
          <p className="text-xs text-mute">Substitui os dados atuais pelos do arquivo, depois de confirmar.</p>
        </div>
      </div>
    </dialog>
  );
}
