import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createWorker } from "tesseract.js";
import { parseReceipt, parseReceiptMoney } from "../src/features/receipt/parser.ts";
import { receiptArithmetic, validateReceiptDraft } from "../src/features/receipt/validation.ts";
import { receiptDuplicateReasons } from "../src/features/receipt/duplicate.ts";
import { validateBackup } from "../src/lib/backup.ts";

const parse = text => parseReceipt({ text, words: [], engine: "fixture" });

test("rupiah and typical receipts become editable expense drafts", () => {
  assert.equal(parseReceiptMoney("Rp 25.000"), 25000);
  assert.equal(parseReceiptMoney("25.000,00"), 25000);
  const cases = [
    ["INDOMARET\n02/10/2026\nSUSU 2 x 10000 20000\nSUBTOTAL 20000\nPPN 2000\nDISKON 1000\nTOTAL 21000\nTUNAI", "Belanja", 21000, "2026-10-02"],
    ["KOPI KENANGAN\n01-10-2026 11:30\nKOPI SUSU 1 x 25000 25000\nSUBTOTAL 25000\nSERVICE 2500\nTOTAL 27500\nQRIS", "Makanan & Minuman", 27500, "2026-10-01"],
    ["SPBU PERTAMINA\n2026-10-02\nPERTAMAX 1 x 50000 50000\nTOTAL 50000\nDEBIT", "Transportasi", 50000, "2026-10-02"],
    ["APOTEK KIMIA FARMA\n02/10/2026\nOBAT 1 x 17000 17000\nTOTAL 17000", "Kesehatan", 17000, "2026-10-02"],
  ];
  for (const [text, category, total, date] of cases) {
    const draft = parse(text);
    assert.equal(draft.category.value, category);
    assert.equal(draft.total.value, total);
    assert.equal(draft.date.value, date);
    assert.ok(draft.items.length);
    assert.equal(validateReceiptDraft(draft), true);
  }
});
test("missing total and mismatched arithmetic require review", () => {
  const missing = parse("TOKO A\n02/10/2026\nBARANG 10000");
  assert.equal(missing.total.value, null);
  assert.equal(validateReceiptDraft(missing), false);
  const mismatch = parse("TOKO B\n02/10/2026\nSUBTOTAL 10000\nPAJAK 1000\nSERVICE 0\nDISKON 0\nTOTAL 20000");
  assert.equal(receiptArithmetic(mismatch), "mismatch");
});
test("wrapped item names preserve quantity and unit price", () => {
  const draft = parse("RESTORAN A\n02/10/2026\nNASI GORENG SPESIAL\n2 x 15000 30000\nTOTAL 30000");
  assert.deepEqual(draft.items.map(({ name, quantity, unitPrice, total }) => ({ name, quantity, unitPrice, total })), [{ name: "NASI GORENG SPESIAL", quantity: 2, unitPrice: 15000, total: 30000 }]);
});
test("duplicate evidence uses image and transaction metadata", () => {
  const draft = parse("INDOMARET\n02/10/2026\nTOTAL 25000");
  const base = { id: "a", transactionId: "tx-a", imageHash: "x", visualHash: "1", draft };
  assert.deepEqual(receiptDuplicateReasons(base, { ...base, id: "b" }), ["Foto identik", "Foto terlihat mirip", "Merchant, tanggal, dan total sama"]);
});
test("backup v4 validates receipt references and keeps legacy backups readable", () => {
  const account = { id: "a", name: "Dompet", kind: "cash", openingBalance: 0, createdAt: "2026-10-02T00:00:00Z" };
  const transaction = { id: "tx", type: "expense", amount: 25000, accountId: "a", toAccountId: null, category: "Belanja", note: "Toko", date: "2026-10-02", createdAt: "2026-10-02T00:00:00Z" };
  const receipt = { transactionId: "tx", scanId: null, merchant: "Toko", paymentMethod: "QRIS", invoice: "", time: null, subtotal: null, tax: null, service: null, discount: null, items: [], fields: {}, imageHash: null, photoPath: null };
  const base = { exportedAt: "2026-10-02T00:00:00Z", accounts: [account], transactions: [transaction], budgets: [], categories: [], recurring: [], goals: [] };
  assert.ok(validateBackup({ ...base, version: 4, receipts: [receipt] }).data);
  assert.match(validateBackup({ ...base, version: 4, receipts: [{ ...receipt, transactionId: "unknown" }] }).error, /Struk/);
  assert.ok(validateBackup({ ...base, version: 3 }).data);
});
test("real OCR reads a clear fixture using packaged Indonesian and English models", { timeout: 120000 }, async () => {
  const langPath = path.resolve("public/ocr");
  const worker = await createWorker("ind+eng", 1, { langPath, gzip: false, cacheMethod: "none" });
  try {
    const image = await readFile(path.resolve("tests/fixtures/receipt-ocr.png"));
    const result = await worker.recognize(image);
    assert.match(result.data.text.toUpperCase(), /INDOMARET/);
    assert.match(result.data.text, /25[.,]?000/);
  } finally { await worker.terminate(); }
});
