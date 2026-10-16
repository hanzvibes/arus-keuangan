"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import type { Budget, Transaction } from "@/domain/finance/types";
import { day } from "@/features/finance/lib/presentation";
import { downloadText } from "@/lib/client-productivity";
import { monthlyTools, monthlyTransactionsCsv } from "@/lib/monthly-tools";

type Props = {
  month: string;
  transactions: Transaction[];
  budgets: Budget[];
  formatMoney: (value: number) => string;
};

export function MonthlyToolsPanel({ month, transactions, budgets, formatMoney }: Props) {
  const insight = monthlyTools(transactions, budgets, month, day());
  const maxDaily = Math.max(1, ...insight.daily);
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const copySummary = async () => {
    const summary = `${monthName}: pemasukan ${formatMoney(insight.report.income)}, pengeluaran ${formatMoney(insight.report.expense)}, selisih ${formatMoney(insight.report.net)}. Rata-rata pengeluaran ${formatMoney(insight.average)} per hari.`;
    try { await navigator.clipboard.writeText(summary); toast.success("Ringkasan disalin."); }
    catch { toast.error("Ringkasan belum bisa disalin."); }
  };
  const exportCsv = () => {
    downloadText(`arus-transaksi-${month}.csv`, `\uFEFF${monthlyTransactionsCsv(transactions, month)}`, "text/csv;charset=utf-8");
    toast.success("CSV diunduh.");
  };

  return <details className="surface monthly-tools">
    <summary><span><strong>Analisis cepat</strong><small>Kalender, proyeksi, budget, dan transaksi utama</small></span></summary>
    <div className="monthly-tools-body">
      <div className="monthly-tools-grid">
        <div><span>Rata-rata harian</span><strong>{formatMoney(insight.average)}</strong><small>Selama {insight.elapsedDays} hari tercatat</small></div>
        <div><span>Proyeksi akhir bulan</span><strong>{insight.elapsedDays ? formatMoney(insight.projection) : "—"}</strong><small>Berdasarkan ritme pengeluaran</small></div>
        <div><span>Hari tanpa belanja</span><strong>{insight.noSpendDays} hari</strong><small>Dalam periode yang sudah berlalu</small></div>
        <div><span>Transaksi terbesar</span><strong>{insight.biggest ? formatMoney(insight.biggest.amount) : "—"}</strong><small>{insight.biggest?.note || insight.biggest?.category || "Belum ada pengeluaran"}</small></div>
        <div><span>Kategori dominan</span><strong>{insight.topCategory?.category || "—"}</strong><small>{insight.topCategoryShare}% dari pengeluaran</small></div>
        <div><span>Sisa budget</span><strong>{insight.budgetLimit ? formatMoney(insight.budgetRemaining) : "—"}</strong><small>{insight.budgetLimit ? `Dari ${formatMoney(insight.budgetLimit)} batas` : "Belum ada budget"}</small></div>
        <div><span>Dibanding bulan lalu</span><strong>{insight.expenseChange === null ? "—" : `${insight.expenseChange > 0 ? "+" : ""}${insight.expenseChange}%`}</strong><small>{insight.expenseChange === null ? "Belum ada pembanding" : "Perubahan pengeluaran"}</small></div>
      </div>
      <div className="monthly-calendar"><div className="monthly-calendar-title"><strong>Kalender pengeluaran</strong><small>Semakin pekat, semakin besar pengeluaran</small></div><div className="monthly-calendar-grid" role="list" aria-label={`Pengeluaran harian ${monthName}`}>
        {insight.daily.map((amount, index) => <div key={index} role="listitem" title={`${index + 1} ${monthName}: ${formatMoney(amount)}`} aria-label={`Tanggal ${index + 1}: ${formatMoney(amount)}`} className={index >= insight.elapsedDays ? "future" : ""} style={{ backgroundColor: amount ? `rgba(54, 122, 10, ${.16 + .72 * amount / maxDaily})` : undefined, color: amount / maxDaily > .5 ? "#fff" : undefined }}>{index + 1}</div>)}
      </div></div>
      <div className="monthly-tools-actions"><button type="button" onClick={() => void copySummary()}><Copy size={16}/> Salin ringkasan</button><button type="button" onClick={exportCsv}><Download size={16}/> Unduh CSV transaksi</button></div>
      <p className="monthly-tools-note">CSV berisi pemasukan dan pengeluaran bulan ini, siap diimpor kembali.</p>
    </div>
  </details>;
}
