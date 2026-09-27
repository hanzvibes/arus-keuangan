import test from "node:test";
import assert from "node:assert/strict";
import { financeApi, FinanceApiError } from "../data/client/finance-api.ts";

function response(body = {}, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("finance API keeps the existing internal endpoint contract", async t => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return response({ ok: true, id: "x", accounts: [], transactions: [], budgets: [], categories: [], recurring: [] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  await financeApi.read();
  await financeApi.save("POST", { entity: "account", name: "Cash" });
  await financeApi.remove({ entity: "budget", id: "b" });
  await financeApi.reconcile({ accountId: "a", expectedBalance: 10, actualBalance: 20, note: "cek", date: "2026-09-27" });
  await financeApi.backup();
  await financeApi.restore({ version: 2, exportedAt: "", accounts: [], transactions: [], budgets: [], categories: [], recurring: [] });
  await financeApi.category("PATCH", { id: "c", name: "Baru" });
  await financeApi.recurring("DELETE", { id: "r" });

  assert.deepEqual(calls.map(call => [call.url, call.options.method || "GET"]), [
    ["/api/data", "GET"],
    ["/api/data", "POST"],
    ["/api/data", "DELETE"],
    ["/api/reconcile", "POST"],
    ["/api/backup", "GET"],
    ["/api/backup", "POST"],
    ["/api/categories", "PATCH"],
    ["/api/recurring", "DELETE"],
  ]);

  const restoreBody = JSON.parse(calls[5].options.body);
  assert.equal(restoreBody.confirm, "GANTI DATA");
  assert.equal(restoreBody.backup.version, 2);
});

test("finance API surfaces server errors with status and message", async t => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response({ error: "Sesi login diperlukan." }, { status: 401 });
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(
    () => financeApi.read(),
    error => error instanceof FinanceApiError &&
      error.status === 401 &&
      error.message === "Sesi login diperlukan.",
  );
});
