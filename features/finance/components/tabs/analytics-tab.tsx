import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PeriodControl } from "@/features/finance/components/period-control";
import { ScreenTitle } from "@/features/finance/components/screen-title";
import { categoryEmoji } from "@/features/finance/lib/presentation";

type Props = {
  month: string;
  onMonthChange: (delta: number) => void;
  income: number;
  out: number;
  byCategory: Array<{ category: string; amount: number }>;
  formatMoney: (value: number) => string;
};

export function AnalyticsTab({
  month,
  onMonthChange,
  income,
  out,
  byCategory,
  formatMoney,
}: Props) {
  return (
    <section className="screen">
      <ScreenTitle title="Analitik" subtitle="Lihat arah uangmu per bulan." />
      <PeriodControl month={month} onChange={onMonthChange} />

      <div className="analytics-grid">
        <div className="surface analytics-stat">
          <span>PEMASUKAN</span>
          <strong className="green">{formatMoney(income)}</strong>
          <ArrowDownLeft size={20} />
        </div>
        <div className="surface analytics-stat">
          <span>PENGELUARAN</span>
          <strong>{formatMoney(out)}</strong>
          <ArrowUpRight size={20} />
        </div>
      </div>

      <div className="surface analytics-net">
        <span>Arus kas bersih</span>
        <strong className={income - out >= 0 ? "green" : "red"}>
          {formatMoney(income - out)}
        </strong>
        <p>Selisih pemasukan dan pengeluaran bulan ini.</p>
      </div>

      <div className="surface analytics-categories">
        <div className="section-head"><h2>Pengeluaran per kategori</h2></div>
        {byCategory.length ? byCategory.map(item => (
          <div className="category-line" key={item.category}>
            <span className="category-icon">{categoryEmoji(item.category)}</span>
            <div>
              <b>{item.category}</b>
              <span className="track">
                <i style={{ width: Math.max(5, out ? item.amount / out * 100 : 0) + "%" }} />
              </span>
            </div>
            <strong>{formatMoney(item.amount)}</strong>
          </div>
        )) : (
          <p className="empty-inline">Belum ada pengeluaran bulan ini.</p>
        )}
      </div>
    </section>
  );
}
