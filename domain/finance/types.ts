import type { Frequency } from "../../lib/recurring.ts";

export type Account = { id: string; name: string; kind: string; openingBalance: number };
export type TransactionType = "income" | "expense" | "transfer" | "adjustment";
export type Transaction = { id: string; type: TransactionType; amount: number; accountId: string; toAccountId: string | null; category: string; note: string; date: string; createdAt?: string; queuedAt?: string };
export type Budget = { id: string; category: string; amount: number };
export type Category = { id: string; name: string };
export type RecurringRule = { id: string; type: Exclude<TransactionType, "adjustment">; amount: number; accountId: string; toAccountId: string | null; category: string; note: string; nextDate: string; frequency: Frequency; anchorDay: number; active: number };
export type FinanceData = { accounts: Account[]; transactions: Transaction[]; budgets: Budget[]; categories: Category[]; recurring: RecurringRule[] };
export type QueuedTransaction = Omit<Transaction, "type" | "queuedAt"> & { type: Exclude<TransactionType, "adjustment">; queuedAt: string };
