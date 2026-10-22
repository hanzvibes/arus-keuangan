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
  const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const spentFor = (budget: Budget) =>
    expenses.filter(transaction => transaction.category === budget.category).reduce((sum, transaction) => sum + transaction.amount, 0);
  const ratioFor = (budget: Budget) => budget.amount > 0 ? spentFor(budget) / budget.amount : 0;
  const sortedBudgets = [...budgets].sort((a, b) => ratioFor(b) - ratioFor(a));
  const remaining = Math.max(0, budgetTotal - budgetedSpend);
  const overCount = budgets.filter(budget => ratioFor(budget) > 1).length;
  const nearCount = budgets.filter(budget => ratioFor(budget) >= 0.8 && ratioFor(budget) <= 1).length;

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
        <div className="budget-overview-copy">
          <span className="eyebrow">BUDGET TERPAKAI · {monthLabel}</span>
          <strong>{formatMoney(budgetedSpend)}</strong>
          <small>dari {formatMoney(budgetTotal)} · hanya kategori berbudget</small>
          <div className="budget-overview-bar" aria-hidden="true">
            <i style={{ width: Math.min(100, budgetPercent) + "%" }} className={budgetPercent >= 100 ? "over" : budgetPercent >= 80 ? "near" : ""} />
          </div>
          <div className="budget-chips">
            <span className="budget-chip">{formatMoney(remaining)} tersisa</span>
            {overCount > 0
              ? <span className="budget-chip danger">{overCount} lewat batas</span>
              : nearCount > 0
                ? <span className="budget-chip warning">{nearCount} mendekati batas</span>
                : budgets.length > 0 && <span className="budget-chip safe">Semua kategori aman</span>}
          </div>
        </div>
      </div>

      <div className="budget-list-head">
        <h2 className="section-label">Kategori ({budgets.length})</h2>
        {budgets.length > 0 && <span>Diurutkan dari pemakaian tertinggi</span>}
      </div>
      {budgets.length ? sortedBudgets.map(budget => (
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
