import type { monthlyReport } from "@/lib/reports";
import { ChevronRight, Eye, EyeOff, Minus, Plus, ScanLine, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { Account, Budget, QueuedTransaction, SavingsGoal, Transaction } from "@/domain/finance/types";
import { BudgetRow } from "@/features/finance/components/budget-row";
import { PeriodControl } from "@/features/finance/components/period-control";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { dateText } from "@/features/finance/lib/presentation";

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
  onScan: () => void;
  installBanner?: ReactNode;
  onAnalytics: () => void;
  onTransactions: () => void;
  onGoals: () => void;
  report: ReturnType<typeof monthlyReport>;
  goals: SavingsGoal[];
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
  onScan,
  installBanner,
  onAnalytics,
  onTransactions,
  onGoals,
  report,
  goals,
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
  const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  return (
    <>
      <div className="quick-actions" aria-label="Aksi utama">
        <button onClick={onExpense}><span className="action-icon expense"><Minus size={22} /></span>Pengeluaran</button>
        <button onClick={onIncome}><span className="action-icon income"><Plus size={22} /></span>Pemasukan</button>
        <button onClick={onScan}><span className="action-icon scan"><ScanLine size={22} /></span>Scan Struk</button>
      </div>

      {installBanner}

      <section className="balance-card">
        <div className="balance-top">
          <span>TOTAL SALDO</span>
          <button aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"} onClick={onToggleHidden}>
            {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        <div className="balance-value">{formatMoney(total)}</div>
        <div className="balance-bottom">
          <div><span>Dari akun</span><strong>{accountCount} akun</strong></div>
          <Wallet className="balance-art" size={128} strokeWidth={1.2} />
        </div>
      </section>

      <section className="surface dashboard-month">
        <div className="section-head"><div><h2>Ringkasan bulanan</h2><p>Pantau pemasukan, pengeluaran, dan selisihnya</p></div><button className="text-link" onClick={onAnalytics}>Laporan <ChevronRight size={16}/></button></div>
        <PeriodControl month={month} onChange={onMonthChange}/>
        <div className="dashboard-stats"><div><span>Pemasukan</span><strong className="green">{formatMoney(report.income)}</strong></div><div><span>Pengeluaran</span><strong>{formatMoney(report.expense)}</strong></div><div><span>Selisih</span><strong className={report.net>=0?"green":"red"}>{formatMoney(report.net)}</strong></div></div>
      </section>
      <button className="surface dashboard-goals" onClick={onGoals}><div><strong>Target tabungan</strong><span>{goals.length ? goals.filter(goal=>goal.savedAmount>=goal.targetAmount).length + " dari " + goals.length + " target tercapai" : "Mulai rencanakan dana darurat atau impianmu"}</span></div><ChevronRight size={20}/></button>
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
                    title={dateText(point.date) + ": " + formatMoney(point.value)}
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
            <p>Pantau batas pengeluaranmu · {monthLabel}</p>
          </div>
          <button className="text-link" onClick={onBudget}>Lihat <ChevronRight size={16} /></button>
        </div>
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
