"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Backup } from "@/lib/backup";

type DeleteTarget = { entity: string; id: string; label: string } | null;

type Props = {
  target: DeleteTarget;
  onTargetChange: (target: DeleteTarget) => void;
  onDelete: () => void;
  pendingBackup: Backup | null;
  restoring: boolean;
  onPendingBackupChange: (backup: Backup | null) => void;
  onRestore: () => void;
};

export function ConfirmationDialogs({
  target,
  onTargetChange,
  onDelete,
  pendingBackup,
  restoring,
  onPendingBackupChange,
  onRestore,
}: Props) {
  return (
    <>
      <AlertDialog open={!!target} onOpenChange={open => !open && onTargetChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {target?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Data ini akan dihapus permanen. Ringkasan dan saldo akan dihitung ulang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!pendingBackup}
        onOpenChange={open => !open && !restoring && onPendingBackupChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti semua data saat ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Cadangan ini berisi {pendingBackup?.accounts.length || 0} akun, {pendingBackup?.transactions.length || 0} transaksi, dan {pendingBackup?.budgets.length || 0} budget. Semua catatan saat ini akan diganti. Unduh cadangan saat ini dahulu bila masih dibutuhkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Batal</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={restoring} onClick={onRestore}>
              {restoring ? "Memulihkan..." : "Ganti dan pulihkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
