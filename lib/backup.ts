import { defaultCategories } from "./categories.ts";
import { ADJUSTMENT_CATEGORY } from "./finance.ts";

export type BackupAccount = { id: string; name: string; kind: "bank" | "ewallet" | "cash"; openingBalance: number; createdAt: string };
export type BackupTransaction = { id: string; type: "income" | "expense" | "transfer" | "adjustment"; amount: number; accountId: string; toAccountId: string | null; category: string; note: string; date: string; createdAt: string };
export type BackupBudget = { id: string; category: string; amount: number; createdAt: string };
export type BackupCategory = { id: string; name: string; createdAt: string };
export type BackupRecurring = { id: string; type: "income" | "expense" | "transfer"; amount: number; accountId: string; toAccountId: string | null; category: string; note: string; nextDate: string; frequency: "weekly" | "monthly"; anchorDay: number; active: number; createdAt: string };
export type Backup = { version: 2; exportedAt: string; accounts: BackupAccount[]; transactions: BackupTransaction[]; budgets: BackupBudget[]; categories: BackupCategory[]; recurring: BackupRecurring[] };

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number, canBeEmpty = false) => typeof v === "string" && v.length <= max && (canBeEmpty || !!v.trim());
const id = (v: unknown) => str(v, 100) && /^[A-Za-z0-9_-]+$/.test(v as string);
const amount = (v: unknown, allowNegative = false) => typeof v === "number" && Number.isSafeInteger(v) && (allowNegative ? Math.abs(v) <= 1_000_000_000_000 : v > 0 && v <= 1_000_000_000_000);
const timestamp = (v: unknown) => str(v, 40) && Number.isFinite(Date.parse(v as string));
export const isCalendarDate = (v: unknown) => {
  if (!str(v, 10) || !/^\d{4}-\d{2}-\d{2}$/.test(v as string)) return false;
  const parsed = new Date((v as string) + "T12:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === v;
};
const uniqueIds = (rows: { id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;

export function validateBackup(value: unknown): { data?: Backup; error?: string } {
  if (!object(value) || ![1, 2].includes(value.version as number) || !Array.isArray(value.accounts) || !Array.isArray(value.transactions) || !Array.isArray(value.budgets)) return { error: "Format cadangan tidak dikenali." };
  if (value.version === 2 && (!Array.isArray(value.categories) || !Array.isArray(value.recurring))) return { error: "Format cadangan tidak lengkap." };
  const categories = value.version === 2 ? value.categories as unknown[] : [], recurring = value.version === 2 ? value.recurring as unknown[] : [];
  if (value.accounts.length > 100 || value.budgets.length > 100 || value.transactions.length > 2000 || categories.length > 100 || recurring.length > 100) return { error: "Cadangan terlalu besar untuk dipulihkan sekaligus." };
  const accounts = value.accounts, transactions = value.transactions, budgets = value.budgets;
  if (!accounts.every(a => object(a) && id(a.id) && str(a.name, 50) && ["bank", "ewallet", "cash"].includes(a.kind as string) && amount(a.openingBalance, true) && timestamp(a.createdAt))) return { error: "Data akun dalam cadangan tidak valid." };
  if (!budgets.every(b => object(b) && id(b.id) && str(b.category, 50) && amount(b.amount) && timestamp(b.createdAt))) return { error: "Data budget dalam cadangan tidak valid." };
  if (!transactions.every(t => object(t) && id(t.id) && ["income", "expense", "transfer", "adjustment"].includes(t.type as string) && (t.type === "adjustment" ? amount(t.amount, true) && t.amount !== 0 && t.category === ADJUSTMENT_CATEGORY && str(t.note, 150) && t.toAccountId === null : amount(t.amount)) && id(t.accountId) && (t.toAccountId === null || id(t.toAccountId)) && str(t.category, 50) && str(t.note, 150, true) && isCalendarDate(t.date) && timestamp(t.createdAt))) return { error: "Data transaksi dalam cadangan tidak valid." };
  if (!categories.every(c => object(c) && id(c.id) && str(c.name, 50) && timestamp(c.createdAt))) return { error: "Data kategori dalam cadangan tidak valid." };
  if (!recurring.every(r => object(r) && id(r.id) && ["income", "expense", "transfer"].includes(r.type as string) && amount(r.amount) && id(r.accountId) && (r.toAccountId === null || id(r.toAccountId)) && str(r.category, 50) && str(r.note, 150, true) && isCalendarDate(r.nextDate) && ["weekly", "monthly"].includes(r.frequency as string) && Number.isInteger(r.anchorDay) && (r.anchorDay as number) >= 1 && (r.anchorDay as number) <= 31 && [0, 1].includes(r.active as number) && timestamp(r.createdAt))) return { error: "Data jadwal dalam cadangan tidak valid." };
  const a = accounts as BackupAccount[], t = transactions as BackupTransaction[], b = budgets as BackupBudget[];
  const c = categories as BackupCategory[], r = recurring as BackupRecurring[];
  if (!uniqueIds(a) || !uniqueIds(t) || !uniqueIds(b) || !uniqueIds(c) || !uniqueIds(r) || new Set(b.map(row => row.category.toLowerCase())).size !== b.length || new Set(c.map(row => row.name.toLowerCase())).size !== c.length || c.some(row => defaultCategories.some(name => name.toLowerCase() === row.name.toLowerCase()))) return { error: "Cadangan berisi ID atau kategori ganda." };
  const accountIds = new Set(a.map(row => row.id));
  if ([...t, ...r].some(row => !accountIds.has(row.accountId) || (row.type === "transfer" ? !row.toAccountId || !accountIds.has(row.toAccountId) || row.toAccountId === row.accountId : row.toAccountId !== null))) return { error: "Ada catatan yang mengacu pada akun yang tidak tersedia." };
  return { data: { version: 2, exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "", accounts: a, transactions: t, budgets: b, categories: c, recurring: r } };
}
