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
  return (
    <section className="screen">
      <ScreenTitle
        title="Akun Finansial"
        subtitle="Kelola sumber keuanganmu."
        action={accounts.length ? "Tambah Akun" : undefined}
        onAction={onAdd}
      />

      <div className="account-summary surface">
        <span>TOTAL SALDO</span>
        <strong>{formatMoney(total)}</strong>
        <small>Dari {accounts.length} akun</small>
      </div>

      {accounts.length ? (
        ["bank", "ewallet", "cash"].map(kind => {
          const group = accounts.filter(account => account.kind === kind);
          if (!group.length) return null;

          return (
            <div className="account-group" key={kind}>
              <div className="group-title">
                <h2>{kind === "bank" ? "Akun Bank" : kind === "ewallet" ? "E-Wallet" : "Cash"}</h2>
                <span>
                  {formatMoney(group.reduce(
                    (sum, account) => sum + accountBalance(account, transactions),
                    0,
                  ))}
                </span>
              </div>

              {group.map(account => (
                <div className="account-row surface" key={account.id}>
                  <span className="account-icon">
                    {kind === "bank"
                      ? <Landmark size={21} />
                      : kind === "ewallet"
                        ? <CreditCard size={21} />
                        : <Wallet size={21} />}
                  </span>
                  <div className="account-name">
                    <b>{account.name}</b>
                    <small>{kind === "ewallet" ? "E-WALLET" : kind.toUpperCase()}</small>
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
