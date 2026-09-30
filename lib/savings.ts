export type SavingsInput = { name: string; targetAmount: number; savedAmount: number; targetDate: string | null };

export function validateSavingsInput(value: Record<string, unknown>): SavingsInput | null {
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const { targetAmount, savedAmount, targetDate } = value;
  const money = (amount: unknown): amount is number => typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 1_000_000_000_000;
  if (!name || name.length > 80 || !money(targetAmount) || targetAmount === 0 || !money(savedAmount)) return null;
  if (targetDate !== null) {
    if (typeof targetDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return null;
    const parsed = new Date(targetDate + "T12:00:00Z");
    if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== targetDate) return null;
  }
  return { name, targetAmount, savedAmount, targetDate };
}

export function savingsProgress(goal: SavingsInput, today: string) {
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const percent = Math.min(100, goal.savedAmount / goal.targetAmount * 100);
  const overdue = !!goal.targetDate && goal.targetDate < today && remaining > 0;
  let monthlyAmount: number | null = null;
  if (goal.targetDate && remaining > 0 && !overdue) {
    const [year, month] = today.split("-").map(Number);
    const [targetYear, targetMonth] = goal.targetDate.split("-").map(Number);
    monthlyAmount = Math.ceil(remaining / Math.max(1, (targetYear - year) * 12 + targetMonth - month + 1));
  }
  return { remaining, percent, overdue, monthlyAmount, completed: remaining === 0 };
}
