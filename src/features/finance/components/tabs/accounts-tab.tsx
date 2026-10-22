import { CreditCard, Landmark, Pencil, Scale, Trash2, Wallet } from "lucide-react";
import type { Account, Transaction } from "@/domain/finance/types";
import { accountBalance } from "@/lib/finance";
import { EmptyState } from "@/features/finance/components/empty-state";
import { ScreenTitle } from "@/features/finance/components/screen-title";
import { ActionMenu } from "@/components/ui/action-menu";

type Props = {
  accounts: Account[];
  transactions: Transaction[];
  offline: boolean;
  total: number;
  formatMoney: (value: number) => string;
  onAdd: () => void;
  onReconcile: (account: Account) => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
};

const kinds = [
  { kind: "bank", label: "Akun Bank", short: "Bank", icon: Landmark },
  { kind: "ewallet", label: "E-Wallet", short: "E-wallet", icon: CreditCard },
  { kind: "cash", label: "Cash", short: "Tunai", icon: Wallet },
];

export function AccountsTab({
  accounts,
  transactions,
  offline,
  total,
  formatMoney,
  onAdd,
  onReconcile,
  onEdit,
  onDelete,
}: Props) {
  const groups = kinds
    .map(meta => {
      const rows = accounts.filter(account => account.kind === meta.kind);
      return { ...meta, rows, sum: rows.reduce((value, account) => value + accountBalance(account, transactions), 0) };
    })
    .filter(group => group.rows.length > 0);

  return (
    <section className="screen">
      <ScreenTitle
        title="Akun Finansial"
        subtitle="Kelola sumber keuanganmu."
        action={accounts.length ? "Tambah Akun" : undefined}
        onAction={onAdd}
      />

      <div className="account-summary surface">
        <div className="account-summary-main">
          <span>TOTAL SALDO</span>
          <strong>{formatMoney(total)}</strong>
          <small>{accounts.length ? `${accounts.length} akun · ${groups.length} jenis` : "Belum ada akun tercatat"}</small>
        </div>
        {accounts.length > 0 && (
          <div className="account-mix">
            <div className="account-mix-bar" aria-hidden="true">
              {groups.map(group => (
                <i
                  key={group.kind}
                  data-kind={group.kind}
                  style={{ width: Math.max(6, total > 0 ? group.sum / total * 100 : 100 / groups.length) + "%" }}
                />
              ))}
            </div>
            <ul className="account-mix-legend">
              {groups.map(group => (
                <li key={group.kind}>
                  <i data-kind={group.kind} aria-hidden="true" />
                  <span>{group.short}</span>
                  <b>{total > 0 ? Math.round(group.sum / total * 100) : 0}%</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {accounts.length ? (
        groups.map(group => {
          const GroupIcon = group.icon;
          return (
          <div className="account-group" key={group.kind}>
            <div className="group-title">
              <h2>{group.label}</h2>
              <span>{group.rows.length} akun · {formatMoney(group.sum)}</span>
            </div>

            {group.rows.map(account => (
              <div className="account-row surface" key={account.id} data-kind={group.kind}>
                <span className="account-icon">
                  <GroupIcon size={21} />
                </span>
                <div className="account-name">
                  <b>{account.name}</b>
                  <small>{group.kind === "ewallet" ? "E-WALLET" : group.kind.toUpperCase()} · SALDO TERCATAT</small>
                </div>
                <strong>{formatMoney(accountBalance(account, transactions))}</strong>
                <div className="account-row-actions">
                  <button
                    className="account-reconcile"
                    disabled={offline}
                    onClick={() => onReconcile(account)}
                  >
                    <Scale size={15} /> Cocokkan saldo
                  </button>
                  <ActionMenu label={"Opsi akun " + account.name} actions={[
                    { label: "Edit akun", icon: <Pencil size={17}/>, onSelect: () => onEdit(account) },
                    { label: "Hapus akun", icon: <Trash2 size={17}/>, destructive: true, onSelect: () => onDelete(account) },
                  ]}/>
                </div>
              </div>
            ))}
          </div>
          );
        })
      ) : (
        <EmptyState
          title="Belum ada akun"
          body="Tambahkan rekening, dompet digital, atau uang tunai."
          action="Tambah akun"
          onAction={onAdd}
        />
      )}
    </section>
  );
}
