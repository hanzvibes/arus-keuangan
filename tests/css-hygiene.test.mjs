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
