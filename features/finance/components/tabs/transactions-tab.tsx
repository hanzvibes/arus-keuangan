import type { TransactionSort } from "@/lib/reports";
import { Search, ScanLine, SlidersHorizontal, X, ChevronRight } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
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
import { useEffect, useState } from "react";
import { listAndSyncReceiptDrafts } from "@/features/receipt/client";
import type { ReceiptScan } from "@/features/receipt/types";

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
  sort: TransactionSort;
  onSortChange: (sort: TransactionSort) => void;
  onResetFilters: () => void;
  filteredTransactions: Transaction[];
  recurring: RecurringRule[];
  accounts: Account[];
  categories: string[];
  offline: boolean;
  queued: QueuedTransaction[];
  syncingQueue: boolean;
  onRefresh: () => Promise<void>;
  onAdd: () => void;
  onScanReceipt: () => void;
  onOpenScan: (scan: ReceiptScan) => void;
  onDiscardQueued: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onViewReceipt: (transaction: Transaction) => void;
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
  sort,
  onSortChange,
  onResetFilters,
  filteredTransactions,
  recurring,
  accounts,
  categories,
  offline,
  queued,
  syncingQueue,
  onRefresh,
  onAdd,
  onScanReceipt,
  onOpenScan,
  onDiscardQueued,
  onEdit,
  onDelete,
  onViewReceipt,
}: Props) {
  const [scans,setScans]=useState<ReceiptScan[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  useEffect(()=>{ let active=true; const refreshScans=()=>{void listAndSyncReceiptDrafts().then(rows=>{if(active)setScans(rows);}).catch(()=>{});}; refreshScans();window.addEventListener("online",refreshScans);return()=>{active=false;window.removeEventListener("online",refreshScans);}; },[filteredTransactions]);
  const dueCount = recurring.filter(rule => rule.active && rule.nextDate <= day()).length;

  const activeFilters = [filterType !== "all", filterAccount !== "all", filterCategory !== "all", !!query.trim()].filter(Boolean).length;
  const matchingIncome = filteredTransactions.filter(row => row.type === "income").reduce((sum,row) => sum + row.amount,0);
  const matchingExpense = filteredTransactions.filter(row => row.type === "expense").reduce((sum,row) => sum + row.amount,0);
  return (
    <section className="screen">
      <ScreenTitle
        title="Transaksi"
        subtitle="Riwayat dan jadwal keuanganmu."
        action="Catat Baru"
        onAction={onAdd}
      />
      <PeriodControl month={month} onChange={onMonthChange} />
      <button className="receipt-entry-button" onClick={onScanReceipt}><ScanLine size={22}/><span>Scan Struk<small>Foto, periksa, lalu simpan</small></span><ChevronRight size={18}/></button>
      <details className="surface receipt-history"><summary>Riwayat Scan ({scans.length})</summary>{scans.length ? scans.map(scan=><div key={scan.id} className="receipt-history-row"><span>{scan.draft?.merchant.value||"Struk"} · {scan.status === "processing" ? "Processing" : scan.status === "success" ? "Berhasil" : scan.status === "review" ? "Perlu diperiksa" : "Gagal dibaca"} · {scan.transactionId ? "Tersimpan" : "Draft"}</span><button onClick={()=>onOpenScan(scan)}>{scan.transactionId ? "Lihat" : "Lanjutkan"}</button></div>) : <p>Belum ada scan.</p>}</details>

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
          <Drawer open={filterOpen} onOpenChange={setFilterOpen}>
            <DrawerContent className="form-sheet transaction-filter-sheet">
              <DrawerHeader><div className="drawer-heading"><DrawerTitle>Filter transaksi</DrawerTitle><button aria-label="Tutup filter" onClick={() => setFilterOpen(false)}><X size={18}/></button></div><DrawerDescription>Pilih catatan yang ingin kamu lihat.</DrawerDescription></DrawerHeader>
              <div className="form-sheet-scroll" data-vaul-no-drag><div className="form-body">
            <label>Jenis transaksi
            <select aria-label="Filter jenis" value={filterType} onChange={event => onFilterTypeChange(event.target.value)}>
              <option value="all">Semua jenis</option>
              <option value="expense">Pengeluaran</option>
              <option value="income">Pemasukan</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Penyesuaian saldo</option>
            </select></label><label>Akun
            <select aria-label="Filter akun" value={filterAccount} onChange={event => onFilterAccountChange(event.target.value)}>
              <option value="all">Semua akun</option>
              {accounts.map(account => <option value={account.id} key={account.id}>{account.name}</option>)}
            </select></label><label>Kategori
            <select aria-label="Filter kategori" value={filterCategory} onChange={event => onFilterCategoryChange(event.target.value)}>
              <option value="all">Semua kategori</option>
              {categories.map(category => <option value={category} key={category}>{category}</option>)}
            </select></label>
            <button className="reset-filters" onClick={onResetFilters}>Reset filter dan urutan</button>
            <button className="save-button" onClick={() => setFilterOpen(false)}>Lihat {filteredTransactions.length} transaksi</button>
              </div></div>
            </DrawerContent>
          </Drawer>

          <div className="transaction-search"><label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={event => onQueryChange(event.target.value)}
              placeholder="Cari catatan, kategori, atau akun..."
              aria-label="Cari transaksi"
            />
          </label><button className="filter-trigger" aria-haspopup="dialog" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={18}/><span>Filter</span>{activeFilters > 0 && <b>{activeFilters}</b>}</button></div>

          <div className="transaction-results">
            <div role="status"><strong>{filteredTransactions.length} transaksi</strong><span>Pemasukan {formatMoney(matchingIncome)} · Pengeluaran {formatMoney(matchingExpense)}</span></div>
            <label className="sort-control">Urutkan<select value={sort} onChange={event=>onSortChange(event.target.value as TransactionSort)}><option value="newest">Terbaru</option><option value="oldest">Terlama</option><option value="largest">Nominal terbesar</option><option value="smallest">Nominal terkecil</option></select></label>
            {(activeFilters>0||sort!=="newest")&&<button className="reset-filters" onClick={onResetFilters}>Reset {activeFilters>0 ? activeFilters+" filter" : "urutan"}</button>}
          </div>
          {!filteredTransactions.length ? <div className="surface filtered-empty"><Search size={28}/><h2>{activeFilters ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi bulan ini"}</h2><p>{activeFilters ? "Coba kata kunci lain atau hapus filter untuk melihat riwayat." : "Catat pemasukan, pengeluaran, atau transfer pertamamu."}</p><button className="reset-filters" onClick={activeFilters ? onResetFilters : onAdd}>{activeFilters ? "Hapus semua filter" : "Catat transaksi"}</button></div> : <div className="surface transaction-surface">
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
              onViewReceipt={onViewReceipt}
            />
          </div>}
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
