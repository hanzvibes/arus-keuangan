import type { Backup } from "@/lib/backup";
import type {
  Account,
  Budget,
  Category,
  FinanceData,
  RecurringRule,
  Transaction,
  TransactionType,
} from "@/domain/finance/types";

export type StoredAccount = Account & { createdAt: string };
export type StoredTransaction = Transaction & { createdAt: string };
export type StoredBudget = Budget & { createdAt: string };
export type StoredCategory = Category & { createdAt: string };
export type StoredRecurringRule = RecurringRule & { createdAt: string };

export type FinanceSnapshot = Omit<FinanceData, "accounts" | "transactions" | "budgets" | "categories" | "recurring"> & {
  accounts: StoredAccount[];
  transactions: StoredTransaction[];
  budgets: StoredBudget[];
  categories: StoredCategory[];
  recurring: StoredRecurringRule[];
};

export type AccountWrite = {
  id: string;
  name: string;
  kind: string;
  openingBalance: number;
  createdAt: string;
};

export type TransactionWrite = {
  id: string;
  type: Exclude<TransactionType, "adjustment">;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  category: string;
  note: string;
  date: string;
  createdAt: string;
};

export type BudgetWrite = {
  id: string;
  category: string;
  amount: number;
  createdAt: string;
};

export type RecurringWrite = {
  id: string;
  type: Exclude<TransactionType, "adjustment">;
  amount: number;
  accountId: string;
  toAccountId: string | null;
  category: string;
  note: string;
  nextDate: string;
  frequency: "weekly" | "monthly";
  anchorDay: number;
  active?: boolean;
  createdAt?: string;
};

export type ReconcileInput = {
  accountId: string;
  expectedBalance: number;
  actualBalance: number;
  note: string;
  date: string;
  adjustmentCategory: string;
};

export class FinanceRepositoryError extends Error {
  readonly kind: "UNAUTHENTICATED" | "DATA_ACCESS";

  constructor(kind: "UNAUTHENTICATED" | "DATA_ACCESS", message: string) {
    super(message);
    this.kind = kind;
    this.name = "FinanceRepositoryError";
  }
}

export interface FinanceRepository {
  readSnapshot(): Promise<FinanceSnapshot>;

  accountsExist(ids: string[]): Promise<boolean>;

  createAccount(input: AccountWrite): Promise<void>;
  getAccountOpeningBalance(id: string): Promise<number | null>;
  accountHasTransactions(id: string): Promise<boolean>;
  updateAccount(id: string, input: Pick<AccountWrite, "name" | "kind" | "openingBalance">): Promise<boolean>;
  accountReferenced(id: string): Promise<boolean>;
  deleteAccount(id: string): Promise<boolean>;

  createTransaction(input: TransactionWrite): Promise<"created" | "duplicate">;
  getTransactionType(id: string): Promise<TransactionType | null>;
  updateTransaction(id: string, input: Omit<TransactionWrite, "id" | "createdAt">): Promise<boolean>;
  deleteTransaction(id: string): Promise<void>;
  transactionExists(id: string): Promise<boolean>;

  createBudget(input: BudgetWrite): Promise<"created" | "duplicate">;
  updateBudget(id: string, input: Pick<BudgetWrite, "category" | "amount">): Promise<"updated" | "missing" | "duplicate">;
  deleteBudget(id: string): Promise<boolean>;

  listCategories(): Promise<Array<{ id: string; name: string }>>;
  createCategory(input: { id: string; name: string; createdAt: string }): Promise<"created" | "duplicate">;
  getCategoryName(id: string): Promise<string | null>;
  renameCategory(id: string, name: string): Promise<"renamed" | "missing" | "duplicate">;
  categoryReferenced(name: string): Promise<boolean>;
  deleteCategory(id: string): Promise<void>;

  skipRecurring(id: string, due: string): Promise<string | null>;
  recordRecurring(id: string, due: string, recordedDate: string): Promise<"duplicate" | { nextDate: string } | null>;
  createRecurring(input: RecurringWrite): Promise<void>;
  toggleRecurring(id: string, active: boolean): Promise<boolean>;
  getRecurringMeta(id: string): Promise<{ nextDate: string; anchorDay: number; frequency: string } | null>;
  updateRecurring(id: string, input: Omit<RecurringWrite, "id" | "createdAt" | "active">): Promise<boolean>;
  deleteRecurring(id: string): Promise<boolean>;

  reconcile(input: ReconcileInput): Promise<string | null>;
  restoreBackup(backup: Backup): Promise<{ accounts: number; transactions: number; budgets: number }>;
}