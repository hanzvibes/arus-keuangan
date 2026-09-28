"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, BarChart3, Eye, EyeOff, Home, LayoutGrid, Plus, Settings2, Wallet, WifiOff, X } from "lucide-react";
import { toast, Toaster } from "sonner";
import { validateBackup, type Backup } from "@/lib/backup";
import { parseQuickEntry } from "@/lib/quick-entry";
import { accountBalance as balance, budgetSummary, reconciliationDelta } from "@/lib/finance";
import { allCategories, defaultCategories } from "@/lib/categories";
import { AuthUser } from "@/features/auth/components/auth-user";
import { usePwa } from "@/lib/use-pwa";
import { FinanceApiError, financeApi } from "@/data/client/finance-api";
import type { Account, Transaction, Budget, QueuedTransaction } from "@/domain/finance/types";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { day, money } from "@/features/finance/lib/presentation";
import { AccountsTab } from "@/features/finance/components/tabs/accounts-tab";
import { AnalyticsTab } from "@/features/finance/components/tabs/analytics-tab";
import { BudgetTab } from "@/features/finance/components/tabs/budget-tab";
import { HomeTab } from "@/features/finance/components/tabs/home-tab";
import { SettingsTab } from "@/features/finance/components/tabs/settings-tab";
import { TransactionsTab } from "@/features/finance/components/tabs/transactions-tab";
import { ConfirmationDialogs } from "@/features/finance/components/drawers/confirmation-dialogs";
import { FinanceEntryDrawer, type FinanceEntryMode as Mode, type FinanceEntryType as EntryType } from "@/features/finance/components/drawers/finance-entry-drawer";
import { InstallGuideDrawer } from "@/features/finance/components/drawers/install-guide-drawer";
import { ReconcileDrawer } from "@/features/finance/components/drawers/reconcile-drawer";

type Tab = "home" | "accounts" | "transactions" | "budget" | "analytics" | "settings";
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
      hasPending={hasPending}
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
    <InstallGuideDrawer
      open={installGuideOpen}
      onOpenChange={setInstallGuideOpen}
      pwa={pwa}
      onCopyAppLink={()=>void copyAppLink()}
    />
    <FinanceEntryDrawer
      mode={mode}
      editing={editing}
      saving={saving}
      quickText={quickText}
      name={name}
      kind={kind}
      opening={opening}
      amount={amount}
      account={account}
      destination={destination}
      category={category}
      note={note}
      date={date}
      type={type}
      accounts={data.accounts}
      transactions={data.transactions}
      categories={categories}
      activeBudget={activeBudget}
      beforeBudget={beforeBudget}
      afterBudget={afterBudget}
      formatMoney={fmt}
      onModeChange={setMode}
      onQuickTextChange={setQuickText}
      onReadQuick={readQuick}
      onNameChange={setName}
      onKindChange={setKind}
      onOpeningChange={setOpening}
      onAmountChange={setAmount}
      onAccountChange={setAccount}
      onDestinationChange={setDestination}
      onCategoryChange={setCategory}
      onNoteChange={setNote}
      onDateChange={setDate}
      onTypeChange={nextType=>{
        setType(nextType);
        if(nextType!=="transfer"&&category==="Transfer")setCategory(nextType==="income"?"Gaji":categories[0]);
      }}
      onSubmit={save}
    />
    <ReconcileDrawer
      account={reconcileAccount}
      expectedBalance={expectedBalance}
      actualBalance={actualBalance}
      note={reconcileNote}
      saving={reconcileSaving}
      onActualBalanceChange={setActualBalance}
      onNoteChange={setReconcileNote}
      onClose={()=>setReconcileAccount(null)}
      onSubmit={e=>void saveReconciliation(e)}
    />
    <ConfirmationDialogs
      target={target}
      onTargetChange={setTarget}
      onDelete={()=>void remove()}
      pendingBackup={pendingBackup}
      restoring={restoring}
      onPendingBackupChange={setPendingBackup}
      onRestore={()=>void restoreBackup()}
    />
  </div></>;
}