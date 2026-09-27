import { Search } from "lucide-react";
import type {
  Account,
  QueuedTransaction,
  RecurringRule,
  Transaction,
} from "@/domain/finance/types";
import { PeriodControl } from "@/features/finance/components/period-control";
import { RecurringSection } from "@/features/finance/components/recurring-section";
import { ScreenTitle } from "@/features/finance/components/screen-title";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { day } from "@/features/finance/lib/presentation";

type View = "history" | "schedule";

type Props = {
  month: string;
  onMonthChange: (delta: number) => void;
  income: number;
  out: number;
  formatMoney: (value: number) => string;
  transactionView: View;
  onTransactionViewChange: (view: View) => void;
  filterType: string;
  onFilterTypeChange: (value: string) => void;
  filterAccount: string;
  onFilterAccountChange: (value: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (value: string) => void;
  query: string;
  onQueryChange: (value: string) => void;
  filteredTransactions: Transaction[];
  recurring: RecurringRule[];
  accounts: Account[];
  categories: string[];
  offline: boolean;
  queued: QueuedTransaction[];
  syncingQueue: boolean;
  onRefresh: () => Promise<void>;
  onAdd: () => void;
  onDiscardQueued: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
};

export function TransactionsTab({
  month,
  onMonthChange,
  income,
  out,
  formatMoney,
  transactionView,
  onTransactionViewChange,
  filterType,
  onFilterTypeChange,
  filterAccount,
  onFilterAccountChange,
  filterCategory,
  onFilterCategoryChange,
  query,
  onQueryChange,
  filteredTransactions,
  recurring,
  accounts,
  categories,
  offline,
  queued,
  syncingQueue,
  onRefresh,
  onAdd,
  onDiscardQueued,
  onEdit,
  onDelete,
}: Props) {
  const dueCount = recurring.filter(rule => rule.active && rule.nextDate <= day()).length;

  return (
    <section className="screen">
      <ScreenTitle
        title="Transaksi"
        subtitle="Riwayat dan jadwal keuanganmu."
        action="Catat Baru"
        onAction={onAdd}
      />
      <PeriodControl month={month} onChange={onMonthChange} />

      <div className="mini-stats">
        <div><span>Pemasukan</span><strong className="green">{formatMoney(income)}</strong></div>
        <div><span>Pengeluaran</span><strong>{formatMoney(out)}</strong></div>
      </div>

      <div className="view-switch" role="group" aria-label="Tampilan transaksi">
        <button
          className={transactionView === "history" ? "active" : ""}
          aria-pressed={transactionView === "history"}
          onClick={() => onTransactionViewChange("history")}
        >
          Riwayat
        </button>
        <button
          className={transactionView === "schedule" ? "active" : ""}
          aria-pressed={transactionView === "schedule"}
          onClick={() => onTransactionViewChange("schedule")}
        >
          Jadwal {dueCount > 0 && <span className="view-count">{dueCount}</span>}
        </button>
      </div>

      {transactionView === "history" ? (
        <>
          <div className="filter-bar">
            <select aria-label="Filter jenis" value={filterType} onChange={event => onFilterTypeChange(event.target.value)}>
              <option value="all">Semua jenis</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Penyesuaian saldo</option>
            </select>
            <select aria-label="Filter akun" value={filterAccount} onChange={event => onFilterAccountChange(event.target.value)}>
              <option value="all">Semua akun</option>
              {accounts.map(account => <option value={account.id} key={account.id}>{account.name}</option>)}
            </select>
            <select aria-label="Filter kategori" value={filterCategory} onChange={event => onFilterCategoryChange(event.target.value)}>
              <option value="all">Semua kategori</option>
              {categories.map(category => <option value={category} key={category}>{category}</option>)}
            </select>
          </div>

          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Cari transaksi..."
              aria-label="Cari transaksi"
            />
          </label>

          <div className="surface transaction-surface">
            <TransactionList
              items={filteredTransactions}
              accounts={accounts}
              queued={queued}
              formatMoney={formatMoney}
              deletable
              syncingQueue={syncingQueue}
              onDiscardQueued={onDiscardQueued}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        </>
      ) : (
        <RecurringSection
          rules={recurring}
          accounts={accounts}
          categories={categories}
          month={month}
          offline={offline}
          onChange={onRefresh}
          money={formatMoney}
        />
      )}
    </section>
  );
}
