import type { Budget, Transaction } from "@/domain/finance/types";
import { categoryEmoji } from "@/features/finance/lib/presentation";

type Props = {
  budget: Budget;
  expenses: Transaction[];
  formatMoney: (value: number) => string;
};

export function BudgetRow({ budget, expenses, formatMoney }: Props) {
  const spent = expenses
    .filter(transaction => transaction.category === budget.category)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const percent = Math.round(spent / budget.amount * 100);
  const ratio = spent / budget.amount;

  return (
    <div className="budget-row">
      <div className="budget-line">
        <div>
          <span className="budget-icon">{categoryEmoji(budget.category)}</span>
          <b>{budget.category}</b>
        </div>
        <strong className={ratio >= 1 ? "red" : ratio >= 0.8 ? "amber" : "green"}>
          {percent}%
        </strong>
      </div>
      <div className="progress">
        <span
          style={{
            width: Math.min(percent, 100) + "%",
            background: ratio >= 1 ? "#df5a55" : ratio >= 0.8 ? "#d79b2d" : undefined,
          }}
        />
      </div>
      <div className="budget-numbers">
        <span>Terpakai {formatMoney(spent)}</span>
        <span>Sisa {formatMoney(Math.max(0, budget.amount - spent))}</span>
      </div>
      {ratio >= 0.8 && (
        <small className={"budget-warning " + (ratio >= 1 ? "red" : "amber")}>
          {ratio > 1 ? "Budget terlampaui" : ratio === 1 ? "Budget habis" : "Mendekati batas budget"}
        </small>
      )}
    </div>
  );
}
