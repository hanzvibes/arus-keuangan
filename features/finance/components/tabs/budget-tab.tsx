import { Pencil, Trash2 } from "lucide-react";
import type { Budget, Transaction } from "@/domain/finance/types";
import { BudgetRow } from "@/features/finance/components/budget-row";
import { EmptyState } from "@/features/finance/components/empty-state";
import { PeriodControl } from "@/features/finance/components/period-control";
import { ScreenTitle } from "@/features/finance/components/screen-title";

type Props = {
  month: string;
  onMonthChange: (delta: number) => void;
  budgetPercent: number;
  budgetedSpend: number;
  budgetTotal: number;
  budgets: Budget[];
  expenses: Transaction[];
  formatMoney: (value: number) => string;
  onAdd: () => void;
  onEdit: (budget: Budget) => void;
  onDelete: (budget: Budget) => void;
};

export function BudgetTab({
  month,
  onMonthChange,
  budgetPercent,
  budgetedSpend,
  budgetTotal,
  budgets,
  expenses,
  formatMoney,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  return (
    <section className="screen">
      <ScreenTitle
        title="Budget"
        subtitle="Kelola dan pantau batas pengeluaranmu."
        action={budgets.length ? "Tambah Budget" : undefined}
        onAction={onAdd}
      />
      <PeriodControl month={month} onChange={onMonthChange} />

      <div className="budget-overview surface">
        <div
          className="donut"
          style={{ "--percent": Math.min(100, budgetPercent) + "%" } as React.CSSProperties}
        >
          <span>{budgetPercent}%</span>
        </div>
        <div>
          <span className="eyebrow">BUDGET TERPAKAI BULAN INI</span>
          <strong>{formatMoney(budgetedSpend)}</strong>
          <small>dari {formatMoney(budgetTotal)} · hanya kategori berbudget</small>
        </div>
      </div>

      <h2 className="section-label">Kategori ({budgets.length})</h2>
      {budgets.length ? budgets.map(budget => (
        <div className="surface budget-item" key={budget.id}>
          <BudgetRow budget={budget} expenses={expenses} formatMoney={formatMoney} />
          <div className="budget-actions">
            <button onClick={() => onEdit(budget)}><Pencil size={15} /> Edit</button>
            <button className="subtle-delete" onClick={() => onDelete(budget)}>
              <Trash2 size={15} /> Hapus
            </button>
          </div>
        </div>
      )) : (
        <EmptyState
          title="Belum ada budget"
          body="Tetapkan batas pengeluaran bulanan untuk kategori pilihanmu."
          action="Tambah budget"
          onAction={onAdd}
        />
      )}
    </section>
  );
}
