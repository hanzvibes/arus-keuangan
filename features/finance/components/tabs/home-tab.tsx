import { ChevronRight, Eye, EyeOff, LayoutGrid, MessageCircle, Minus, Plus, Wallet } from "lucide-react";
import type { Account, Budget, QueuedTransaction, Transaction } from "@/domain/finance/types";
import { BudgetRow } from "@/features/finance/components/budget-row";
import { PeriodControl } from "@/features/finance/components/period-control";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { dateText, money } from "@/features/finance/lib/presentation";

type WeekPoint = { date: string; label: string; value: number };

type Props = {
  hidden: boolean;
  onToggleHidden: () => void;
  total: number;
  accountCount: number;
  formatMoney: (value: number) => string;
  onIncome: () => void;
  onExpense: () => void;
  onBudget: () => void;
  onQuick: () => void;
  onAnalytics: () => void;
  onTransactions: () => void;
  week: WeekPoint[];
  high: WeekPoint;
  weekTotal: number;
  peak: number;
  accounts: Account[];
  transactions: Transaction[];
  queued: QueuedTransaction[];
  budgets: Budget[];
  expenses: Transaction[];
  month: string;
  onMonthChange: (delta: number) => void;
};

export function HomeTab({
  hidden,
  onToggleHidden,
  total,
  accountCount,
  formatMoney,
  onIncome,
  onExpense,
  onBudget,
  onQuick,
  onAnalytics,
  onTransactions,
  week,
  high,
  weekTotal,
  peak,
  accounts,
  transactions,
  queued,
  budgets,
  expenses,
  month,
  onMonthChange,
}: Props) {
  return (
    <>
      <section className="balance-card">
        <div className="balance-top">
          <span>TOTAL SALDO</span>
          <button aria-label="Sembunyikan atau tampilkan saldo" onClick={onToggleHidden}>
            {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        <div className="balance-value">{formatMoney(total)}</div>
        <div className="balance-bottom">
          <div><span>Dari akun</span><strong>{accountCount} akun</strong></div>
          <Wallet className="balance-art" size={128} strokeWidth={1.2} />
        </div>
      </section>

      <div className="quick-actions">
        <button onClick={onIncome}><span className="action-icon income"><Plus size={22} /></span>Pemasukan</button>
        <button onClick={onExpense}><span className="action-icon expense"><Minus size={22} /></span>Pengeluaran</button>
        <button className="all-actions" aria-label="Lihat budget" onClick={onBudget}><LayoutGrid size={23} /></button>
      </div>

      <button className="quick-text-cta" onClick={onQuick}>
        <MessageCircle size={18} /> Catat cepat lewat teks <ChevronRight size={17} />
      </button>

      <div className="home-grid">
        <section className="surface week-card">
          <div className="section-head">
            <div>
              <h2>Pengeluaran 7 hari</h2>
              <p>Paling tinggi: {high.value ? dateText(high.date) : "—"}</p>
            </div>
            <div className="align-right">
              <strong>{formatMoney(weekTotal)}</strong>
              <button className="text-link" onClick={onAnalytics}>Detail <ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="week-chart" role="img" aria-label="Grafik pengeluaran tujuh hari terakhir">
            {week.map((point, index) => (
              <div className="bar-col" key={point.date}>
                <div className="bar-wrap">
                  <div
                    className={"bar " + (index === 6 ? "current" : "")}
                    style={{ height: Math.max(point.value ? 16 : 7, point.value / peak * 76) + "px" }}
                    title={dateText(point.date) + ": " + money(point.value)}
                  />
                </div>
                <span>{point.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface recent-card">
          <div className="section-head">
            <h2>Transaksi Terakhir</h2>
            <button className="text-link" onClick={onTransactions}>Lihat semua <ChevronRight size={16} /></button>
          </div>
          <TransactionList
            items={transactions.slice(0, 4)}
            accounts={accounts}
            queued={queued}
            formatMoney={formatMoney}
          />
        </section>
      </div>

      <section className="surface home-budget">
        <div className="section-head">
          <div>
            <h2>Budget</h2>
            <p>Pantau batas pengeluaranmu</p>
          </div>
          <button className="text-link" onClick={onBudget}>Lihat <ChevronRight size={16} /></button>
        </div>
        <PeriodControl month={month} onChange={onMonthChange} />
        {budgets.length ? budgets.slice(0, 2).map(budget => (
          <div key={budget.id}>
            <BudgetRow budget={budget} expenses={expenses} formatMoney={formatMoney} />
          </div>
        )) : (
          <p className="empty-inline">Belum ada budget. Atur batas pengeluaranmu.</p>
        )}
      </section>
    </>
  );
}
