import test from "node:test";
import assert from "node:assert/strict";
import { filterTransactions, simulateBudget, financialHealth, monthlyInsights, parseCsvTransactions } from "../src/lib/client-productivity.ts";

const rows=[{id:"1",type:"expense",amount:800,accountId:"cash",toAccountId:null,category:"Makan",note:"Lunch",date:"2026-10-05"},{id:"2",type:"income",amount:2000,accountId:"cash",toAccountId:null,category:"Gaji",note:"",date:"2026-10-01"}];
test("filters by amount, type, category and date",()=>assert.deepEqual(filterTransactions(rows,{type:"expense",category:"Makan",min:500,max:900,from:"2026-10-01",to:"2026-10-31"}),[rows[0]]));
test("simulates budget without mutating source",()=>{const budget={id:"b",category:"Makan",amount:1000};const result=simulateBudget(budget,800,100);assert.equal(result.spent,900);assert.equal(result.percent,90);assert.equal(budget.amount,1000);});
test("health score stays bounded and explains inputs",()=>{const result=financialHealth({income:2000,expenses:800,saved:1200,budgetUsed:40});assert.ok(result.score>=0&&result.score<=100);assert.ok(result.reasons.length>0);});
test("monthly insights identify biggest expense category",()=>assert.equal(monthlyInsights(rows,"2026-10").biggestCategory,"Makan"));
test("CSV parser reports invalid rows and parses valid rows",()=>{const result=parseCsvTransactions("date,type,amount,category,note\n2026-10-01,expense,120,Makan,Lunch\nbad,expense,nope,Makan,Broken");assert.equal(result.valid.length,1);assert.equal(result.errors.length,1);});
