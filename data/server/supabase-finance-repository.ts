import { createClient } from "@/lib/supabase/server";
import type { Backup } from "@/lib/backup";
import type { FinanceRepository, FinanceSnapshot } from "./finance-repository";
import { FinanceRepositoryError } from "./finance-repository";

type QueryError = { message: string; code?: string } | null;

function assertQuery(error: QueryError) {
  if (error) {
    throw new FinanceRepositoryError(
      "DATA_ACCESS",
      `${error.code ?? "DB"}: ${error.message}`,
    );
  }
}

function asNumber(value: number | string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new FinanceRepositoryError("DATA_ACCESS", "Nilai uang dari database tidak valid.");
  }
  return parsed;
}

const mapAccount = (row: any) => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  openingBalance: asNumber(row.opening_balance),
  createdAt: row.created_at,
});

const mapTransaction = (row: any) => ({
  id: row.id,
  type: row.type,
  amount: asNumber(row.amount),
  accountId: row.account_id,
  toAccountId: row.to_account_id,
  category: row.category,
  note: row.note,
  date: row.date,
  createdAt: row.created_at,
});

const mapBudget = (row: any) => ({
  id: row.id,
  category: row.category,
  amount: asNumber(row.amount),
  createdAt: row.created_at,
});

const mapCategory = (row: any) => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
});

const mapRecurring = (row: any) => ({
  id: row.id,
  type: row.type,
  amount: asNumber(row.amount),
  accountId: row.account_id,
  toAccountId: row.to_account_id,
  category: row.category,
  note: row.note,
  nextDate: row.next_date,
  frequency: row.frequency,
  anchorDay: row.anchor_day,
  active: row.active ? 1 : 0,
  createdAt: row.created_at,
});

