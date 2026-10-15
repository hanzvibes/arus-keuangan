"use client";
import { Activity, Sparkles } from "lucide-react";
import type { FinanceData } from "@/domain/finance/types";
import { financialHealth, monthlyInsights } from "@/lib/client-productivity";
import { money } from "@/features/finance/lib/presentation";

export function ProductivitySummary({data,month}:{data:FinanceData;month:string}){const expenses=data.transactions.filter(row=>row.type==="expense"&&row.date.startsWith(month)).reduce((s,row)=>s+row.amount,0);const income=data.transactions.filter(row=>row.type==="income"&&row.date.startsWith(month)).reduce((s,row)=>s+row.amount,0);const insight=monthlyInsights(data.transactions,month);const health=financialHealth({income,expenses,saved:Math.max(0,income-expenses),budgetUsed:data.budgets.length?Math.round(data.budgets.reduce((s,b)=>s+Math.min(100,expenses/data.budgets.length/b.amount*100),0)/data.budgets.length):0});return <section className="productivity-summary" aria-label="Ringkasan pintar"><div><span><Activity size={15}/> Kesehatan keuangan</span><strong>{health.score}<small>/100</small></strong><p>{health.reasons[0]}</p></div><div><span><Sparkles size={15}/> Insight bulan ini</span><strong>{insight.biggestCategory||"Belum ada data"}</strong><p>{insight.biggestAmount?`${money(insight.biggestAmount)} jadi kategori terbesar.`:"Catat transaksi untuk melihat pola."}</p></div></section>}
