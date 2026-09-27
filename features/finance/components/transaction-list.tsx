import { ArrowLeftRight, Pencil, Scale, Trash2 } from "lucide-react";
import type { Account, QueuedTransaction, Transaction } from "@/domain/finance/types";
import { categoryEmoji, dateText } from "@/features/finance/lib/presentation";

type Props = {
  items: Transaction[];
  accounts: Account[];
  queued: QueuedTransaction[];
  formatMoney: (value: number) => string;
  deletable?: boolean;
  syncingQueue?: boolean;
  onDiscardQueued?: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
};

export function TransactionList({
  items,
  accounts,
  queued,
  formatMoney,
  deletable = false,
  syncingQueue = false,
  onDiscardQueued,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="transaction-list">
      {items.length ? items.map(transaction => {
        const waiting = queued.some(item => item.id === transaction.id);
        const adjustment = transaction.type === "adjustment";
        const accountName = accounts.find(account => account.id === transaction.accountId)?.name || "Akun";

        return (
          <div className="transaction-row" key={transaction.id}>
            <span className={"transaction-icon " + transaction.type}>
              {adjustment
                ? <Scale size={18} />
                : transaction.type === "transfer"
                  ? <ArrowLeftRight size={18} />
                  : categoryEmoji(transaction.category)}
            </span>
            <div className="transaction-info">
              <b>
                {adjustment
                  ? "Penyesuaian saldo · " + transaction.note
                  : transaction.note || transaction.category}
              </b>
              <small>
                {accountName} · {dateText(transaction.date)}
                {waiting ? " · Menunggu sinkronisasi" : ""}
              </small>
            </div>
            <strong className={transaction.type === "income" || adjustment && transaction.amount > 0 ? "green" : ""}>
              {adjustment
                ? (transaction.amount > 0 ? "+ " : "− ") + formatMoney(Math.abs(transaction.amount))
                : (transaction.type === "income" ? "+ " : transaction.type === "expense" ? "− " : "") +
                  formatMoney(transaction.amount)}
            </strong>
            {deletable && (
              adjustment ? (
                <span className="immutable-note">Tercatat</span>
              ) : waiting ? (
                <button
                  className="row-delete"
                  disabled={syncingQueue}
                  aria-label={"Batalkan antrean " + (transaction.note || transaction.category)}
                  onClick={() => onDiscardQueued?.(transaction.id)}
                >
                  <Trash2 size={16} />
                </button>
              ) : (
                <>
                  <button
                    className="row-edit"
                    aria-label={"Edit " + (transaction.note || transaction.category)}
                    onClick={() => onEdit?.(transaction)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="row-delete"
                    aria-label={"Hapus " + (transaction.note || transaction.category)}
                    onClick={() => onDelete?.(transaction)}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )
            )}
          </div>
        );
      }) : (
        <div className="empty-inside">Belum ada transaksi untuk filter ini.</div>
      )}
    </div>
  );
}
