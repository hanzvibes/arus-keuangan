"use client";
import { useRef, useState, type FormEvent } from "react";
import { Pencil, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import type { SavingsGoal } from "@/domain/finance/types";
import { financeApi, FinanceApiError } from "@/data/client/finance-api";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ScreenTitle } from "@/features/finance/components/screen-title";
import { day } from "@/features/finance/lib/presentation";
import { savingsProgress, validateSavingsInput } from "@/lib/savings";

type Props = { goals: SavingsGoal[]; offline: boolean; formatMoney: (value: number) => string; onRefresh: () => Promise<void> };
const dateLabel = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

export function GoalsTab({ goals, offline, formatMoney, onRefresh }: Props) {
  const [editor, setEditor] = useState<{ id: string; original: SavingsGoal | null } | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [date, setDate] = useState("");
  const [deleting, setDeleting] = useState<SavingsGoal | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  function open(goal: SavingsGoal | null) {
    if (offline) { toast.info("Sambungkan internet untuk mengubah target tabungan."); return; }
    setEditor({ id: goal?.id || crypto.randomUUID(), original: goal });
    setName(goal?.name || ""); setTarget(goal ? String(goal.targetAmount) : "");
    setSaved(goal ? String(goal.savedAmount) : "0"); setDate(goal?.targetDate || "");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor || busyRef.current || offline) return;
    const input = validateSavingsInput({ name, targetAmount: Number(target), savedAmount: Number(saved), targetDate: date || null });
    if (!input) { toast.error("Periksa nama, nominal rupiah bulat, dan tanggal target."); return; }
    busyRef.current = true; setBusy(true);
    try {
      await financeApi.goal(editor.original ? "PATCH" : "POST", { ...input, id: editor.id, expectedUpdatedAt: editor.original?.updatedAt });
      setEditor(null); await onRefresh(); toast.success("Target tabungan disimpan.");
    } catch (error) {
      if (error instanceof FinanceApiError && error.status === 409) await onRefresh();
      toast.error(error instanceof Error ? error.message : "Target belum bisa disimpan.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  async function remove() {
    if (!deleting || busyRef.current || offline) return;
    busyRef.current = true; setBusy(true);
    try {
      await financeApi.goal("DELETE", { id: deleting.id, expectedUpdatedAt: deleting.updatedAt });
      setDeleting(null); await onRefresh(); toast.success("Target dihapus.");
    } catch (error) {
      if (error instanceof FinanceApiError && error.status === 409) { setDeleting(null); await onRefresh(); }
      toast.error(error instanceof Error ? error.message : "Target belum bisa dihapus.");
    } finally { busyRef.current = false; setBusy(false); }
  }
  const completed = goals.filter(goal => goal.savedAmount >= goal.targetAmount).length;
  return <section className="screen">
    <ScreenTitle title="Target tabungan" subtitle="Beri arah untuk uang yang kamu sisihkan." action="Tambah Target" onAction={() => open(null)} />
    <div className="surface goal-intro"><Target size={28} /><div><h2>{goals.length ? completed + " dari " + goals.length + " target tercapai" : "Apa yang ingin kamu wujudkan?"}</h2><p>Catat dana yang sudah kamu sisihkan. Progres ini tidak mengubah saldo atau membuat transaksi.</p></div></div>
    {offline && <p className="empty-inline" role="status">Target dari salinan perangkat. Sambungkan internet untuk membuat perubahan.</p>}
    <div className="goals-grid">{goals.map(goal => {
      const progress = savingsProgress(goal, day());
      return <article className="surface goal-card" key={goal.id}>
        <div className="section-head"><div><h2>{goal.name}</h2><p>{goal.targetDate ? "Target " + dateLabel(goal.targetDate) : "Tanpa tenggat"}</p></div>
        <span className={"goal-badge " + (progress.completed ? "complete" : progress.overdue ? "overdue" : "")}>{progress.completed ? "Tercapai" : progress.overdue ? "Lewat tenggat" : "Berjalan"}</span></div>
        <div className="goal-amount"><strong>{formatMoney(goal.savedAmount)}</strong><span>dari {formatMoney(goal.targetAmount)}</span></div>
        <div className="progress" role="progressbar" aria-label={"Progres " + goal.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><span style={{ width: progress.percent + "%" }} /></div>
        <div className="goal-meta"><span>{Math.floor(progress.percent)}% tercapai</span><span>Sisa {formatMoney(progress.remaining)}</span></div>
        {progress.monthlyAmount !== null && <p className="goal-plan">Sisihkan sekitar {formatMoney(progress.monthlyAmount)} per bulan mulai bulan ini.</p>}
        <div className="goal-actions"><button disabled={offline} onClick={() => open(goal)}><Pencil size={15} />Ubah progres</button><button disabled={offline} aria-label={"Hapus target " + goal.name} onClick={() => setDeleting(goal)}><Trash2 size={16} /></button></div>
      </article>;
    })}</div>
    {!goals.length && <div className="surface goal-empty"><Target size={40} /><h2>Mulai dari satu tujuan</h2><p>Dana darurat, liburan, atau barang impian—tentukan nominal dan pantau progresmu.</p><button className="save-button" disabled={offline} onClick={() => open(null)}>Buat target pertama</button></div>}
    <Drawer open={!!editor} onOpenChange={open => { if (!open && !busy) setEditor(null); }}>
      <DrawerContent className="form-sheet"><DrawerHeader><div className="drawer-heading"><DrawerTitle>{editor?.original ? "Ubah target tabungan" : "Target tabungan baru"}</DrawerTitle><button disabled={busy} aria-label="Tutup formulir target" onClick={() => setEditor(null)}><X size={19} /></button></div><DrawerDescription>Isi total dana yang sudah disisihkan. Saldo akun tetap dihitung dari transaksi.</DrawerDescription></DrawerHeader>
      <div className="form-sheet-scroll" data-vaul-no-drag><form className="form-body" onSubmit={event => void save(event)}>
        <fieldset disabled={busy} className="goal-fields">
          <label>Nama target<input required autoFocus maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Dana darurat" /></label>
          <label>Nominal target (Rp)<input required type="number" min="1" max="1000000000000" step="1" inputMode="numeric" value={target} onChange={event => setTarget(event.target.value)} /></label>
          <label>Sudah terkumpul (Rp)<input required type="number" min="0" max="1000000000000" step="1" inputMode="numeric" value={saved} onChange={event => setSaved(event.target.value)} /></label>
          <label>Tenggat (opsional)<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        </fieldset><button className="save-button" disabled={busy || offline} type="submit">{busy ? "Menyimpan…" : "Simpan target"}</button>
      </form></div></DrawerContent>
    </Drawer>
    <Drawer open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
      <DrawerContent className="form-sheet"><DrawerHeader><DrawerTitle>Hapus target tabungan?</DrawerTitle><DrawerDescription>Target “{deleting?.name}” beserta progresnya akan dihapus. Saldo akun dan transaksi tetap sama.</DrawerDescription></DrawerHeader><div className="form-body"><button className="save-button" disabled={busy || offline} onClick={() => void remove()}>{busy ? "Menghapus…" : "Hapus target"}</button><button className="manual-link" disabled={busy} onClick={() => setDeleting(null)}>Batal</button></div></DrawerContent>
    </Drawer>
  </section>;
}
