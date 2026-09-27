"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight, BarChart3, Check, ChevronLeft, ChevronRight, CreditCard, Download, Eye, EyeOff, Home, Landmark, LayoutGrid, MessageCircle, Minus, Pencil, Plus, Search, Settings2, Scale, Trash2, Upload, Wallet, WifiOff, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast, Toaster } from "sonner";
import { validateBackup, type Backup } from "@/lib/backup";
import { parseQuickEntry } from "@/lib/quick-entry";
import { accountBalance as balance, budgetSummary, reconciliationDelta } from "@/lib/finance";
import { allCategories, defaultCategories } from "@/lib/categories";
import { AuthUser } from "@/components/auth-user";
import { usePwa } from "@/lib/use-pwa";
import { FinanceApiError, financeApi } from "@/data/client/finance-api";
import type { Account, Transaction, Budget, QueuedTransaction, TransactionType } from "@/domain/finance/types";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { day, money } from "@/features/finance/lib/presentation";
import { AccountsTab } from "@/features/finance/components/tabs/accounts-tab";
import { AnalyticsTab } from "@/features/finance/components/tabs/analytics-tab";
import { BudgetTab } from "@/features/finance/components/tabs/budget-tab";
import { HomeTab } from "@/features/finance/components/tabs/home-tab";
import { SettingsTab } from "@/features/finance/components/tabs/settings-tab";
import { TransactionsTab } from "@/features/finance/components/tabs/transactions-tab";

