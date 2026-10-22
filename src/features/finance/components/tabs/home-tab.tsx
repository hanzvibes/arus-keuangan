import { ArrowLeftRight, ChevronRight, Eye, EyeOff, Minus, Plus, ScanLine, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { Account, Budget, QueuedTransaction, SavingsGoal, Transaction } from "@/domain/finance/types";
import { BudgetRow } from "@/features/finance/components/budget-row";
import { PeriodControl } from "@/features/finance/components/period-control";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { dateText } from "@/features/finance/lib/presentation";
import { monthlyReport, monthlyTrend, percentageChange, shiftMonth } from "@/lib/reports";

type WeekPoint = { date: string; label: string; value: number };

type Props = {
  hidden: boolean;
  onToggleHidden: () => void;
  total: number;
  accountCount: number;
  formatMoney: (value: number) => string;
  onIncome: () => void;
  onExpense: () => void;
  onTransfer: () => void;
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

const percentText = (value: number) =>
  `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1).replace(".", ",")}%`;

function Delta({ value, positiveIsGood, since }: { value: number | null; positiveIsGood: boolean; since: string }) {
  if (value === null) {
    return <small className="stat-delta neutral">Belum ada pembanding · {since}</small>;
  }
  const good = positiveIsGood ? value >= 0 : value <= 0;
  return (
    <small className={"stat-delta " + (good ? "up" : "down")}>
      {percentText(value)} <span>vs {since}</span>
    </small>
  );
}

export function HomeTab({
  hidden,
  onToggleHidden,
  total,
  accountCount,
  formatMoney,
  onIncome,
  onExpense,
  onTransfer,
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
  const previousLabel = new Date(shiftMonth(month, -1) + "-01T12:00:00").toLocaleDateString("id-ID", { month: "short" });
  const trend = monthlyTrend(transactions, month);
  const previous = trend[trend.length - 2];
  const netDelta = percentageChange(report.net, previous.net);
  const incomeDelta = percentageChange(report.income, previous.income);
  const expenseDelta = percentageChange(report.expense, previous.expense);

  const trendValues = trend.map(point => point.net);
  const trendMin = Math.min(...trendValues, 0);
  const trendMax = Math.max(...trendValues, 0);
  const trendSpan = trendMax - trendMin || 1;
  const sparkPoints = trendValues
    .map((value, index) => `${(index / Math.max(1, trendValues.length - 1) * 118 + 1).toFixed(1)},${(42 - (value - trendMin) / trendSpan * 38).toFixed(1)}`)
    .join(" ");

  const goalRatio = (item: SavingsGoal) => item.targetAmount > 0 ? item.savedAmount / item.targetAmount : 0;
  const goal = [...goals].sort((a, b) => goalRatio(b) - goalRatio(a))[0];
  const goalPercent = goal ? Math.min(100, Math.round(goalRatio(goal) * 100)) : 0;
  const achievedGoals = goals.filter(item => item.savedAmount >= item.targetAmount).length;

  const budgetRemaining = budgets.reduce((sum, budget) => {
    const spent = expenses.filter(transaction => transaction.category === budget.category).reduce((total, transaction) => total + transaction.amount, 0);
    return sum + Math.max(0, budget.amount - spent);
  }, 0);

  const weekAverage = weekTotal / 7;
  const averageOffset = peak > 0 ? Math.min(76, weekAverage / peak * 76) : 0;

  return (
    <>
      <section className="balance-card">
        <div className="balance-top">
          <span>TOTAL SALDO</span>
          <div className="balance-top-actions">
            <span className={"balance-chip " + (report.net >= 0 ? "positive" : "negative")}>
              {report.net >= 0 ? "Surplus" : "Defisit"} {formatMoney(Math.abs(report.net))}
            </span>
            <button aria-label={hidden ? "Tampilkan saldo" : "Sembunyikan saldo"} onClick={onToggleHidden}>
              {hidden ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
        </div>
        <div className="balance-value">{formatMoney(total)}</div>
        <div className="balance-trend">
          <svg className="balance-spark" viewBox="0 0 120 44" preserveAspectRatio="none" role="img" aria-label={`Arus kas bersih enam bulan terakhir, ${monthLabel}`}>
            <defs>
              <linearGradient id="balance-spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9ee55f" stopOpacity=".42" />
                <stop offset="100%" stopColor="#9ee55f" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polyline points={`1,44 ${sparkPoints} 119,44`} fill="url(#balance-spark-fill)" stroke="none" />
            <polyline points={sparkPoints} fill="none" stroke="#9ee55f" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="balance-trend-copy">
            <b>Arus kas 6 bulan</b>
            <span>{netDelta === null ? "Belum ada data bulan lalu" : `${percentText(netDelta)} dibanding ${previousLabel}`}</span>
          </div>
        </div>
        <div className="balance-bottom">
          <div><span>Dari akun</span><strong>{accountCount} akun</strong></div>
          <div><span>Masuk</span><strong>{formatMoney(report.income)}</strong></div>
          <div><span>Keluar</span><strong>{formatMoney(report.expense)}</strong></div>
        </div>
      </section>

      <div className="quick-actions" aria-label="Aksi utama">
        <button onClick={onExpense}><span className="action-icon expense"><Minus size={22} /></span>Pengeluaran</button>
        <button onClick={onIncome}><span className="action-icon income"><Plus size={22} /></span>Pemasukan</button>
        <button onClick={onTransfer}><span className="action-icon transfer"><ArrowLeftRight size={21} /></span>Transfer</button>
        <button onClick={onScan}><span className="action-icon scan"><ScanLine size={22} /></span>Scan Struk</button>
      </div>

      {installBanner}

      <section className="surface dashboard-month">
        <div className="section-head"><div><h2>Ringkasan {monthLabel}</h2><p>Pemasukan, pengeluaran, dan selisih dibanding bulan lalu</p></div><button className="text-link" onClick={onAnalytics}>Laporan <ChevronRight size={16}/></button></div>
        <PeriodControl month={month} onChange={onMonthChange}/>
        <div className="dashboard-stats">
          <div>
            <span>Pemasukan</span>
            <strong className="green">{formatMoney(report.income)}</strong>
            <Delta value={incomeDelta} positiveIsGood since={previousLabel} />
          </div>
          <div>
            <span>Pengeluaran</span>
            <strong>{formatMoney(report.expense)}</strong>
            <Delta value={expenseDelta} positiveIsGood={false} since={previousLabel} />
          </div>
          <div>
            <span>Selisih</span>
            <strong className={report.net >= 0 ? "green" : "red"}>{formatMoney(report.net)}</strong>
            <Delta value={netDelta} positiveIsGood since={previousLabel} />
          </div>
        </div>
      </section>

      <button className="surface dashboard-goals" onClick={onGoals} aria-label="Buka target tabungan">
        <div className="goal-summary-head">
          <span className="goal-summary-label"><Target size={16} /> Target tabungan</span>
          <ChevronRight size={18} />
        </div>
        {goal ? (
          <>
            <div className="goal-summary-top"><b>{goal.name}</b><strong>{goalPercent}%</strong></div>
            <div className="goal-summary-track"><i style={{ width: goalPercent + "%" }} /></div>
            <div className="goal-summary-meta">
              <span>{formatMoney(goal.savedAmount)} dari {formatMoney(goal.targetAmount)}</span>
              <span>{achievedGoals} dari {goals.length} target tercapai</span>
            </div>
          </>
        ) : (
          <p className="goal-summary-empty">Mulai rencanakan dana darurat atau impianmu.</p>
        )}
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
            {averageOffset > 0 && <span className="week-average" style={{ bottom: "calc(22px + " + averageOffset + "px)" }} aria-hidden="true" />}
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
          <p className="week-footnote">Rata-rata {formatMoney(weekAverage)} per hari</p>
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
        {budgets.length ? (
          <>
            {budgets.slice(0, 2).map(budget => (
              <div key={budget.id}>
                <BudgetRow budget={budget} expenses={expenses} formatMoney={formatMoney} />
              </div>
            ))}
            <div className="home-budget-foot">
              <span>Total sisa budget</span>
              <strong className={budgetRemaining > 0 ? "green" : "red"}>{formatMoney(budgetRemaining)}</strong>
            </div>
          </>
        ) : (
          <p className="empty-inline">Belum ada budget. Atur batas pengeluaranmu.</p>
        )}
      </section>
    </>
  );
}
