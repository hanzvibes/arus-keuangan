import test from "node:test";
import assert from "node:assert/strict";
import { monthlyReport, monthlyTrend, percentageChange, shiftMonth, searchTransactions, sortTransactions } from "../lib/reports.ts";
import { savingsProgress, validateSavingsInput } from "../lib/savings.ts";
import { validateBackup } from "../lib/backup.ts";

const row = (id, type, amount, date, category = "Makanan") => ({ id, type, amount, date, category, accountId: "a", toAccountId: type === "transfer" ? "b" : null, note: "" });
test("reports isolate calendar months and exclude transfers and adjustments from cashflow", () => {
  const rows = [row("1","income",1000,"2026-01-01"),row("2","expense",300,"2026-01-31"),row("3","transfer",400,"2026-01-03"),row("4","adjustment",-100,"2026-01-04"),row("5","expense",900,"2025-12-31"),row("6","expense",100,"2026-01-15","Transportasi")];
  const report = monthlyReport(rows,"2026-01");
  assert.equal(report.income,1000); assert.equal(report.expense,400);
  assert.equal(report.net,600); assert.equal(report.savingsRate,60);
  assert.deepEqual(report.categories,[{category:"Makanan",amount:300},{category:"Transportasi",amount:100}]);
  assert.equal(report.count,5);
  assert.equal(monthlyReport([],"2026-01").savingsRate,null);
  assert.equal(monthlyReport([row("1","expense",10,"2026-01-01")],"2026-01").net,-10);
});
test("trend includes six ordered months across year boundaries, including zero months", () => {
  assert.equal(shiftMonth("2026-01",-1),"2025-12");
  assert.equal(shiftMonth("2026-12",1),"2027-01");
  assert.deepEqual(monthlyTrend([],"2026-02").map(point=>point.month),["2025-09","2025-10","2025-11","2025-12","2026-01","2026-02"]);
  assert.equal(percentageChange(100,0),null); assert.equal(percentageChange(0,100),-100); assert.equal(percentageChange(150,100),50);
});
test("search matches source and destination account names; sorting is stable and does not mutate rows", () => {
  const rows=[row("1","expense",300,"2026-01-02"),row("2","transfer",500,"2026-01-01"),row("3","adjustment",-700,"2026-01-03")];
  const accounts=[{id:"a",name:"BCA"},{id:"b",name:"Dana"}];
  assert.deepEqual(searchTransactions(rows,accounts,"  DANA ").map(row=>row.id),["2"]);
  assert.equal(searchTransactions(rows,accounts,"bca").length,3);
  assert.deepEqual(sortTransactions(rows,"largest").map(row=>row.id),["3","2","1"]);
  assert.deepEqual(sortTransactions(rows,"oldest").map(row=>row.id),["2","1","3"]);
  assert.deepEqual(rows.map(row=>row.id),["1","2","3"]);
});
test("savings validates integer rupiah and real dates", () => {
  const goal={name:"Dana darurat",targetAmount:1000,savedAmount:0,targetDate:"2028-02-29"};
  assert.ok(validateSavingsInput(goal));
  for (const patch of [{targetAmount:0},{targetAmount:1.5},{savedAmount:-1},{savedAmount:"1"},{targetDate:"2027-02-29"},{targetDate:undefined},{name:" ".repeat(10)},{targetAmount:1_000_000_000_001}]) assert.equal(validateSavingsInput({...goal,...patch}),null);
});
test("savings projections handle completed, overdue and current-month deadlines", () => {
  const goal={name:"Dana darurat",targetAmount:1000,savedAmount:200,targetDate:"2026-12-31"};
  assert.deepEqual(savingsProgress(goal,"2026-09-30"),{remaining:800,percent:20,overdue:false,monthlyAmount:200,completed:false});
  assert.equal(savingsProgress({...goal,targetDate:"2026-09-30"},"2026-09-30").monthlyAmount,800);
  assert.equal(savingsProgress({...goal,targetDate:"2026-09-29"},"2026-09-30").overdue,true);
  assert.equal(savingsProgress({...goal,savedAmount:1200},"2026-09-30").percent,100);
  assert.equal(savingsProgress({...goal,savedAmount:1200},"2026-09-30").remaining,0);
});
test("backup v3 includes validated goals while legacy backups omit goals", () => {
  const base={version:2,exportedAt:"2026-09-30T00:00:00Z",accounts:[],transactions:[],budgets:[],categories:[],recurring:[]};
  const goal={id:"goal_1",name:"Dana darurat",targetAmount:1000,savedAmount:200,targetDate:null,createdAt:base.exportedAt,updatedAt:base.exportedAt};
  assert.equal(Object.hasOwn(validateBackup(base).data,"goals"),false);
  assert.deepEqual(validateBackup({...base,version:3,goals:[goal]}).data.goals,[goal]);
  for (const goals of [undefined,[goal,goal],[{...goal,savedAmount:-1}],[{...goal,targetDate:"2026-02-31"}],[{...goal,updatedAt:"invalid"}]]) assert.match(validateBackup({...base,version:3,goals}).error,/target tabungan/);
});
