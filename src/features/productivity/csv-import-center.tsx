"use client";
import { useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import type { QueuedTransaction } from "@/domain/finance/types";
import { parseCsvTransactions } from "@/lib/client-productivity";

export function CsvImportCenter({accountId,onImport}:{accountId?:string;onImport:(rows:QueuedTransaction[])=>Promise<void>}){
  const input=useRef<HTMLInputElement>(null); const [rows,setRows]=useState<QueuedTransaction[]>([]); const [errors,setErrors]=useState<string[]>([]); const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false);
  const read=(file:File)=>{void file.text().then(text=>{const result=parseCsvTransactions(text);setErrors(result.errors);setRows(result.valid.filter(row=>row.type!=="adjustment").map(row=>({...row,type:row.type as "income"|"expense",id:crypto.randomUUID(),accountId:accountId||"",toAccountId:null,queuedAt:new Date().toISOString()})));setOpen(true)})};
  const submit=async()=>{if(!accountId||!rows.length)return;setBusy(true);try{await onImport(rows);setOpen(false);setRows([])}finally{setBusy(false)}};
  return <><button className="csv-import-trigger" onClick={()=>input.current?.click()}><FileUp size={16}/> Impor CSV</button><input ref={input} hidden type="file" accept=".csv,text/csv" onChange={event=>{const file=event.target.files?.[0];if(file)read(file);event.target.value=""}}/>{open&&<div className="csv-import-backdrop"><section className="csv-import-panel" role="dialog" aria-label="Pratinjau impor CSV"><header><strong>Pratinjau CSV</strong><button onClick={()=>setOpen(false)} aria-label="Tutup"><X size={17}/></button></header><p>{rows.length} transaksi siap diimpor{errors.length?`, ${errors.length} baris ditolak`:""}.</p>{errors.length>0&&<ul>{errors.slice(0,5).map(error=><li key={error}>{error}</li>)}</ul>}<div className="csv-import-actions"><button onClick={()=>setOpen(false)}>Batal</button><button disabled={busy||!rows.length||!accountId} onClick={()=>void submit()}>{busy?"Mengimpor…":"Impor transaksi"}</button></div></section></div>}</>;
}
