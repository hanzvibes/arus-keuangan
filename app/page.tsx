"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, BarChart3, Check, ChevronLeft, ChevronRight, CreditCard, Download, Eye, EyeOff, Home, Landmark, LayoutGrid, MessageCircle, Minus, Pencil, Plus, Search, Settings2, Scale, Trash2, Upload, Wallet, WifiOff, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast, Toaster } from "sonner";
import { validateBackup, type Backup } from "@/lib/backup";
import { parseQuickEntry } from "@/lib/quick-entry";
import { accountBalance as balance, budgetSummary, reconciliationDelta } from "@/lib/finance";
import { allCategories, defaultCategories } from "@/lib/categories";
import { readQueue, readSnapshot, enqueueTransaction, removeQueuedTransaction, writeSnapshot, clearDeviceCache } from "@/lib/offline";
import { RecurringSection } from "@/components/recurring-section";\nimport { AuthUser } from "@/components/auth-user";
import { CategoryManager } from "@/components/category-manager";
import { usePwa } from "@/lib/use-pwa";
import { FinanceApiError, financeApi } from "@/data/client/finance-api";
import type { Account, Transaction, Budget, FinanceData as Data, QueuedTransaction, TransactionType } from "@/domain/finance/types";

type Tab = "home" | "accounts" | "transactions" | "budget" | "analytics" | "settings";
type Mode = "account" | "transaction" | "budget" | "quick" | null;
type EntryType = Exclude<TransactionType, "adjustment">;
const empty: Data = { accounts: [], transactions: [], budgets: [], categories: [], recurring: [] };
const money = (n: number) => "Rp " + Math.round(n).toLocaleString("id-ID");
const day = (d = new Date()) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const dateText = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const demoData: Data = {
  accounts: [{ id:"a",name:"BCA",kind:"bank",openingBalance:8545000 },{ id:"b",name:"Mandiri Tabungan",kind:"bank",openingBalance:9900000 },{ id:"c",name:"GoPay",kind:"ewallet",openingBalance:2779825 },{ id:"d",name:"Cash",kind:"cash",openingBalance:1170000 },{ id:"e",name:"Jago",kind:"bank",openingBalance:0 },{ id:"f",name:"DANA",kind:"ewallet",openingBalance:0 },{ id:"g",name:"OVO",kind:"ewallet",openingBalance:0 },{ id:"h",name:"Tabungan",kind:"bank",openingBalance:0 }],
  transactions: [
    { id:"1",type:"expense",amount:67000,accountId:"c",toAccountId:null,category:"Makanan & Minuman",note:"Ice Latte",date:day() },
    { id:"2",type:"expense",amount:95000,accountId:"a",toAccountId:null,category:"Hiburan",note:"Tennis",date:day(new Date(Date.now()-86400000)) },
    { id:"3",type:"expense",amount:35000,accountId:"c",toAccountId:null,category:"Kesehatan",note:"Konsul Halodoc",date:day(new Date(Date.now()-172800000)) },
    { id:"4",type:"income",amount:4500000,accountId:"a",toAccountId:null,category:"Gaji",note:"Gaji bulanan",date:day(new Date(Date.now()-345600000)) },
  ],
  budgets: [{ id:"1",category:"Makanan & Minuman",amount:2500000 },{ id:"2",category:"Hiburan",amount:500000 }],
  categories: [], recurring: [],
};
const navigation: { id: Tab; label: string; icon: typeof Home }[] = [
  { id:"home",label:"Beranda",icon:Home },{ id:"accounts",label:"Akun",icon:Wallet },{ id:"transactions",label:"Transaksi",icon:ArrowLeftRight },{ id:"budget",label:"Budget",icon:LayoutGrid },{ id:"analytics",label:"Analitik",icon:BarChart3 },{ id:"settings",label:"Data & Cadangan",icon:Settings2 },
];
const emoji = (c: string) => ({ "Makanan & Minuman":"☕",Transportasi:"🚗",Belanja:"🛍",Tagihan:"🧾",Kesehatan:"✚",Hiburan:"🎾",Pendidikan:"📚",Gaji:"↗",Transfer:"⇄" } as Record<string,string>)[c] || "◈";
export default function Page() {
  const [data,setData]=useState<Data>(empty), [demo,setDemo]=useState(false), [loading,setLoading]=useState(true), [error,setError]=useState(false);
  const [tab,setTab]=useState<Tab>("home"), [mode,setMode]=useState<Mode>(null), [type,setType]=useState<EntryType>("expense");
  const [hidden,setHidden]=useState(false), [query,setQuery]=useState(""), [saving,setSaving]=useState(false);
  const [weekEnd]=useState(()=>day());
  const [month,setMonth]=useState(day().slice(0,7)), [filterType,setFilterType]=useState("all"), [filterAccount,setFilterAccount]=useState("all"), [filterCategory,setFilterCategory]=useState("all"), [transactionView,setTransactionView]=useState<"history"|"schedule">("history");
  const [queued,setQueued]=useState<QueuedTransaction[]>([]), [stale,setStale]=useState(false), [connected,setConnected]=useState(true);
  const [queueError,setQueueError]=useState(""), [syncingQueue,setSyncingQueue]=useState(false);
  const syncing=useRef(false);
  const pwa=usePwa();
  const [installTipDismissed,setInstallTipDismissed]=useState(()=>typeof window!=="undefined"&&sessionStorage.getItem("arus_install_tip_dismissed")==="1");
  const [installGuideOpen,setInstallGuideOpen]=useState(false);
  const [editing,setEditing]=useState<string|null>(null), [quickText,setQuickText]=useState("");
  const [pendingBackup,setPendingBackup]=useState<Backup|null>(null), [restoring,setRestoring]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const [target,setTarget]=useState<{entity:string;id:string;label:string}|null>(null);
  const [name,setName]=useState(""), [kind,setKind]=useState("bank"), [opening,setOpening]=useState("");
  const [amount,setAmount]=useState(""), [account,setAccount]=useState(""), [destination,setDestination]=useState("");
  const [category,setCategory]=useState(defaultCategories[0]), [note,setNote]=useState(""), [date,setDate]=useState(day());
  const [reconcileAccount,setReconcileAccount]=useState<Account|null>(null), [expectedBalance,setExpectedBalance]=useState(0);
  const [actualBalance,setActualBalance]=useState(""), [reconcileNote,setReconcileNote]=useState(""), [reconcileSaving,setReconcileSaving]=useState(false);
  const refresh=useCallback(async()=>{
    try { const d=await financeApi.read(); setData(d); void writeSnapshot(d).catch(console.error); setDemo(!d.accounts.length&&!d.transactions.length&&!d.budgets.length&&!d.categories.length&&!d.recurring.length&&localStorage.getItem("arus_demo_dismissed")!=="1"); setStale(false); setConnected(true); setError(false); }
    catch { const cached=await readSnapshot<Data>().catch(()=>null); if(cached){setData(cached);setDemo(false);setStale(true);setError(false);}else setError(true); } finally { setLoading(false); }
  },[]);
  const syncQueue=useCallback(async()=>{
    if(syncing.current || !navigator.onLine)return;
    syncing.current=true;setSyncingQueue(true);
    try {
      const pending=(await readQueue<QueuedTransaction>()).sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt));
      for(const item of pending){
        const transaction={id:item.id,type:item.type,amount:item.amount,accountId:item.accountId,toAccountId:item.toAccountId,category:item.category,note:item.note,date:item.date};
        try { await financeApi.save("POST",{...transaction,entity:"transaction"}); }
        catch(e){setQueueError(e instanceof FinanceApiError?e.message:"Koneksi terputus. Coba kirim lagi saat tersambung.");break;}
        await removeQueuedTransaction(item.id);setQueued(await readQueue<QueuedTransaction>());
        setQueueError("");
      }
      if(pending.length)await refresh();
    }catch{setQueueError("Koneksi terputus. Coba kirim lagi saat tersambung.");}
    finally{syncing.current=false;setSyncingQueue(false);}
  },[refresh]);
  useEffect(()=>{queueMicrotask(()=>void refresh());void readQueue<QueuedTransaction>().then(setQueued).catch(console.error);},[refresh]);
  useEffect(()=>{queueMicrotask(()=>void syncQueue());const onOnline=()=>{setConnected(true);void syncQueue();void refresh();};const onOffline=()=>setConnected(false);window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);};},[syncQueue,refresh]);
  const offline=stale||!connected;
  const shownBase=demo?demoData:data;
  const shown={...shownBase,transactions:[...queued.filter(t=>!shownBase.transactions.some(saved=>saved.id===t.id)),...shownBase.transactions].sort((a,b)=>b.date.localeCompare(a.date)||(b.queuedAt||b.createdAt||"").localeCompare(a.queuedAt||a.createdAt||""))};
  const categories=allCategories(shownBase.categories), fmt=(n:number)=>hidden?"Rp •••••••":money(n);
  const total=shown.accounts.reduce((s,a)=>s+balance(a,shown.transactions),0);
  useEffect(()=>{
    type Context = { registerTool: (tool: Record<string, unknown>, options: {signal:AbortSignal})=>void|Promise<void> };
    const context=(document as Document & {modelContext?:Context}).modelContext;
    if(!context?.registerTool || loading || error)return;
    const controller=new AbortController();
    const register=(tool:Record<string,unknown>)=>{try{void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(console.error);}catch(e){console.error(e);}};
    register({name:"read_finance_summary",title:"Baca ringkasan keuangan",description:"Baca saldo dan jumlah akun dari tampilan saat ini.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({demo,totalBalance:total,accountCount:shown.accounts.length})});
    register({name:"start_transaction_creation",title:"Buka pencatatan transaksi",description:"Buka formulir pencatatan transaksi di aplikasi.",inputSchema:{type:"object",properties:{type:{type:"string",enum:["income","expense","transfer"]}},required:["type"],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{const value=(input as {type?:string})?.type;if(!["income","expense","transfer"].includes(value||""))throw Error("Jenis transaksi tidak valid.");if(demo||!data.accounts.length){localStorage.setItem("arus_demo_dismissed","1");setDemo(false);setTab("accounts");setMode("account");return {opened:"account",reason:"Tambahkan akun lebih dulu"};}setType(value as EntryType);setAccount(data.accounts[0].id);setMode("transaction");return {opened:"transaction",type:value};}});
    return()=>controller.abort();
  },[loading,error,demo,total,shown.accounts.length,data.accounts]);
  const expenses=shown.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(month));
  const out=expenses.reduce((s,t)=>s+t.amount,0), income=shown.transactions.filter(t=>t.type==="income"&&t.date.startsWith(month)).reduce((s,t)=>s+t.amount,0);
  const {total:budgetTotal,spent:budgetedSpend,percent:budgetPercent}=budgetSummary(shown.budgets,shown.transactions,month);
  const week=Array.from({length:7},(_,i)=>{const date=new Date(weekEnd+"T12:00:00");date.setDate(date.getDate()-(6-i));const target=day(date);return {date:target,label:date.toLocaleDateString("id-ID",{weekday:"short"}).slice(0,3),value:shown.transactions.filter(t=>t.type==="expense"&&t.date===target).reduce((s,t)=>s+t.amount,0)};});
  const weekTotal=week.reduce((s,d)=>s+d.value,0), high=week.reduce((a,b)=>b.value>a.value?b:a,week[0]), peak=Math.max(...week.map(d=>d.value),demo?110000:1);
  const byCategory=categories.map(c=>({category:c,amount:expenses.filter(t=>t.category===c).reduce((s,t)=>s+t.amount,0)})).filter(x=>x.amount).sort((a,b)=>b.amount-a.amount);
  const filteredTransactions=shown.transactions.filter(t=>t.date.startsWith(month)&&(filterType==="all"||t.type===filterType)&&(filterAccount==="all"||t.accountId===filterAccount||t.toAccountId===filterAccount)&&(filterCategory==="all"||t.category===filterCategory)&&(t.note+" "+t.category).toLowerCase().includes(query.toLowerCase()));
  const activeBudget=type==="expense"?shown.budgets.find(b=>b.category===category):undefined;
  const beforeBudget=activeBudget?shown.transactions.filter(t=>t.type==="expense"&&t.category===category&&t.date.startsWith(date.slice(0,7))&&t.id!==editing).reduce((sum,t)=>sum+t.amount,0):0;
  const afterBudget=beforeBudget+Number(amount||0);
  const changeMonth=(delta:number)=>{const [year,number]=month.split("-").map(Number);const next=new Date(year,number-1+delta,1);setMonth([next.getFullYear(),String(next.getMonth()+1).padStart(2,"0")].join("-"));};
  const periodControls=<div className="period-control"><button aria-label="Bulan sebelumnya" onClick={()=>changeMonth(-1)}><ChevronLeft size={19}/></button><span>{new Date(month+"-01T12:00:00").toLocaleDateString("id-ID",{month:"long",year:"numeric"})}</span><button aria-label="Bulan berikutnya" onClick={()=>changeMonth(1)}><ChevronRight size={19}/></button></div>;
  async function dropQueued(id:string){
    if(syncing.current){toast.info("Tunggu pengiriman transaksi selesai.");return;}
    syncing.current=true;
    try{
      if(navigator.onLine){
        const current=await financeApi.read();
        if(current.transactions.some(t=>t.id===id)){
          await removeQueuedTransaction(id);setQueued(await readQueue<QueuedTransaction>());setData(current);void writeSnapshot(current).catch(console.error);setQueueError("");
          toast.info("Transaksi sudah tercatat. Hapus dari riwayat jika ingin membatalkannya.");return;
        }
      }
      await removeQueuedTransaction(id);setQueued(await readQueue<QueuedTransaction>());setQueueError("");
      toast.success(navigator.onLine?"Transaksi dibatalkan dari antrean.":"Dihapus dari antrean perangkat. Periksa riwayat saat online.");
    }catch(e){toast.error(e instanceof Error?e.message:"Antrean belum bisa diubah.");}
    finally{syncing.current=false;}
  }
  const displayTx=(items:Transaction[],deletable=false)=><div className="transaction-list">{items.length?items.map(t=>{const waiting=queued.some(q=>q.id===t.id), adjustment=t.type==="adjustment";return <div className="transaction-row" key={t.id}><span className={"transaction-icon "+t.type}>{adjustment?<Scale size={18}/>:t.type==="transfer"?<ArrowLeftRight size={18}/>:emoji(t.category)}</span><div className="transaction-info"><b>{adjustment?"Penyesuaian saldo · "+t.note:t.note||t.category}</b><small>{shown.accounts.find(a=>a.id===t.accountId)?.name||"Akun"} · {dateText(t.date)}{waiting?" · Menunggu sinkronisasi":""}</small></div><strong className={t.type==="income"||adjustment&&t.amount>0?"green":""}>{adjustment?(t.amount>0?"+ ":"− ")+fmt(Math.abs(t.amount)):(t.type==="income"?"+ ":t.type==="expense"?"− ":"")+fmt(t.amount)}</strong>{deletable&&!demo&&(adjustment?<span className="immutable-note">Tercatat</span>:waiting?<button className="row-delete" disabled={syncingQueue} aria-label={"Batalkan antrean "+(t.note||t.category)} onClick={()=>void dropQueued(t.id)}><Trash2 size={16}/></button>:<><button className="row-edit" aria-label={"Edit "+(t.note||t.category)} onClick={()=>edit("transaction",t)}><Pencil size={16}/></button><button className="row-delete" aria-label={"Hapus "+(t.note||t.category)} onClick={()=>setTarget({entity:"transaction",id:t.id,label:t.note||t.category})}><Trash2 size={16}/></button></>)}</div>}):<div className="empty-inside">Belum ada transaksi untuk filter ini.</div>}</div>;
  const budgetRow=(b:Budget)=>{const spent=expenses.filter(t=>t.category===b.category).reduce((s,t)=>s+t.amount,0),percent=Math.round(spent/b.amount*100),ratio=spent/b.amount;return <div className="budget-row"><div className="budget-line"><div><span className="budget-icon">{emoji(b.category)}</span><b>{b.category}</b></div><strong className={ratio>=1?"red":ratio>=.8?"amber":"green"}>{percent}%</strong></div><div className="progress"><span style={{width:Math.min(percent,100)+"%",background:ratio>=1?"#df5a55":ratio>=.8?"#d79b2d":undefined}}/></div><div className="budget-numbers"><span>Terpakai {fmt(spent)}</span><span>Sisa {fmt(Math.max(0,b.amount-spent))}</span></div>{ratio>=.8&&<small className={"budget-warning "+(ratio>=1?"red":"amber")}>{ratio>1?"Budget terlampaui":ratio===1?"Budget habis":"Mendekati batas budget"}</small>}</div>};
  const changeTab=(next:Tab)=>{setTab(next);setQuery("");window.scrollTo({top:0,behavior:"smooth"});};
  async function copyAppLink(){
    try{await navigator.clipboard.writeText(window.location.origin+"/");toast.success("Tautan Arus disalin. Tempel di Chrome atau Safari.");}
    catch{toast.error("Salin tautan yang tertera, lalu buka di browser.");}
  }
  const dismissDemo=()=>{localStorage.setItem("arus_demo_dismissed","1");setDemo(false);};
  function startReconcile(a:Account) {
    if(offline){toast.error("Sambungkan internet untuk mencocokkan saldo.");return;}
    if(queued.some(t=>t.accountId===a.id||t.toAccountId===a.id)){toast.error("Kirim atau batalkan transaksi tertunda untuk akun ini dulu.");return;}
    setExpectedBalance(balance(a,data.transactions));setReconcileAccount(a);setActualBalance("");setReconcileNote("");
  }
  async function saveReconciliation(e:React.FormEvent) {
    e.preventDefault();if(!reconcileAccount)return;
    const actual=/^-?\d+$/.test(actualBalance.trim())?Number(actualBalance):NaN;
    const delta=reconciliationDelta(expectedBalance,actual);
    if(delta===null){toast.error("Masukkan saldo dalam rupiah bulat, dengan selisih maksimal Rp 1 triliun.");return;}
    if(delta===0){toast.info("Saldo tercatat sudah sama dengan saldo sebenarnya.");return;}
    if(!reconcileNote.trim()){toast.error("Isi alasan penyesuaian.");return;}
    setReconcileSaving(true);
    try{
      if((await readQueue<QueuedTransaction>()).some(t=>t.accountId===reconcileAccount.id||t.toAccountId===reconcileAccount.id))throw Error("Selesaikan transaksi tertunda untuk akun ini dulu.");
      await financeApi.reconcile({accountId:reconcileAccount.id,expectedBalance,actualBalance:actual,note:reconcileNote.trim(),date:day()});
      setReconcileAccount(null);await refresh();toast.success("Saldo berhasil dicocokkan. Penyesuaian tercatat di riwayat.");
    }catch(e){
      if(e instanceof FinanceApiError&&e.status===409){setReconcileAccount(null);await refresh();}
      toast.error(e instanceof Error?e.message:"Saldo belum bisa dicocokkan.");
    }finally{setReconcileSaving(false);}
  }
  function open(next:Mode,kindOfTx:EntryType="expense") {
    if(demo){dismissDemo();if(next!=="account"){next="account";setTab("accounts");toast.info("Tambahkan akunmu dulu untuk mulai mencatat.");}}
    if((next==="transaction"||next==="quick")&&!data.accounts.length){next="account";setTab("accounts");toast.info("Tambahkan akunmu dulu untuk mulai mencatat.");}
    setEditing(null);setMode(next);setType(kindOfTx);setName("");setKind("bank");setOpening("");setAmount("");setAccount(data.accounts[0]?.id||"");setDestination(data.accounts[1]?.id||"");setCategory(kindOfTx==="income"?"Gaji":defaultCategories[0]);setNote("");setDate(day());setQuickText("");
  }
  function edit(entity:"account"|"transaction"|"budget", item:Account|Transaction|Budget) {
    setEditing(item.id);setMode(entity);
    if(entity==="account"){const a=item as Account;setName(a.name);setKind(a.kind);setOpening(String(a.openingBalance));}
    if(entity==="budget"){const b=item as Budget;setCategory(b.category);setAmount(String(b.amount));}
    if(entity==="transaction"){const t=item as Transaction;if(t.type==="adjustment")return;setType(t.type);setAmount(String(t.amount));setAccount(t.accountId);setDestination(t.toAccountId||"");setCategory(t.category);setNote(t.note);setDate(t.date);}
  }
  function readQuick() {
    const result=parseQuickEntry(quickText);
    if(!result.entry){toast.error(result.error||"Transaksi belum terbaca.");return;}
    if(result.entry.type==="transfer"&&data.accounts.length<2){toast.error("Transfer memerlukan dua akun. Tambahkan akun tujuan dulu.");return;}
    setEditing(null);setType(result.entry.type);setAmount(String(result.entry.amount));setCategory(result.entry.category);setNote(result.entry.note);setDate(day());setAccount(data.accounts[0]?.id||"");setDestination(data.accounts[1]?.id||"");setMode("transaction");
    toast.info("Cek akun, kategori, dan nominal sebelum menyimpan.");
  }
  async function save(e:React.FormEvent) {
    e.preventDefault();if(!mode||mode==="quick")return;setSaving(true);
    const body=mode==="account"?{entity:mode,name,kind,openingBalance:Number(opening||0)}:mode==="budget"?{entity:mode,category,amount:Number(amount)}:{entity:mode,type,amount:Number(amount),accountId:account,toAccountId:destination,category,note,date};
    const id=editing||crypto.randomUUID();
    try{await financeApi.save(editing?"PATCH":"POST",{...body,id});setMode(null);setEditing(null);await refresh();toast.success(editing?"Perubahan disimpan.":"Berhasil disimpan.");}
    catch(e){
      if(mode==="transaction"&&!editing&&e instanceof TypeError){
        try{const transaction:QueuedTransaction={id,type,amount:Number(amount),accountId:account,toAccountId:type==="transfer"?destination:null,category:type==="transfer"?"Transfer":category,note,date,queuedAt:new Date().toISOString()};await enqueueTransaction(transaction);setQueued(await readQueue<QueuedTransaction>());setMode(null);toast.info("Tersimpan di perangkat. Akan dikirim saat online.");}
        catch{toast.error("Penyimpanan offline gagal. Formulir tetap terbuka.");}
      }else toast.error(e instanceof Error?e.message:"Gagal menyimpan.");
    }finally{setSaving(false);}
  }
  async function remove(){
    if(!target)return;
    if(target.entity==="account"){
      if(syncing.current){toast.info("Tunggu pengiriman transaksi selesai.");return;}
      syncing.current=true;
    }
    try{
      if(target.entity==="account"&&(await readQueue<QueuedTransaction>()).some(t=>t.accountId===target.id||t.toAccountId===target.id))throw Error("Akun dipakai transaksi tertunda. Kirim atau batalkan transaksi itu lebih dulu.");
      await financeApi.remove(target);await refresh();toast.success("Berhasil dihapus.");
    }catch(e){toast.error(e instanceof Error?e.message:"Gagal menghapus.");}
    finally{if(target.entity==="account")syncing.current=false;setTarget(null);}
  }
  function download(filename:string,contents:string,mime:string){const url=URL.createObjectURL(new Blob([contents],{type:mime}));const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function exportBackup(){try{if((await readQueue<QueuedTransaction>()).length)throw Error("Selesaikan transaksi tertunda agar cadangan lengkap.");const backup=await financeApi.backup();download("arus-cadangan-"+day()+".json",JSON.stringify(backup,null,2),"application/json");toast.success("Cadangan berhasil diunduh.");}catch(e){toast.error(e instanceof Error?e.message:"Cadangan belum bisa diunduh.");}}
  async function exportCsv(){
    try{if((await readQueue<QueuedTransaction>()).length)throw Error("Selesaikan transaksi tertunda agar CSV lengkap.");}
    catch(e){toast.error(e instanceof Error?e.message:"CSV belum bisa diunduh.");return;}
    const cell=(value:string|number)=>{const text=String(value);return '"'+(/^[\s\u0000-\u001f]*[=+@-]/.test(text)?"'":"")+text.replace(/"/g,'""')+'"';};
    const rows=[["Tanggal","Jenis","Jumlah","Akun","Akun tujuan","Kategori","Catatan"],...data.transactions.map(t=>[t.date,t.type,t.amount,data.accounts.find(a=>a.id===t.accountId)?.name||"",data.accounts.find(a=>a.id===t.toAccountId)?.name||"",t.category,t.note])];
    download("arus-transaksi-"+day()+".csv","\uFEFF"+rows.map(row=>row.map(cell).join(",")).join("\r\n"),"text/csv;charset=utf-8");toast.success("CSV berhasil diunduh.");
  }
  async function selectBackup(file?:File){
    if(!file)return;
    if(file.size>3_000_000){toast.error("File cadangan terlalu besar.");return;}
    try{const value=JSON.parse(await file.text()) as unknown;const validated=validateBackup(value);if(!validated.data)throw Error(validated.error);setPendingBackup(validated.data);}
    catch(e){toast.error(e instanceof Error?e.message:"File cadangan tidak valid.");}
    if(fileRef.current)fileRef.current.value="";
  }
  async function restoreBackup(){
    if(!pendingBackup)return;
    if(syncing.current){toast.info("Tunggu pengiriman transaksi selesai.");return;}
    syncing.current=true;setRestoring(true);
    try{
      if((await readQueue<QueuedTransaction>()).length)throw Error("Sinkronkan atau batalkan transaksi tertunda sebelum memulihkan cadangan.");
      await financeApi.restore(pendingBackup);setPendingBackup(null);await refresh();toast.success("Cadangan berhasil dipulihkan.");changeTab("home");
    }catch(e){toast.error(e instanceof Error?e.message:"Pemulihan gagal.");}
    finally{syncing.current=false;setRestoring(false);}
  }
  async function removeDeviceCache(){
    if(syncing.current){toast.info("Tunggu pengiriman transaksi selesai.");return;}
    syncing.current=true;
    try{if((await readQueue<QueuedTransaction>()).length)throw Error("Selesaikan transaksi tertunda sebelum menghapus data offline.");await clearDeviceCache();toast.success("Salinan perangkat dihapus.");}
    catch(e){toast.error(e instanceof Error?e.message:"Data offline belum bisa dihapus.");}
    finally{syncing.current=false;}
  }
  const screenTitle=(title:string,subtitle:string,action?:string,click?:()=>void)=><div className="screen-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action&&<button onClick={click}><Plus size={16}/>{action}</button>}</div>;
  const emptyState=(title:string,body:string,action:string,click:()=>void)=><div className="empty-state"><span><Wallet size={25}/></span><h2>{title}</h2><p>{body}</p><button onClick={click}><Plus size={16}/>{action}</button></div>;
  return <><Toaster position="top-center" richColors/><div className="app-shell">
    <aside className="desktop-nav"><div className="brand"><span className="brand-mark"><Wallet size={23} strokeWidth={2.5}/></span>arus<span className="brand-dot">.</span></div><div className="desktop-nav-label">MENU UTAMA</div>{navigation.map(n=><button key={n.id} className={"desktop-link "+(tab===n.id?"active":"")} onClick={()=>changeTab(n.id)}><n.icon size={20}/>{n.label}</button>)}<AuthUser variant="sidebar"/></aside>
    <main className="main"><div className="content"><header className="topbar"><AuthUser variant="greeting"/><div className="top-actions"><button aria-label={hidden?"Tampilkan saldo":"Sembunyikan saldo"} onClick={()=>setHidden(!hidden)}>{hidden?<EyeOff size={19}/>:<Eye size={19}/>}</button><button aria-label="Data dan cadangan" onClick={()=>changeTab("settings")}><Settings2 size={19}/></button><button aria-label="Lihat analitik" onClick={()=>changeTab("analytics")}><BarChart3 size={19}/></button></div></header>
    {loading?<div className="load-state">Memuat catatan keuangan…</div>:error?<div className="error-state">Data belum bisa dimuat. <button onClick={()=>void refresh()}>Coba lagi</button></div>:<>
    {pwa.updateAvailable&&<div className="update-strip" role="status"><span>Versi baru Arus siap digunakan.</span><button onClick={pwa.applyUpdate}>Perbarui</button></div>}
    {!pwa.installed&&!installTipDismissed&&<div className="install-strip"><span className="install-strip-icon"><Wallet size={19}/></span><span>Pasang Arus di layar utama</span><button className="install-strip-action" onClick={()=>pwa.canInstall?void pwa.install():setInstallGuideOpen(true)}>{pwa.canInstall?"Pasang":"Cara pasang"}</button><button className="install-strip-close" aria-label="Tutup saran instalasi" onClick={()=>{sessionStorage.setItem("arus_install_tip_dismissed","1");setInstallTipDismissed(true);}}><X size={17}/></button></div>}
    {(offline||queued.length>0)&&<div className="offline-strip"><WifiOff size={18}/><span>{offline?"Menampilkan salinan terakhir. Transaksi baru akan menunggu koneksi.":queueError?`${queued.length} transaksi tertunda: ${queueError}`:`${queued.length} transaksi menunggu sinkronisasi.`}</span>{queued.length>0&&<button onClick={()=>changeTab("settings")}>Tinjau</button>}{offline?<button onClick={()=>void refresh()}>Coba lagi</button>:queued.length>0&&<button disabled={syncingQueue} onClick={()=>void syncQueue()}>{syncingQueue?"Mengirim...":"Kirim"}</button>}</div>}
    {demo&&<div className="demo-strip"><div><b>Data contoh</b><span>Pratinjau tampilan. Catatanmu dimulai dari nol.</span></div><button onClick={()=>{dismissDemo();setTab("accounts");}}>Mulai sendiri <ChevronRight size={16}/></button></div>}
    {tab==="home"&&<><section className="balance-card"><div className="balance-top"><span>TOTAL SALDO</span><button aria-label="Sembunyikan atau tampilkan saldo" onClick={()=>setHidden(!hidden)}>{hidden?<EyeOff size={19}/>:<Eye size={19}/>}</button></div><div className="balance-value">{fmt(total)}</div><div className="balance-bottom"><div><span>Dari akun</span><strong>{shown.accounts.length} akun</strong></div><Wallet className="balance-art" size={128} strokeWidth={1.2}/></div></section><div className="quick-actions"><button onClick={()=>open("transaction","income")}><span className="action-icon income"><Plus size={22}/></span>Pemasukan</button><button onClick={()=>open("transaction","expense")}><span className="action-icon expense"><Minus size={22}/></span>Pengeluaran</button><button className="all-actions" aria-label="Lihat budget" onClick={()=>changeTab("budget")}><LayoutGrid size={23}/></button></div>
    <button className="quick-text-cta" onClick={()=>open("quick")}><MessageCircle size={18}/> Catat cepat lewat teks <ChevronRight size={17}/></button>
    <div className="home-grid"><section className="surface week-card"><div className="section-head"><div><h2>Pengeluaran 7 hari</h2><p>Paling tinggi: {high.value?dateText(high.date):"—"}</p></div><div className="align-right"><strong>{fmt(weekTotal)}</strong><button className="text-link" onClick={()=>changeTab("analytics")}>Detail <ChevronRight size={16}/></button></div></div><div className="week-chart" role="img" aria-label="Grafik pengeluaran tujuh hari terakhir">{week.map((d,i)=><div className="bar-col" key={d.date}><div className="bar-wrap"><div className={"bar "+(i===6?"current":"")} style={{height:Math.max(d.value?16:7,d.value/peak*76)+"px"}} title={dateText(d.date)+": "+money(d.value)}/></div><span>{d.label}</span></div>)}</div></section><section className="surface recent-card"><div className="section-head"><h2>Transaksi Terakhir</h2><button className="text-link" onClick={()=>changeTab("transactions")}>Lihat semua <ChevronRight size={16}/></button></div>{displayTx(shown.transactions.slice(0,4))}</section></div><section className="surface home-budget"><div className="section-head"><div><h2>Budget</h2><p>Pantau batas pengeluaranmu</p></div><button className="text-link" onClick={()=>changeTab("budget")}>Lihat <ChevronRight size={16}/></button></div>{periodControls}{shown.budgets.length?shown.budgets.slice(0,2).map(b=><div key={b.id}>{budgetRow(b)}</div>):<p className="empty-inline">Belum ada budget. Atur batas pengeluaranmu.</p>}</section></>}
    {tab==="accounts"&&<section className="screen">{screenTitle("Akun Finansial","Kelola sumber keuanganmu.","Tambah Akun",()=>open("account"))}<div className="account-summary surface"><span>TOTAL SALDO</span><strong>{fmt(total)}</strong><small>Dari {shown.accounts.length} akun</small></div>{shown.accounts.length?["bank","ewallet","cash"].map(k=>{const group=shown.accounts.filter(a=>a.kind===k);return group.length?<div className="account-group" key={k}><div className="group-title"><h2>{k==="bank"?"Akun Bank":k==="ewallet"?"E-Wallet":"Cash"}</h2><span>{fmt(group.reduce((s,a)=>s+balance(a,shown.transactions),0))}</span></div>{group.map(a=><div className="account-row surface" key={a.id}><span className="account-icon">{k==="bank"?<Landmark size={21}/>:k==="ewallet"?<CreditCard size={21}/>:<Wallet size={21}/>}</span><div className="account-name"><b>{a.name}</b><small>{k==="ewallet"?"E-WALLET":k.toUpperCase()}</small></div><strong>{fmt(balance(a,shown.transactions))}</strong>{!demo&&<div className="account-row-actions"><button className="account-reconcile" disabled={offline} onClick={()=>startReconcile(a)}><Scale size={15}/> Cocokkan saldo</button><button className="row-edit" aria-label={"Edit "+a.name} onClick={()=>edit("account",a)}><Pencil size={16}/></button><button className="row-delete" aria-label={"Hapus "+a.name} onClick={()=>setTarget({entity:"account",id:a.id,label:a.name})}><Trash2 size={16}/></button></div>}</div>)}</div>:null;}):emptyState("Belum ada akun","Tambahkan rekening, dompet digital, atau uang tunai.","Tambah akun",()=>open("account"))}</section>}
    {tab==="transactions"&&<section className="screen">{screenTitle("Transaksi","Riwayat dan jadwal keuanganmu.","Catat Baru",()=>open("transaction"))}{periodControls}
      <div className="mini-stats"><div><span>Pemasukan</span><strong className="green">{fmt(income)}</strong></div><div><span>Pengeluaran</span><strong>{fmt(out)}</strong></div></div>
      <div className="view-switch" role="group" aria-label="Tampilan transaksi"><button className={transactionView==="history"?"active":""} aria-pressed={transactionView==="history"} onClick={()=>setTransactionView("history")}>Riwayat</button><button className={transactionView==="schedule"?"active":""} aria-pressed={transactionView==="schedule"} onClick={()=>setTransactionView("schedule")}>Jadwal {shown.recurring.filter(r=>r.active&&r.nextDate<=day()).length>0&&<span className="view-count">{shown.recurring.filter(r=>r.active&&r.nextDate<=day()).length}</span>}</button></div>
      {transactionView==="history"?<><div className="filter-bar"><select aria-label="Filter jenis" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">Semua jenis</option><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option><option value="adjustment">Penyesuaian saldo</option></select><select aria-label="Filter akun" value={filterAccount} onChange={e=>setFilterAccount(e.target.value)}><option value="all">Semua akun</option>{shown.accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select><select aria-label="Filter kategori" value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="all">Semua kategori</option>{categories.map(c=><option value={c} key={c}>{c}</option>)}</select></div><label className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari transaksi..." aria-label="Cari transaksi"/></label><div className="surface transaction-surface">{displayTx(filteredTransactions,true)}</div></>:<RecurringSection rules={shown.recurring} accounts={data.accounts} categories={categories} month={month} offline={offline||demo} onChange={refresh} money={fmt}/>}
    </section>}
    {tab==="budget"&&<section className="screen">{screenTitle("Budget","Kelola dan pantau batas pengeluaranmu.","Tambah Budget",()=>open("budget"))}{periodControls}<div className="budget-overview surface"><div className="donut" style={{"--percent":Math.min(100,budgetPercent)+"%"} as React.CSSProperties}><span>{budgetPercent}%</span></div><div><span className="eyebrow">BUDGET TERPAKAI BULAN INI</span><strong>{fmt(budgetedSpend)}</strong><small>dari {fmt(budgetTotal)} · hanya kategori berbudget</small></div></div><h2 className="section-label">Kategori ({shown.budgets.length})</h2>{shown.budgets.length?shown.budgets.map(b=><div className="surface budget-item" key={b.id}>{budgetRow(b)}{!demo&&<div className="budget-actions"><button onClick={()=>edit("budget",b)}><Pencil size={15}/> Edit</button><button className="subtle-delete" onClick={()=>setTarget({entity:"budget",id:b.id,label:b.category})}><Trash2 size={15}/> Hapus</button></div>}</div>):emptyState("Belum ada budget","Tetapkan batas pengeluaran bulanan untuk kategori pilihanmu.","Tambah budget",()=>open("budget"))}</section>}
    {tab==="analytics"&&<section className="screen">{screenTitle("Analitik","Lihat arah uangmu per bulan.")}{periodControls}<div className="analytics-grid"><div className="surface analytics-stat"><span>PEMASUKAN</span><strong className="green">{fmt(income)}</strong><ArrowDownLeft size={20}/></div><div className="surface analytics-stat"><span>PENGELUARAN</span><strong>{fmt(out)}</strong><ArrowUpRight size={20}/></div></div><div className="surface analytics-net"><span>Arus kas bersih</span><strong className={income-out>=0?"green":"red"}>{fmt(income-out)}</strong><p>Selisih pemasukan dan pengeluaran bulan ini.</p></div><div className="surface analytics-categories"><div className="section-head"><h2>Pengeluaran per kategori</h2></div>{byCategory.length?byCategory.map(x=><div className="category-line" key={x.category}><span className="category-icon">{emoji(x.category)}</span><div><b>{x.category}</b><span className="track"><i style={{width:Math.max(5,x.amount/out*100)+"%"}}/></span></div><strong>{fmt(x.amount)}</strong></div>):<p className="empty-inline">Belum ada pengeluaran bulan ini.</p>}</div></section>}
    {tab==="settings"&&<section className="screen">{screenTitle("Data & Cadangan","Atur kategori dan simpan salinan catatanmu.")}<AuthUser variant="settings"/><div className="surface data-panel pwa-panel"><div className="data-panel-head"><span className="pwa-panel-icon"><Wallet size={23}/></span><div><h2>Pasang Arus</h2><p>Buka langsung dari layar utama seperti aplikasi di HP.</p></div></div>{pwa.installed?<p className="pwa-status"><Check size={16}/> Sudah terpasang di perangkat ini.</p>:<div className="pwa-actions">{pwa.canInstall&&<button className="restore-select" onClick={()=>void pwa.install()}><Download size={17}/> Pasang di perangkat</button>}<button className="restore-select" onClick={()=>setInstallGuideOpen(true)}>Cara pasang di HP</button></div>}{pwa.ready&&<p className="pwa-footnote">Catatan terakhir tersedia saat offline. Transaksi baru akan dikirim setelah tersambung.</p>}</div><CategoryManager custom={data.categories} offline={offline} pendingCount={queued.length} onChange={refresh}/><div className="surface data-panel"><div className="data-panel-head"><Download size={22}/><div><h2>Unduh data</h2><p>Cadangan JSON bisa dipulihkan; CSV untuk membuka transaksi di spreadsheet.</p></div></div><div className="data-actions"><button disabled={queued.length>0} onClick={()=>void exportBackup()}><Download size={17}/> Unduh cadangan</button><button disabled={queued.length>0} onClick={()=>void exportCsv()}><Download size={17}/> Ekspor CSV</button></div>{queued.length>0&&<p className="inline-note">Selesaikan transaksi tertunda agar unduhan memuat semua catatan.</p>}</div><div className="surface data-panel"><div className="data-panel-head"><Upload size={22}/><div><h2>Pulihkan cadangan</h2><p>Isi saat ini akan diganti seluruhnya. Unduh cadangan terbaru sebelum memulihkan.</p></div></div><input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={e=>void selectBackup(e.target.files?.[0])}/><button className="restore-select" onClick={()=>fileRef.current?.click()}><Upload size={17}/> Pilih file JSON</button></div><div className="surface data-panel"><div className="data-panel-head"><WifiOff size={22}/><div><h2>Data offline</h2><p>Arus menyimpan salinan terakhir di perangkat ini. Transaksi baru saat offline akan dikirim saat koneksi kembali.</p></div></div><p className="offline-count">{queued.length} transaksi menunggu sinkronisasi</p>{queued.length>0&&<div className="pending-list"><div className="pending-list-head"><h3>Transaksi tertunda</h3><button disabled={offline||syncingQueue} onClick={()=>void syncQueue()}>{syncingQueue?"Mengirim...":"Kirim sekarang"}</button></div>{queueError&&<p className="inline-note">{queueError}</p>}{displayTx(queued.slice().sort((a,b)=>a.queuedAt.localeCompare(b.queuedAt)),true)}</div>}<button className="restore-select" disabled={queued.length>0||syncingQueue} onClick={()=>void removeDeviceCache()}>Hapus salinan perangkat</button>{queued.length>0&&<p className="inline-note">Kirim atau batalkan transaksi tertunda sebelum menghapus salinan.</p>}</div><p className="data-footnote">Data contoh tidak ikut diekspor. Catatan asli tersimpan di aplikasi privat ini.</p></section>}
    </>}</div></main>
    <nav className="bottom-nav" aria-label="Navigasi utama"><button className={tab==="home"?"selected":""} aria-label="Beranda" onClick={()=>changeTab("home")}><Home size={23}/></button><button className={tab==="accounts"?"selected":""} aria-label="Akun" onClick={()=>changeTab("accounts")}><Wallet size={23}/></button><button className="nav-add" aria-label="Catat cepat lewat teks" onClick={()=>open("quick")}><Plus size={26}/></button><button className={tab==="transactions"?"selected":""} aria-label="Transaksi" onClick={()=>changeTab("transactions")}><ArrowLeftRight size={23}/></button><button className={tab==="analytics"||tab==="budget"?"selected":""} aria-label="Analitik" onClick={()=>changeTab("analytics")}><BarChart3 size={23}/></button></nav>
    <Drawer open={installGuideOpen} onOpenChange={setInstallGuideOpen} direction="bottom"><DrawerContent className="form-sheet install-guide-sheet"><DrawerHeader><div className="drawer-heading"><DrawerTitle>Pasang Arus di HP</DrawerTitle><button aria-label="Tutup panduan" onClick={()=>setInstallGuideOpen(false)}><X size={19}/></button></div><DrawerDescription>Buka dari layar utama seperti aplikasi biasa.</DrawerDescription></DrawerHeader><div className="form-sheet-scroll install-guide-body" data-vaul-no-drag><p className="install-guide-callout">Jika Arus dibuka di dalam ChatGPT, salin tautannya lalu buka di Chrome (Android) atau Safari (iPhone).</p><div className="install-guide-link"><span>{typeof window!=="undefined"?window.location.origin+"/":"Tautan Arus"}</span><button onClick={()=>void copyAppLink()}>Salin tautan</button></div><h3>{pwa.ios?"Di iPhone · Safari":"Di Android · Chrome"}</h3><ol>{pwa.ios?<><li>Buka tautan Arus di Safari, lalu masuk dengan akun yang sama jika diminta.</li><li>Ketuk tombol Bagikan, kemudian pilih <b>Tambahkan ke Layar Utama</b>.</li><li>Ketuk <b>Tambah</b>. Ikon Arus akan muncul di layar utama.</li></>:<><li>Buka tautan Arus di Chrome, lalu masuk dengan akun yang sama jika diminta.</li><li>Ketuk menu <b>⋮</b> di Chrome, lalu pilih <b>Tambahkan ke layar utama</b> atau <b>Instal aplikasi</b>.</li><li>Konfirmasi <b>Instal</b>. Ikon Arus akan muncul di layar utama.</li></>}</ol>{pwa.canInstall&&<button className="save-button" onClick={()=>{setInstallGuideOpen(false);void pwa.install();}}>Pasang sekarang <Download size={17}/></button>}</div></DrawerContent></Drawer>
    <Drawer open={mode!==null} onOpenChange={v=>!v&&setMode(null)} direction="bottom"><DrawerContent className="form-sheet"><DrawerHeader><div className="drawer-heading"><DrawerTitle>{mode==="quick"?"Catat Cepat":editing?"Edit "+(mode==="account"?"Akun":mode==="budget"?"Budget":"Transaksi"):mode==="account"?"Tambah Akun":mode==="budget"?"Tambah Budget":"Catat Transaksi"}</DrawerTitle><button aria-label="Tutup formulir" onClick={()=>setMode(null)}><X size={19}/></button></div><DrawerDescription>{mode==="quick"?"Tulis satu transaksi, lalu tinjau hasilnya sebelum menyimpan.":mode==="account"?"Saldo awal hanya dapat diubah sebelum ada transaksi. Gunakan Cocokkan saldo untuk memperbaiki saldo terkini.":mode==="budget"?"Batas berlaku setiap bulan.":"Periksa nominal dan akun sebelum menyimpan."}</DrawerDescription></DrawerHeader>
    <div className="form-sheet-scroll" key={mode} data-vaul-no-drag>{mode==="quick"?<div className="quick-entry-form"><label htmlFor="quick-text">Apa transaksinya?</label><textarea id="quick-text" autoFocus maxLength={150} value={quickText} onChange={e=>setQuickText(e.target.value)} placeholder="Contoh: beli kopi 25rb"/><p>Contoh lain: “gaji 4,5 juta” atau “transfer 200rb”. Kamu tetap memilih akun dan mengonfirmasi nominal.</p><button className="save-button" type="button" onClick={readQuick}>Tinjau transaksi <ChevronRight size={18}/></button><button className="manual-link" type="button" onClick={()=>setMode("transaction")}>Isi formulir manual</button></div>:<form onSubmit={save} className="form-body">
      {mode==="account"&&<><label>Nama akun<input required maxLength={50} placeholder="Contoh: BCA, GoPay, Cash" value={name} onChange={e=>setName(e.target.value)}/></label><label>Jenis akun<Select value={kind} onValueChange={setKind}><SelectTrigger className="select-control"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="bank">Bank</SelectItem><SelectItem value="ewallet">E-Wallet</SelectItem><SelectItem value="cash">Cash</SelectItem></SelectContent></Select></label><label>Saldo awal (Rp)<input type="number" step="1" inputMode="numeric" placeholder="0" value={opening} disabled={!!editing&&data.transactions.some(t=>t.accountId===editing||t.toAccountId===editing)} onChange={e=>setOpening(e.target.value)}/></label></>}
      {mode==="transaction"&&<><div className="type-pills">{(["expense","income","transfer"] as const).map(t=><button type="button" className={type===t?"chosen":""} key={t} onClick={()=>{setType(t);if(t!=="transfer"&&category==="Transfer")setCategory(t==="income"?"Gaji":categories[0]);}}>{t==="expense"?"Pengeluaran":t==="income"?"Pemasukan":"Transfer"}</button>)}</div><label>Jumlah (Rp)<input required autoFocus type="number" min="1" step="1" inputMode="numeric" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{type==="transfer"?"Dari akun":"Akun"}<Select value={account} onValueChange={setAccount}><SelectTrigger className="select-control"><SelectValue placeholder="Pilih akun"/></SelectTrigger><SelectContent>{data.accounts.map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></label>{type==="transfer"?<label>Ke akun<Select value={destination} onValueChange={setDestination}><SelectTrigger className="select-control"><SelectValue placeholder="Pilih akun tujuan"/></SelectTrigger><SelectContent>{data.accounts.filter(a=>a.id!==account).map(a=><SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select></label>:<label>Kategori<Select value={category} onValueChange={setCategory}><SelectTrigger className="select-control"><SelectValue/></SelectTrigger><SelectContent>{categories.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></label>}<label>Catatan<input maxLength={150} placeholder="Contoh: Kopi pagi" value={note} onChange={e=>setNote(e.target.value)}/></label><label>Tanggal<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>{activeBudget&&<div className={"budget-insight "+(afterBudget>=activeBudget.amount?"over":afterBudget>=activeBudget.amount*.8?"near":"")}><strong>Budget {category} · {date.slice(0,7)}</strong><span>Terpakai {fmt(beforeBudget)} dari {fmt(activeBudget.amount)}</span><b>{amount&&Number(amount)>0?afterBudget>activeBudget.amount?`Melewati batas ${fmt(afterBudget-activeBudget.amount)}`:`Sisa setelah transaksi ${fmt(activeBudget.amount-afterBudget)}`:`Sisa ${fmt(Math.max(0,activeBudget.amount-beforeBudget))}`}</b></div>}</>}
      {mode==="budget"&&<><label>Kategori<Select value={category} onValueChange={setCategory}><SelectTrigger className="select-control"><SelectValue/></SelectTrigger><SelectContent>{categories.filter(c=>c!=="Gaji").map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></label><label>Budget bulanan (Rp)<input required autoFocus type="number" min="1" step="1" inputMode="numeric" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label></>}
      <button className="save-button" type="submit" disabled={saving}>{saving?"Menyimpan...":editing?"Simpan Perubahan":"Simpan"} <Check size={18}/></button>
    </form>}</div></DrawerContent></Drawer>
    <Drawer open={!!reconcileAccount} onOpenChange={value=>!value&&!reconcileSaving&&setReconcileAccount(null)} direction="bottom"><DrawerContent className="form-sheet"><DrawerHeader><div className="drawer-heading"><DrawerTitle>Cocokkan saldo</DrawerTitle><button aria-label="Tutup pencocokan saldo" disabled={reconcileSaving} onClick={()=>setReconcileAccount(null)}><X size={19}/></button></div><DrawerDescription>Bandingkan saldo {reconcileAccount?.name} dengan saldo sebenarnya. Selisih dicatat sebagai penyesuaian di riwayat.</DrawerDescription></DrawerHeader><div className="form-sheet-scroll" data-vaul-no-drag><form className="form-body" onSubmit={e=>void saveReconciliation(e)}><div className="reconcile-summary"><span>Saldo tercatat</span><strong>{money(expectedBalance)}</strong></div><label>Saldo sebenarnya (Rp)<input required autoFocus type="number" step="1" inputMode="numeric" value={actualBalance} onChange={e=>setActualBalance(e.target.value)} placeholder="Contoh: 1250000"/></label>{actualBalance.trim()!==""&&reconciliationDelta(expectedBalance,Number(actualBalance))!==null&&<div className="reconcile-summary"><span>Selisih yang akan dicatat</span><strong className={Number(actualBalance)-expectedBalance>=0?"green":"red"}>{Number(actualBalance)-expectedBalance>=0?"+ ":"− "}{money(Math.abs(Number(actualBalance)-expectedBalance))}</strong></div>}<label>Alasan penyesuaian<input required maxLength={150} value={reconcileNote} onChange={e=>setReconcileNote(e.target.value)} placeholder="Contoh: Saldo bank berbeda setelah cek mutasi"/></label><p className="reconcile-hint">Penyesuaian tidak dihitung sebagai pemasukan, pengeluaran, atau penggunaan budget. Jika perlu koreksi lagi, buat penyesuaian baru.</p><button className="save-button" type="submit" disabled={reconcileSaving||!actualBalance.trim()||!reconcileNote.trim()}>{reconcileSaving?"Mencocokkan...":"Simpan penyesuaian"} <Check size={18}/></button></form></div></DrawerContent></Drawer>
    <AlertDialog open={!!target} onOpenChange={v=>!v&&setTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus {target?.label}?</AlertDialogTitle><AlertDialogDescription>Data ini akan dihapus permanen. Ringkasan dan saldo akan dihitung ulang.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={()=>void remove()}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!pendingBackup} onOpenChange={v=>!v&&!restoring&&setPendingBackup(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ganti semua data saat ini?</AlertDialogTitle><AlertDialogDescription>Cadangan ini berisi {pendingBackup?.accounts.length||0} akun, {pendingBackup?.transactions.length||0} transaksi, dan {pendingBackup?.budgets.length||0} budget. Semua catatan saat ini akan diganti. Unduh cadangan saat ini dahulu bila masih dibutuhkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={restoring}>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={restoring} onClick={()=>void restoreBackup()}>{restoring?"Memulihkan...":"Ganti dan pulihkan"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></>;
}
