import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("legacy CSS selectors stay removed after their UI paths are gone", async () => {
  const styles = (
    await Promise.all([
      "src/styles/finance.css",
      "src/styles/enhancements.css",
      "src/styles/native.css",
    ].map((path) => readFile(path, "utf8")))
  ).join("\n");

  for (const className of [
    "all-actions",
    "analytics-grid",
    "analytics-net",
    "analytics-stat",
    "filter-bar",
    "load-state",
    "pwa-guide",
    "quick-text-cta",
    "row-edit",
  ]) {
    assert.doesNotMatch(
      styles,
      new RegExp(`\\.${className}(?![A-Za-z0-9_-])`),
      `legacy selector .${className} should not remain in application CSS`,
    );
  }
});


test("CSS cleanup preserves surviving grouped selectors", async () => {
  const finance = await readFile("src/styles/finance.css", "utf8");

  assert.doesNotMatch(
    finance,
    /\.account-summary span,\.eyebrow,\.account-summary strong/,
    "eyebrow must not inherit the account balance heading size",
  );
  assert.match(
    finance,
    /\.account-summary span,\.eyebrow\{[^}]*font-size:12px/,
    "eyebrow must keep the compact label typography",
  );
  assert.doesNotMatch(finance, /\.transaction-surface \.transaction-surface \.row-delete/);
  assert.doesNotMatch(finance, /\.account-row \.account-row \.row-delete/);
  assert.match(finance, /\.transaction-surface \.row-delete\{grid-column:4;grid-row:2\}/);
  assert.match(finance, /\.account-row \.row-delete\{grid-column:auto;grid-row:auto\}/);
});
