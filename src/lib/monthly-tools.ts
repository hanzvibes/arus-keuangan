import type { Budget, Transaction } from "../domain/finance/types.ts";
import { monthlyReport, shiftMonth } from "./reports.ts";

export function monthlyTools(transactions: Transaction[], budgets: Budget[], month: string, today: string) {
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const elapsedDays = month < today.slice(0, 7) ? daysInMonth : month === today.slice(0, 7) ? Math.min(daysInMonth, Number(today.slice(8, 10))) : 0;
  const expenses = transactions.filter(row => row.type === "expense" && row.date.startsWith(month));
  const daily = Array.from({ length: daysInMonth }, () => 0);
  for (const row of expenses) daily[Number(row.date.slice(8, 10)) - 1] += row.amount;
  const total = expenses.reduce((sum, row) => sum + row.amount, 0);
  const observedTotal = daily.slice(0, elapsedDays).reduce((sum, amount) => sum + amount, 0);
  const report = monthlyReport(transactions, month);
  const previous = monthlyReport(transactions, shiftMonth(month, -1));
  const biggest = [...expenses].sort((a, b) => b.amount - a.amount)[0] ?? null;
  const topCategory = report.categories[0] ?? null;
  const budgetLimit = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const budgetSpent = budgets.reduce((sum, budget) => sum + expenses.filter(row => row.category === budget.category).reduce((spent, row) => spent + row.amount, 0), 0);
  return {
    daily,
    elapsedDays,
    average: elapsedDays ? Math.round(observedTotal / elapsedDays) : 0,
    projection: elapsedDays ? Math.round(observedTotal / elapsedDays * daysInMonth) : 0,
    noSpendDays: daily.slice(0, elapsedDays).filter(amount => amount === 0).length,
    biggest,
    topCategory,
    topCategoryShare: total && topCategory ? Math.round(topCategory.amount / total * 100) : 0,
    budgetRemaining: Math.max(0, budgetLimit - budgetSpent),
    budgetLimit,
    expenseChange: previous.expense ? Math.round((total - previous.expense) / previous.expense * 100) : null,
    report,
  };
}

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
export function monthlyTransactionsCsv(transactions: Transaction[], month: string) {
  const rows = transactions.filter(row => row.date.startsWith(month) && (row.type === "income" || row.type === "expense"));
  return ["date,type,amount,category,note", ...rows.map(row => [row.date, row.type, row.amount, row.category, row.note].map(csvCell).join(","))].join("\r\n");
}
