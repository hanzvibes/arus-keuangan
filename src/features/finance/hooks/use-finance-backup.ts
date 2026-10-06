"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { financeApi } from "@/data/client/finance-api";
import type { FinanceData } from "@/domain/finance/types";
import { validateBackup, type Backup } from "@/lib/backup";
import { day } from "@/features/finance/lib/presentation";

type Params = {
  data: FinanceData;
  hasPending: () => Promise<boolean>;
  runExclusive: <T>(action: () => Promise<T>) => Promise<T>;
  refresh: () => Promise<void>;
  onRestored: () => void;
};

function download(filename: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${/^[\s\u0000-\u001f]*[=+@-]/.test(text) ? "'" : ""}${text.replace(/"/g, '""')}"`;
}

export function useFinanceBackup({ data, hasPending, runExclusive, refresh, onRestored }: Params) {
  const [pendingBackup, setPendingBackup] = useState<Backup | null>(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function exportBackup() {
    try {
      if (await hasPending()) throw Error("Selesaikan transaksi tertunda agar cadangan lengkap.");
      const backup = await financeApi.backup();
      download(`arus-cadangan-${day()}.json`, JSON.stringify(backup, null, 2), "application/json");
      toast.success("Cadangan berhasil diunduh.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cadangan belum bisa diunduh.");
    }
  }

  async function exportCsv() {
    try {
      if (await hasPending()) throw Error("Selesaikan transaksi tertunda agar CSV lengkap.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "CSV belum bisa diunduh.");
      return;
    }

    const rows = [
      ["Tanggal", "Jenis", "Jumlah", "Akun", "Akun tujuan", "Kategori", "Catatan"],
      ...data.transactions.map(transaction => [
        transaction.date,
        transaction.type,
        transaction.amount,
        data.accounts.find(account => account.id === transaction.accountId)?.name || "",
        data.accounts.find(account => account.id === transaction.toAccountId)?.name || "",
        transaction.category,
        transaction.note,
      ]),
    ];
    download(
      `arus-transaksi-${day()}.csv`,
      `\uFEFF${rows.map(row => row.map(csvCell).join(",")).join("\r\n")}`,
      "text/csv;charset=utf-8",
    );
    toast.success("CSV berhasil diunduh.");
  }

  async function selectBackup(file?: File) {
    if (!file) return;
    if (file.size > 3_000_000) {
      toast.error("File cadangan terlalu besar.");
      return;
    }

    try {
      const value = JSON.parse(await file.text()) as unknown;
      const validated = validateBackup(value);
      if (!validated.data) throw Error(validated.error);
      setPendingBackup(validated.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "File cadangan tidak valid.");
    }

    if (fileRef.current) fileRef.current.value = "";
  }

  async function restoreBackup() {
    if (!pendingBackup) return;
    setRestoring(true);
    try {
      await runExclusive(async () => {
        if (await hasPending()) throw Error("Sinkronkan atau batalkan transaksi tertunda sebelum memulihkan cadangan.");
        await financeApi.restore(pendingBackup);
        setPendingBackup(null);
        await refresh();
      });
      toast.success("Cadangan berhasil dipulihkan.");
      onRestored();
    } catch (error) {
      if (error instanceof Error && error.message === "SYNC_BUSY") toast.info("Tunggu pengiriman transaksi selesai.");
      else toast.error(error instanceof Error ? error.message : "Pemulihan gagal.");
    } finally {
      setRestoring(false);
    }
  }

  return {
    fileRef,
    pendingBackup,
    restoring,
    setPendingBackup,
    exportBackup,
    exportCsv,
    selectBackup,
    restoreBackup,
  };
}