export async function createFinanceRepository(): Promise<FinanceRepository> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : "";

  if (error || !userId) {
    throw new FinanceRepositoryError("UNAUTHENTICATED", "Sesi login tidak valid.");
  }

  return {
    async readSnapshot(): Promise<FinanceSnapshot> {
      const [accounts, transactions, budgets, categories, recurring] = await Promise.all([
        supabase.from("accounts").select("id,name,kind,opening_balance,created_at").order("created_at"),
        supabase.from("transactions").select("id,type,amount,account_id,to_account_id,category,note,date,created_at").order("date", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("budgets").select("id,category,amount,created_at").order("created_at"),
        supabase.from("categories").select("id,name,created_at").order("created_at"),
        supabase.from("recurring").select("id,type,amount,account_id,to_account_id,category,note,next_date,frequency,anchor_day,active,created_at").order("next_date"),
      ]);
      [accounts, transactions, budgets, categories, recurring].forEach(result => assertQuery(result.error));

      return {
        accounts: (accounts.data ?? []).map(mapAccount),
        transactions: (transactions.data ?? []).map(mapTransaction),
        budgets: (budgets.data ?? []).map(mapBudget),
        categories: (categories.data ?? []).map(mapCategory),
        recurring: (recurring.data ?? []).map(mapRecurring),
      };
    },

    async accountsExist(ids) {
      if (!ids.length) return true;
      const result = await supabase.from("accounts").select("id").in("id", ids);
      assertQuery(result.error);
      return (result.data ?? []).length === ids.length;
    },

    async createAccount(input) {
      const result = await supabase.from("accounts").insert({
        user_id: userId,
        id: input.id,
        name: input.name,
        kind: input.kind,
        opening_balance: input.openingBalance,
        created_at: input.createdAt,
      });
      assertQuery(result.error);
    },

    async getAccountOpeningBalance(id) {
      const result = await supabase.from("accounts").select("opening_balance").eq("id", id).maybeSingle();
      assertQuery(result.error);
      return result.data ? asNumber(result.data.opening_balance) : null;
    },

    async accountHasTransactions(id) {
      const [from, to] = await Promise.all([
        supabase.from("transactions").select("id").eq("account_id", id).limit(1),
        supabase.from("transactions").select("id").eq("to_account_id", id).limit(1),
      ]);
      assertQuery(from.error);
      assertQuery(to.error);
      return Boolean((from.data ?? []).length || (to.data ?? []).length);
    },

    async updateAccount(id, input) {
      const result = await supabase.from("accounts").update({
        name: input.name,
        kind: input.kind,
        opening_balance: input.openingBalance,
      }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async accountReferenced(id) {
      const [txFrom, txTo, recurringFrom, recurringTo] = await Promise.all([
        supabase.from("transactions").select("id").eq("account_id", id).limit(1),
        supabase.from("transactions").select("id").eq("to_account_id", id).limit(1),
        supabase.from("recurring").select("id").eq("account_id", id).limit(1),
        supabase.from("recurring").select("id").eq("to_account_id", id).limit(1),
      ]);
      [txFrom, txTo, recurringFrom, recurringTo].forEach(result => assertQuery(result.error));
      return [txFrom, txTo, recurringFrom, recurringTo].some(result => (result.data ?? []).length > 0);
    },

    async deleteAccount(id) {
      const result = await supabase.from("accounts").delete().eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async createTransaction(input) {
      const result = await supabase.from("transactions").insert({
        user_id: userId,
        id: input.id,
        type: input.type,
        amount: input.amount,
        account_id: input.accountId,
        to_account_id: input.toAccountId,
        category: input.category,
        note: input.note,
        date: input.date,
        created_at: input.createdAt,
      });
      if (result.error?.code === "23505") return "duplicate";
      assertQuery(result.error);
      return "created";
    },

    async getTransactionType(id) {
      const result = await supabase.from("transactions").select("type").eq("id", id).maybeSingle();
      assertQuery(result.error);
      return result.data?.type ?? null;
    },

    async updateTransaction(id, input) {
      const result = await supabase.from("transactions").update({
        type: input.type,
        amount: input.amount,
        account_id: input.accountId,
        to_account_id: input.toAccountId,
        category: input.category,
        note: input.note,
        date: input.date,
      }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async deleteTransaction(id) {
      const result = await supabase.from("transactions").delete().eq("id", id);
      assertQuery(result.error);
    },

    async transactionExists(id) {
      const result = await supabase.from("transactions").select("id").eq("id", id).maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async createBudget(input) {
      const result = await supabase.from("budgets").insert({
        user_id: userId,
        id: input.id,
        category: input.category,
        amount: input.amount,
        created_at: input.createdAt,
      });
      if (result.error?.code === "23505") return "duplicate";
      assertQuery(result.error);
      return "created";
    },

    async updateBudget(id, input) {
      const result = await supabase.from("budgets").update({
        category: input.category,
        amount: input.amount,
      }).eq("id", id).select("id").maybeSingle();
      if (result.error?.code === "23505") return "duplicate";
      assertQuery(result.error);
      return result.data ? "updated" : "missing";
    },

    async deleteBudget(id) {
      const result = await supabase.from("budgets").delete().eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async listCategories() {
      const result = await supabase.from("categories").select("id,name");
      assertQuery(result.error);
      return result.data ?? [];
    },

    async createCategory(input) {
      const result = await supabase.from("categories").insert({
        user_id: userId,
        id: input.id,
        name: input.name,
        created_at: input.createdAt,
      });
      if (result.error?.code === "23505") return "duplicate";
      assertQuery(result.error);
      return "created";
    },

    async getCategoryName(id) {
      const result = await supabase.from("categories").select("name").eq("id", id).maybeSingle();
      assertQuery(result.error);
      return result.data?.name ?? null;
    },

    async renameCategory(id, name) {
      const result = await supabase.rpc("arus_rename_category", { p_id: id, p_name: name });
      if (result.error?.code === "23505") return "duplicate";
      assertQuery(result.error);
      return result.data ? "renamed" : "missing";
    },

    async categoryReferenced(name) {
      const [transactions, budgets, recurring] = await Promise.all([
        supabase.from("transactions").select("id").eq("category", name).limit(1),
        supabase.from("budgets").select("id").eq("category", name).limit(1),
        supabase.from("recurring").select("id").eq("category", name).limit(1),
      ]);
      assertQuery(transactions.error);
      assertQuery(budgets.error);
      assertQuery(recurring.error);
      return Boolean(
        (transactions.data ?? []).length ||
        (budgets.data ?? []).length ||
        (recurring.data ?? []).length
      );
    },

    async deleteCategory(id) {
      const result = await supabase.from("categories").delete().eq("id", id);
      assertQuery(result.error);
    },

    async skipRecurring(id, due) {
      const result = await supabase.rpc("arus_skip_recurring", { p_id: id, p_due: due });
      assertQuery(result.error);
      return typeof result.data === "string" ? result.data : null;
    },

    async recordRecurring(id, due, recordedDate) {
      const result = await supabase.rpc("arus_record_recurring", {
        p_id: id,
        p_due: due,
        p_recorded_date: recordedDate,
      });
      if (result.error?.code === "23505") return "duplicate";
      assertQuery(result.error);
      return typeof result.data === "string" ? { nextDate: result.data } : null;
    },

    async createRecurring(input) {
      const result = await supabase.from("recurring").insert({
        user_id: userId,
        id: input.id,
        type: input.type,
        amount: input.amount,
        account_id: input.accountId,
        to_account_id: input.toAccountId,
        category: input.category,
        note: input.note,
        next_date: input.nextDate,
        frequency: input.frequency,
        anchor_day: input.anchorDay,
        active: input.active ?? true,
        created_at: input.createdAt ?? new Date().toISOString(),
      });
      assertQuery(result.error);
    },

    async toggleRecurring(id, active) {
      const result = await supabase.from("recurring").update({ active }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async getRecurringMeta(id) {
      const result = await supabase.from("recurring").select("next_date,anchor_day,frequency").eq("id", id).maybeSingle();
      assertQuery(result.error);
      if (!result.data) return null;
      return {
        nextDate: result.data.next_date,
        anchorDay: result.data.anchor_day,
        frequency: result.data.frequency,
      };
    },

    async updateRecurring(id, input) {
      const result = await supabase.from("recurring").update({
        type: input.type,
        amount: input.amount,
        account_id: input.accountId,
        to_account_id: input.toAccountId,
        category: input.category,
        note: input.note,
        next_date: input.nextDate,
        frequency: input.frequency,
        anchor_day: input.anchorDay,
      }).eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async deleteRecurring(id) {
      const result = await supabase.from("recurring").delete().eq("id", id).select("id").maybeSingle();
      assertQuery(result.error);
      return Boolean(result.data);
    },

    async reconcile(input) {
      const result = await supabase.rpc("arus_reconcile_balance", {
        p_account_id: input.accountId,
        p_expected_balance: input.expectedBalance,
        p_actual_balance: input.actualBalance,
        p_note: input.note,
        p_date: input.date,
        p_adjustment_category: input.adjustmentCategory,
      });
      assertQuery(result.error);
      return typeof result.data === "string" ? result.data : null;
    },

    async restoreBackup(backup: Backup) {
      const result = await supabase.rpc("arus_restore_backup", { p_backup: backup });
      assertQuery(result.error);
      const counts = result.data as { accounts?: number; transactions?: number; budgets?: number } | null;
      return {
        accounts: counts?.accounts ?? 0,
        transactions: counts?.transactions ?? 0,
        budgets: counts?.budgets ?? 0,
      };
    },
  };
}
