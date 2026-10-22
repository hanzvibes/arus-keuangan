import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import type { Budget, Transaction } from "@/domain/finance/types";
import { MonthlyToolsPanel } from "@/features/finance/components/monthly-tools-panel";
import { PeriodControl } from "@/features/finance/components/period-control";
import { ScreenTitle } from "@/features/finance/components/screen-title";
import { CategoryIcon } from "../category-icon";
import { monthlyReport, monthlyTrend, percentageChange, shiftMonth } from "@/lib/reports";

type Props = {
  month: string; onMonthChange: (delta: number) => void;
  transactions: Transaction[]; budgets: Budget[]; formatMoney: (value: number) => string;
};
const monthLabel = (month: string) => new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", { month: "short", year: "2-digit" });

export function AnalyticsTab({ month, onMonthChange, transactions, budgets, formatMoney }: Props) {
  const report = monthlyReport(transactions, month);
  const previous = monthlyReport(transactions, shiftMonth(month, -1));
  const trend = monthlyTrend(transactions, month);
  const peak = Math.max(1, ...trend.flatMap(point => [point.income, point.expense]));
  const changeText = (current: number, before: number) => {
    const change = percentageChange(current, before);
    if (change === null) return before === 0 && current === 0 ? "Belum ada aktivitas di kedua bulan" : "Bulan sebelumnya belum ada aktivitas";
    return (change > 0 ? "+" : "") + change.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "% dari bulan sebelumnya";
  };
  return <section className="screen">
    <ScreenTitle title="Laporan bulanan" subtitle="Pahami arus uangmu dan rencanakan bulan berikutnya." />
    <PeriodControl month={month} onChange={onMonthChange} />
    <div className="report-summary">
      <div className="surface report-stat"><span className="report-stat-label"><i className="report-stat-icon income"><ArrowDownLeft size={14}/></i>Pemasukan</span><strong className="green">{formatMoney(report.income)}</strong><small>{changeText(report.income, previous.income)}</small></div>
      <div className="surface report-stat"><span className="report-stat-label"><i className="report-stat-icon expense"><ArrowUpRight size={14}/></i>Pengeluaran</span><strong>{formatMoney(report.expense)}</strong><small>{changeText(report.expense, previous.expense)}</small></div>
      <div className="surface report-stat report-stat-net">
        <span className="report-stat-label"><i className="report-stat-icon"><Wallet size={14}/></i>Arus kas bersih</span>
        <strong>{formatMoney(report.net)}</strong>
        <small>{report.net >= 0 ? "Surplus" : "Defisit"} · {report.count} transaksi bulan ini</small>
        <span className="report-stat-badge">{report.net >= 0 ? "Arus positif" : "Arus negatif"}</span>
      </div>
    </div>
    <MonthlyToolsPanel month={month} transactions={transactions} budgets={budgets} formatMoney={formatMoney}/>
    <div className="surface report-insight">
      <div><h2>{report.net < 0 ? "Pengeluaran melebihi pemasukan" : report.income > 0 ? "Pantau ruang untuk menabung" : "Mulai dari catatan pertamamu"}</h2>
      <p>{report.savingsRate === null ? "Catat pemasukan untuk melihat persentase arus kas yang tersisa." : "Arus kas tersisa " + report.savingsRate.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "% dari pemasukan. Transfer dan penyesuaian saldo tidak dihitung sebagai pemasukan atau pengeluaran."}</p></div>
      <span className="report-count">{report.count} transaksi</span>
    </div>
    <section className="surface report-trend">
      <div className="section-head"><div><h2>Tren 6 bulan</h2><p>Bandingkan pemasukan dan pengeluaran</p></div><span className="report-trend-total">Bersih {formatMoney(trend.reduce((sum, point) => sum + point.net, 0))}</span></div>
      <div className="chart-legend"><span><i className="trend-income" />Pemasukan</span><span><i className="trend-expense" />Pengeluaran</span></div>
      <div className="trend-chart" aria-label="Tren pemasukan dan pengeluaran enam bulan">
        {trend.map(point => <div className="trend-column" key={point.month}>
          <div className="trend-bars" aria-hidden="true">
            <span className="trend-income" style={{ height: (point.income / peak * 100) + "%" }} title={monthLabel(point.month) + " pemasukan: " + formatMoney(point.income)} />
            <span className="trend-expense" style={{ height: (point.expense / peak * 100) + "%" }} title={monthLabel(point.month) + " pengeluaran: " + formatMoney(point.expense)} />
          </div><span>{monthLabel(point.month)}</span>
        </div>)}
      </div>
      <details className="report-table-details">
        <summary>Lihat angka per bulan</summary>
        <div className="report-table-wrap"><table className="report-table"><caption className="sr-only">Angka tren enam bulan</caption><thead><tr><th scope="col">Bulan</th><th scope="col">Pemasukan</th><th scope="col">Pengeluaran</th><th scope="col">Selisih</th></tr></thead><tbody>
          {trend.map(point => <tr key={point.month}><th scope="row">{monthLabel(point.month)}</th><td>{formatMoney(point.income)}</td><td>{formatMoney(point.expense)}</td><td>{formatMoney(point.net)}</td></tr>)}
        </tbody></table></div>
      </details>
    </section>
    <section className="surface analytics-categories">
      <div className="section-head"><div><h2>Pengeluaran per kategori</h2><p>{report.categories.length ? `${report.categories.length} kategori · total ${formatMoney(report.expense)}` : "Belum ada pengeluaran bulan ini"}</p></div></div>
      {report.categories.length ? report.categories.map(item => {
        const share = report.expense > 0 ? item.amount / report.expense * 100 : 0;
        return <div className="category-line" key={item.category}>
          <span className="category-icon"><CategoryIcon category={item.category}/></span>
          <div><b>{item.category}</b>
            <span className="track"><i style={{ width: share + "%" }} /></span>
            <small>{share.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari pengeluaran</small></div>
          <div className="category-amount"><strong>{formatMoney(item.amount)}</strong><span>{share.toLocaleString("id-ID", { maximumFractionDigits: 0 })}%</span></div>
        </div>;
      }) : <p className="empty-inline">Belum ada pengeluaran bulan ini.</p>}
    </section>
  </section>;
}
