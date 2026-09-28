"use client";

import type { FormEvent } from "react";
import { Check, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { Account } from "@/domain/finance/types";
import { reconciliationDelta } from "@/lib/finance";
import { money } from "@/features/finance/lib/presentation";

type Props = {
  account: Account | null;
  expectedBalance: number;
  actualBalance: string;
  note: string;
  saving: boolean;
  onActualBalanceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
};

export function ReconcileDrawer({
  account,
  expectedBalance,
  actualBalance,
  note,
  saving,
  onActualBalanceChange,
  onNoteChange,
  onClose,
  onSubmit,
}: Props) {
  const parsedActual = Number(actualBalance);
  const delta = actualBalance.trim() !== "" ? reconciliationDelta(expectedBalance, parsedActual) : null;

  return (
    <Drawer open={!!account} onOpenChange={value => !value && !saving && onClose()} direction="bottom">
      <DrawerContent className="form-sheet">
        <DrawerHeader>
          <div className="drawer-heading">
            <DrawerTitle>Cocokkan saldo</DrawerTitle>
            <button aria-label="Tutup pencocokan saldo" disabled={saving} onClick={onClose}>
              <X size={19} />
            </button>
          </div>
          <DrawerDescription>
            Bandingkan saldo {account?.name} dengan saldo sebenarnya. Selisih dicatat sebagai penyesuaian di riwayat.
          </DrawerDescription>
        </DrawerHeader>
        <div className="form-sheet-scroll" data-vaul-no-drag>
          <form className="form-body" onSubmit={onSubmit}>
            <div className="reconcile-summary">
              <span>Saldo tercatat</span>
              <strong>{money(expectedBalance)}</strong>
            </div>
            <label>
              Saldo sebenarnya (Rp)
              <input
                required
                autoFocus
                type="number"
                step="1"
                inputMode="numeric"
                value={actualBalance}
                onChange={event => onActualBalanceChange(event.target.value)}
                placeholder="Contoh: 1250000"
              />
            </label>
            {delta !== null && (
              <div className="reconcile-summary">
                <span>Selisih yang akan dicatat</span>
                <strong className={parsedActual - expectedBalance >= 0 ? "green" : "red"}>
                  {parsedActual - expectedBalance >= 0 ? "+ " : "− "}
                  {money(Math.abs(parsedActual - expectedBalance))}
                </strong>
              </div>
            )}
            <label>
              Alasan penyesuaian
              <input
                required
                maxLength={150}
                value={note}
                onChange={event => onNoteChange(event.target.value)}
                placeholder="Contoh: Saldo bank berbeda setelah cek mutasi"
              />
            </label>
            <p className="reconcile-hint">
              Penyesuaian tidak dihitung sebagai pemasukan, pengeluaran, atau penggunaan budget. Jika perlu koreksi lagi, buat penyesuaian baru.
            </p>
            <button className="save-button" type="submit" disabled={saving || !actualBalance.trim() || !note.trim()}>
              {saving ? "Mencocokkan..." : "Simpan penyesuaian"} <Check size={18} />
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
