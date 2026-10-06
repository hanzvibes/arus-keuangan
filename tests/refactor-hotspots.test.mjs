import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("FinanceApp delegates backup and export flows to a dedicated hook", async () => {
  const app = await readFile("src/features/finance/components/finance-app.tsx", "utf8");
  const hook = await readFile("src/features/finance/hooks/use-finance-backup.ts", "utf8");

  assert.match(app, /useFinanceBackup/);
  assert.doesNotMatch(app, /validateBackup/);
  assert.doesNotMatch(app, /function download\(/);
  assert.match(hook, /financeApi\.backup\(\)/);
  assert.match(hook, /financeApi\.restore\(/);
  assert.match(hook, /validateBackup/);
});

test("ReceiptScanner delegates receipt persistence and photo upload", async () => {
  const scanner = await readFile("src/features/receipt/components/receipt-scanner.tsx", "utf8");
  const persistence = await readFile("src/features/receipt/save-transaction.ts", "utf8");

  assert.match(scanner, /saveReceiptTransaction/);
  assert.doesNotMatch(scanner, /storage[\s\S]*\.from\("arus-receipts"\)[\s\S]*\.upload\(/);
  assert.doesNotMatch(scanner, /receiptApi\.finalize\(/);
  assert.match(persistence, /storage[\s\S]*\.from\("arus-receipts"\)[\s\S]*\.upload\(/);
  assert.match(persistence, /receiptApi\.finalize\(/);
  assert.match(persistence, /receiptApi\.updateTransaction\(/);
});