type Tab = "home" | "accounts" | "transactions" | "budget" | "analytics" | "settings";
type Mode = "account" | "transaction" | "budget" | "quick" | null;
type EntryType = Exclude<TransactionType, "adjustment">;
const navigation: { id: Tab; label: string; icon: typeof Home }[] = [
  { id:"home",label:"Beranda",icon:Home },{ id:"accounts",label:"Akun",icon:Wallet },{ id:"transactions",label:"Transaksi",icon:ArrowLeftRight },{ id:"budget",label:"Budget",icon:LayoutGrid },{ id:"analytics",label:"Analitik",icon:BarChart3 },{ id:"settings",label:"Data & Cadangan",icon:Settings2 },
];
export function FinanceApp() {
  const {
    data, loading, error, queued, shown, offline, queueError, syncingQueue,
    refresh, syncQueue, queueTransaction, discardQueued, hasPending,
    hasPendingForAccount, runExclusive, clearOfflineCache,
  } = useFinanceData();
  const [tab,setTab]=useState<Tab>("home"), [mode,setMode]=useState<Mode>(null), [type,setType]=useState<EntryType>("expense");
  const [hidden,setHidden]=useState(false), [query,setQuery]=useState(""), [saving,setSaving]=useState(false);
  const [weekEnd]=useState(()=>day());
  const [month,setMonth]=useState(day().slice(0,7)), [filterType,setFilterType]=useState("all"), [filterAccount,setFilterAccount]=useState("all"), [filterCategory,setFilterCategory]=useState("all"), [transactionView,setTransactionView]=useState<"history"|"schedule">("history");
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
  const categories=allCategories(data.categories), fmt=(n:number)=>hidden?"Rp •••••••":money(n);
  const total=shown.accounts.reduce((s,a)=>s+balance(a,shown.transactions),0);
  useEffect(()=>{
    type Context = { registerTool: (tool: Record<string, unknown>, options: {signal:AbortSignal})=>void|Promise<void> };
    const context=(document as Document & {modelContext?:Context}).modelContext;
    if(!context?.registerTool || loading || error)return;
    const controller=new AbortController();
    const register=(tool:Record<string,unknown>)=>{try{void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(console.error);}catch(e){console.error(e);}};
    register({name:"read_finance_summary",title:"Baca ringkasan keuangan",description:"Baca saldo dan jumlah akun dari tampilan saat ini.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({totalBalance:total,accountCount:shown.accounts.length})});
    register({name:"start_transaction_creation",title:"Buka pencatatan transaksi",description:"Buka formulir pencatatan transaksi di aplikasi.",inputSchema:{type:"object",properties:{type:{type:"string",enum:["income","expense","transfer"]}},required:["type"],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{const value=(input as {type?:string})?.type;if(!["income","expense","transfer"].includes(value||""))throw Error("Jenis transaksi tidak valid.");if(!data.accounts.length){setTab("accounts");setMode("account");return {opened:"account",reason:"Tambahkan akun lebih dulu"};}setType(value as EntryType);setAccount(data.accounts[0].id);setMode("transaction");return {opened:"transaction",type:value};}});
    return()=>controller.abort();
  },[loading,error,total,shown.accounts.length,data.accounts]);
  const expenses=shown.transactions.filter(t=>t.type==="expense"&&t.date.startsWith(month));
  const out=expenses.reduce((s,t)=>s+t.amount,0), income=shown.transactions.filter(t=>t.type==="income"&&t.date.startsWith(month)).reduce((s,t)=>s+t.amount,0);
  const {total:budgetTotal,spent:budgetedSpend,percent:budgetPercent}=budgetSummary(shown.budgets,shown.transactions,month);
  const week=Array.from({length:7},(_,i)=>{const date=new Date(weekEnd+"T12:00:00");date.setDate(date.getDate()-(6-i));const target=day(date);return {date:target,label:date.toLocaleDateString("id-ID",{weekday:"short"}).slice(0,3),value:shown.transactions.filter(t=>t.type==="expense"&&t.date===target).reduce((s,t)=>s+t.amount,0)};});
  const weekTotal=week.reduce((s,d)=>s+d.value,0), high=week.reduce((a,b)=>b.value>a.value?b:a,week[0]), peak=Math.max(...week.map(d=>d.value),1);
  const byCategory=categories.map(c=>({category:c,amount:expenses.filter(t=>t.category===c).reduce((s,t)=>s+t.amount,0)})).filter(x=>x.amount).sort((a,b)=>b.amount-a.amount);
  const filteredTransactions=shown.transactions.filter(t=>t.date.startsWith(month)&&(filterType==="all"||t.type===filterType)&&(filterAccount==="all"||t.accountId===filterAccount||t.toAccountId===filterAccount)&&(filterCategory==="all"||t.category===filterCategory)&&(t.note+" "+t.category).toLowerCase().includes(query.toLowerCase()));
  const activeBudget=type==="expense"?shown.budgets.find(b=>b.category===category):undefined;
  const beforeBudget=activeBudget?shown.transactions.filter(t=>t.type==="expense"&&t.category===category&&t.date.startsWith(date.slice(0,7))&&t.id!==editing).reduce((sum,t)=>sum+t.amount,0):0;
  const afterBudget=beforeBudget+Number(amount||0);
  const changeMonth=(delta:number)=>{const [year,number]=month.split("-").map(Number);const next=new Date(year,number-1+delta,1);setMonth([next.getFullYear(),String(next.getMonth()+1).padStart(2,"0")].join("-"));};
  async function dropQueued(id:string){
    try{
      const result=await discardQueued(id);
      if(result==="already-synced") toast.info("Transaksi sudah tercatat. Hapus dari riwayat jika ingin membatalkannya.");
      else toast.success(navigator.onLine?"Transaksi dibatalkan dari antrean.":"Dihapus dari antrean perangkat. Periksa riwayat saat online.");
    }catch(e){
      if(e instanceof Error&&e.message==="SYNC_BUSY") toast.info("Tunggu pengiriman transaksi selesai.");
      else toast.error(e instanceof Error?e.message:"Antrean belum bisa diubah.");
    }
  }
  const changeTab=(next:Tab)=>{setTab(next);setQuery("");window.scrollTo({top:0,behavior:"smooth"});};
  async function copyAppLink(){
    try{await navigator.clipboard.writeText(window.location.origin+"/");toast.success("Tautan Arus disalin. Tempel di Chrome atau Safari.");}
    catch{toast.error("Salin tautan yang tertera, lalu buka di browser.");}
  }
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
      if(await hasPendingForAccount(reconcileAccount.id))throw Error("Selesaikan transaksi tertunda untuk akun ini dulu.");
      await financeApi.reconcile({accountId:reconcileAccount.id,expectedBalance,actualBalance:actual,note:reconcileNote.trim(),date:day()});
      setReconcileAccount(null);await refresh();toast.success("Saldo berhasil dicocokkan. Penyesuaian tercatat di riwayat.");
    }catch(e){
      if(e instanceof FinanceApiError&&e.status===409){setReconcileAccount(null);await refresh();}
      toast.error(e instanceof Error?e.message:"Saldo belum bisa dicocokkan.");
    }finally{setReconcileSaving(false);}
  }
  function open(next:Mode,kindOfTx:EntryType="expense") {
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
        try{const transaction:QueuedTransaction={id,type,amount:Number(amount),accountId:account,toAccountId:type==="transfer"?destination:null,category:type==="transfer"?"Transfer":category,note,date,queuedAt:new Date().toISOString()};await queueTransaction(transaction);setMode(null);toast.info("Tersimpan di perangkat. Akan dikirim saat online.");}
        catch{toast.error("Penyimpanan offline gagal. Formulir tetap terbuka.");}
      }else toast.error(e instanceof Error?e.message:"Gagal menyimpan.");
    }finally{setSaving(false);}
  }
  async function remove(){
    if(!target)return;
    const action=async()=>{
      if(target.entity==="account"&&await hasPendingForAccount(target.id)){
        throw Error("Akun dipakai transaksi tertunda. Kirim atau batalkan transaksi itu lebih dulu.");
      }
      await financeApi.remove(target);
      await refresh();
      toast.success("Berhasil dihapus.");
    };
    try{
      if(target.entity==="account") await runExclusive(action);
      else await action();
    }catch(e){
      if(e instanceof Error&&e.message==="SYNC_BUSY") toast.info("Tunggu pengiriman transaksi selesai.");
      else toast.error(e instanceof Error?e.message:"Gagal menghapus.");
    }finally{setTarget(null);}
  }
  function download(filename:string,contents:string,mime:string){const url=URL.createObjectURL(new Blob([contents],{type:mime}));const link=document.createElement("a");link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function exportBackup(){try{if(await hasPending())throw Error("Selesaikan transaksi tertunda agar cadangan lengkap.");const backup=await financeApi.backup();download("arus-cadangan-"+day()+".json",JSON.stringify(backup,null,2),"application/json");toast.success("Cadangan berhasil diunduh.");}catch(e){toast.error(e instanceof Error?e.message:"Cadangan belum bisa diunduh.");}}
  async function exportCsv(){
    try{if(await hasPending())throw Error("Selesaikan transaksi tertunda agar CSV lengkap.");}
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
    setRestoring(true);
    try{
      await runExclusive(async()=>{
        if(await hasPending())throw Error("Sinkronkan atau batalkan transaksi tertunda sebelum memulihkan cadangan.");
        await financeApi.restore(pendingBackup);
        setPendingBackup(null);
        await refresh();
      });
      toast.success("Cadangan berhasil dipulihkan.");
      changeTab("home");
    }catch(e){
      if(e instanceof Error&&e.message==="SYNC_BUSY") toast.info("Tunggu pengiriman transaksi selesai.");
      else toast.error(e instanceof Error?e.message:"Pemulihan gagal.");
    }finally{setRestoring(false);}
  }
  async function removeDeviceCache(){
    try{
      await clearOfflineCache();
      toast.success("Salinan perangkat dihapus.");
    }catch(e){
      if(e instanceof Error&&e.message==="SYNC_BUSY") toast.info("Tunggu pengiriman transaksi selesai.");
      else toast.error(e instanceof Error?e.message:"Data offline belum bisa dihapus.");
    }
  }
  return <><Toaster position="top-center" richColors/><div className="app-shell">
    <aside className="desktop-nav"><div className="brand"><span className="brand-mark"><Wallet size={23} strokeWidth={2.5}/></span>arus<span className="brand-dot">.</span></div><div className="desktop-nav-label">MENU UTAMA</div>{navigation.map(n=><button key={n.id} className={"desktop-link "+(tab===n.id?"active":"")} onClick={()=>changeTab(n.id)}><n.icon size={20}/>{n.label}</button>)}<AuthUser variant="sidebar"/></aside>
    <main className="main"><div className="content"><header className="topbar"><AuthUser variant="greeting"/><div className="top-actions"><button aria-label={hidden?"Tampilkan saldo":"Sembunyikan saldo"} onClick={()=>setHidden(!hidden)}>{hidden?<EyeOff size={19}/>:<Eye size={19}/>}</button><button aria-label="Data dan cadangan" onClick={()=>changeTab("settings")}><Settings2 size={19}/></button><button aria-label="Lihat analitik" onClick={()=>changeTab("analytics")}><BarChart3 size={19}/></button></div></header>
    {loading?<div className="load-state">Memuat catatan keuangan…</div>:error?<div className="error-state">Data belum bisa dimuat. <button onClick={()=>void refresh()}>Coba lagi</button></div>:<>
    {pwa.updateAvailable&&<div className="update-strip" role="status"><span>Versi baru Arus siap digunakan.</span><button onClick={pwa.applyUpdate}>Perbarui</button></div>}
    {!pwa.installed&&!installTipDismissed&&<div className="install-strip"><span className="install-strip-icon"><Wallet size={19}/></span><span>Pasang Arus di layar utama</span><button className="install-strip-action" onClick={()=>pwa.canInstall?void pwa.install():setInstallGuideOpen(true)}>{pwa.canInstall?"Pasang":"Cara pasang"}</button><button className="install-strip-close" aria-label="Tutup saran instalasi" onClick={()=>{sessionStorage.setItem("arus_install_tip_dismissed","1");setInstallTipDismissed(true);}}><X size={17}/></button></div>}
    {(offline||queued.length>0)&&<div className="offline-strip"><WifiOff size={18}/><span>{offline?"Menampilkan salinan terakhir. Transaksi baru akan menunggu koneksi.":queueError?`${queued.length} transaksi tertunda: ${queueError}`:`${queued.length} transaksi menunggu sinkronisasi.`}</span>{queued.length>0&&<button onClick={()=>changeTab("settings")}>Tinjau</button>}{offline?<button onClick={()=>void refresh()}>Coba lagi</button>:queued.length>0&&<button disabled={syncingQueue} onClick={()=>void syncQueue()}>{syncingQueue?"Mengirim...":"Kirim"}</button>}</div>}
    {tab==="home"&&<HomeTab
      hidden={hidden}
      onToggleHidden={()=>setHidden(!hidden)}
      total={total}
      accountCount={shown.accounts.length}
      formatMoney={fmt}
      onIncome={()=>open("transaction","income")}
      onExpense={()=>open("transaction","expense")}
      onBudget={()=>changeTab("budget")}
      onQuick={()=>open("quick")}
      onAnalytics={()=>changeTab("analytics")}
      onTransactions={()=>changeTab("transactions")}
      week={week}
      high={high}
      weekTotal={weekTotal}
      peak={peak}
      accounts={shown.accounts}
      transactions={shown.transactions}
      queued={queued}
      budgets={shown.budgets}
      expenses={expenses}
      month={month}
      onMonthChange={changeMonth}
    />}
    {tab==="accounts"&&<AccountsTab
      accounts={shown.accounts}
      transactions={shown.transactions}
      offline={offline}
      total={total}
      formatMoney={fmt}
      onAdd={()=>open("account")}
      onReconcile={startReconcile}
      onEdit={account=>edit("account",account)}
      onDelete={account=>setTarget({entity:"account",id:account.id,label:account.name})}
    />}
    {tab==="transactions"&&<TransactionsTab
      month={month}
      onMonthChange={changeMonth}
      income={income}
      out={out}
      formatMoney={fmt}
      transactionView={transactionView}
      onTransactionViewChange={setTransactionView}
      filterType={filterType}
      onFilterTypeChange={setFilterType}
      filterAccount={filterAccount}
      onFilterAccountChange={setFilterAccount}
      filterCategory={filterCategory}
      onFilterCategoryChange={setFilterCategory}
      query={query}
      onQueryChange={setQuery}
      filteredTransactions={filteredTransactions}
      recurring={shown.recurring}
      accounts={data.accounts}
      categories={categories}
      offline={offline}
      queued={queued}
      syncingQueue={syncingQueue}
      onRefresh={refresh}
      onAdd={()=>open("transaction")}
      onDiscardQueued={id=>void dropQueued(id)}
      onEdit={transaction=>edit("transaction",transaction)}
      onDelete={transaction=>setTarget({entity:"transaction",id:transaction.id,label:transaction.note||transaction.category})}
    />}
    {tab==="budget"&&<BudgetTab
      month={month}
      onMonthChange={changeMonth}
      budgetPercent={budgetPercent}
      budgetedSpend={budgetedSpend}
      budgetTotal={budgetTotal}
      budgets={shown.budgets}
      expenses={expenses}
      formatMoney={fmt}
      onAdd={()=>open("budget")}
      onEdit={budget=>edit("budget",budget)}
      onDelete={budget=>setTarget({entity:"budget",id:budget.id,label:budget.category})}
    />}
    {tab==="analytics"&&<AnalyticsTab
      month={month}
      onMonthChange={changeMonth}
      income={income}
      out={out}
      byCategory={byCategory}
      formatMoney={fmt}
    />}
    {tab==="settings"&&<SettingsTab
      pwa={pwa}
      categories={data.categories}
      accounts={shown.accounts}
      queued={queued}
      offline={offline}
      queueError={queueError}
      syncingQueue={syncingQueue}
      formatMoney={fmt}
      fileRef={fileRef}
      onRefresh={refresh}
      onOpenInstallGuide={()=>setInstallGuideOpen(true)}
      onExportBackup={()=>void exportBackup()}
      onExportCsv={()=>void exportCsv()}
      onSelectBackup={file=>void selectBackup(file)}
      onSyncQueue={()=>void syncQueue()}
      onDiscardQueued={id=>void dropQueued(id)}
      onRemoveDeviceCache={()=>void removeDeviceCache()}
    />}
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