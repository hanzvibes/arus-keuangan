"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronRight, Pause, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import { nextOccurrence, type Frequency } from "@/lib/recurring";
import { financeApi } from "@/data/client/finance-api";
import type { RecurringRule } from "@/domain/finance/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Account = { id: string; name: string };
type Props = { rules: RecurringRule[]; accounts: Account[]; categories: string[]; month: string; offline: boolean; onChange: () => Promise<void>; money: (value: number) => string };
type Form = Pick<RecurringRule, "type" | "category" | "note" | "nextDate" | "frequency" | "accountId"> & { amount: string; toAccountId: string };
const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-"); };
const fresh = (account = "", category = "Lainnya"): Form => ({ type: "expense", amount: "", accountId: account, toAccountId: "", category, note: "", nextDate: today(), frequency: "monthly" });
const labelDate = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

function occurrences(rule: RecurringRule, month: string) {
  if (!rule.active) return [];
  const end = month + "-31";
  const found: string[] = [];
  let date = rule.nextDate;
  for (let i = 0; i < 72 && date <= end; i++) {
    if (date.startsWith(month)) found.push(date);
    date = nextOccurrence(date, rule.frequency, rule.anchorDay);
  }
  return found;
}

export function RecurringSection({ rules, accounts, categories, month, offline, onChange, money }: Props) {
  const [form, setForm] = useState<Form>(fresh(accounts[0]?.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<RecurringRule | null>(null);
  const [selected, setSelected] = useState("");
  const selectedDay = selected.startsWith(month) ? selected : (month === today().slice(0, 7) ? today() : month + "-01");
  const days = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  const offset = (new Date(month + "-01T12:00:00").getDay() + 6) % 7;
  const calendar = rules.flatMap(rule => occurrences(rule, month).map(date => ({ rule, date })));
  const selectedRules = calendar.filter(item => item.date === selectedDay);
  const upcoming = rules.filter(rule => rule.active && rule.nextDate <= today()).sort((a, b) => a.nextDate.localeCompare(b.nextDate));

  function start(rule?: RecurringRule) {
    setEditing(rule?.id || null);
    setForm(rule ? { type: rule.type, amount: String(rule.amount), accountId: rule.accountId, toAccountId: rule.toAccountId || "", category: rule.category, note: rule.note, nextDate: rule.nextDate, frequency: rule.frequency } : fresh(accounts[0]?.id, categories[0]));
    setOpen(true);
  }
  async function send(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) {
    setBusy(true);
    try {
      await financeApi.recurring(method, body);
      await onChange(); toast.success(success); setOpen(false); setDeleting(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Jadwal belum bisa diproses."); }
    finally { setBusy(false); }
  }
  function update<K extends keyof Form>(key: K, value: Form[K]) { setForm(current => ({ ...current, [key]: value })); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    await send(editing ? "PATCH" : "POST", { ...form, id: editing, amount: Number(form.amount) }, editing ? "Jadwal diperbarui." : "Jadwal ditambahkan.");
  }
  const action = (rule: RecurringRule, kind: "record" | "skip") => send("POST", { action: kind, id: rule.id, due: rule.nextDate, recordedDate: today() }, kind === "record" ? "Transaksi rutin dicatat." : "Jadwal dilewati.");

  return <section className="schedule-section">
    <div className="schedule-heading"><div><h2>Jadwal & tagihan</h2><p>Catat saat benar-benar dibayar atau diterima.</p></div><button className="schedule-add" onClick={() => start()} disabled={offline || !accounts.length}><Plus size={16}/> Tambah jadwal</button></div>
    {offline && <p className="inline-note">Jadwal hanya dapat diubah saat terhubung. Riwayat terakhir tetap tersedia.</p>}
    <div className="schedule-calendar surface"><div className="calendar-month"><CalendarDays size={18}/><strong>{new Date(month + "-01T12:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</strong></div>
      <div className="calendar-grid">{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(day => <span className="calendar-weekday" key={day}>{day}</span>)}{Array.from({ length: offset }, (_, i) => <span key={"blank-" + i}/>)}{Array.from({ length: days }, (_, i) => { const date = month + "-" + String(i + 1).padStart(2, "0"), count = calendar.filter(item => item.date === date).length; return <button key={date} className={(date === selectedDay ? "selected " : "") + (date === today() ? "today" : "")} onClick={() => setSelected(date)} aria-label={`${labelDate(date)}${count ? `, ${count} jadwal` : ""}`} aria-pressed={date === selectedDay}>{i + 1}{count > 0 && <i/>}</button>; })}</div>
      <div className="calendar-detail"><b>{labelDate(selectedDay)}</b>{selectedRules.length ? selectedRules.map(({ rule }) => <span key={rule.id}>{rule.note || rule.category} · {money(rule.amount)}</span>) : <span>Tidak ada jadwal.</span>}</div>
    </div>
    {upcoming.length > 0 && <div className="due-list"><h3>Perlu ditinjau ({upcoming.length})</h3>{upcoming.map(rule => <div className="due-card surface" key={rule.id}><div><b>{rule.note || rule.category}</b><small>Jatuh tempo {labelDate(rule.nextDate)} · {rule.frequency === "monthly" ? "Bulanan" : "Mingguan"}</small></div><strong>{money(rule.amount)}</strong><div className="due-actions"><button disabled={busy || offline} onClick={() => void action(rule, "record")}><Check size={15}/> Catat</button><button disabled={busy || offline} onClick={() => void action(rule, "skip")}>Lewati</button></div></div>)}</div>}
    <div className="schedule-manage"><h3>Semua jadwal</h3>{rules.length ? rules.map(rule => <div className="schedule-row surface" key={rule.id}><div><b>{rule.note || rule.category}</b><small>{rule.active ? "Berikutnya " + labelDate(rule.nextDate) : "Dijeda"} · {rule.frequency === "monthly" ? "Bulanan" : "Mingguan"}</small></div><strong>{money(rule.amount)}</strong><div className="schedule-row-actions"><button aria-label={`Edit ${rule.note || rule.category}`} disabled={offline} onClick={() => start(rule)}><Pencil size={16}/></button><button aria-label={rule.active ? "Jeda jadwal" : "Lanjutkan jadwal"} disabled={offline || busy} onClick={() => void send("PATCH", { action: "toggle", id: rule.id, active: !rule.active }, rule.active ? "Jadwal dijeda." : "Jadwal dilanjutkan.")}>{rule.active ? <Pause size={16}/> : <Play size={16}/>}</button><button aria-label={`Hapus jadwal ${rule.note || rule.category}`} disabled={offline || busy} onClick={() => setDeleting(rule)}><Trash2 size={16}/></button></div></div>) : <div className="empty-inside">Belum ada jadwal rutin. Tambahkan tagihan, gaji, atau pengeluaran mingguan.</div>}</div>
    <AlertDialog open={!!deleting} onOpenChange={value => !value && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus jadwal {deleting?.note || deleting?.category}?</AlertDialogTitle><AlertDialogDescription>Transaksi yang sudah dicatat tetap tersimpan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction variant="destructive" disabled={busy} onClick={() => deleting && void send("DELETE", { id: deleting.id }, "Jadwal dihapus.")}>Hapus jadwal</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <Drawer open={open} onOpenChange={setOpen}><DrawerContent className="form-sheet"><DrawerHeader><div className="drawer-heading"><DrawerTitle>{editing ? "Edit Jadwal" : "Tambah Jadwal"}</DrawerTitle><button aria-label="Tutup formulir" onClick={() => setOpen(false)}><X size={19}/></button></div><DrawerDescription>Catatan baru dibuat saat kamu menekan Catat pada tanggal jatuh tempo.</DrawerDescription></DrawerHeader><div className="form-sheet-scroll" data-vaul-no-drag><form className="form-body" onSubmit={event => void save(event)}>
      <label>Jenis<select value={form.type} onChange={event => update("type", event.target.value as Form["type"])}><option value="expense">Pengeluaran</option><option value="income">Pemasukan</option><option value="transfer">Transfer</option></select></label>
      <label>Jumlah (Rp)<input required type="number" min="1" inputMode="numeric" value={form.amount} onChange={event => update("amount", event.target.value)}/></label>
      <label>Akun<select required value={form.accountId} onChange={event => update("accountId", event.target.value)}>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      {form.type === "transfer" ? <label>Akun tujuan<select required value={form.toAccountId} onChange={event => update("toAccountId", event.target.value)}><option value="">Pilih akun tujuan</option>{accounts.filter(account => account.id !== form.accountId).map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label> : <label>Kategori<select value={form.category} onChange={event => update("category", event.target.value)}>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>}
      <label>Catatan<input maxLength={150} placeholder="Contoh: Internet rumah" value={form.note} onChange={event => update("note", event.target.value)}/></label>
      <label>Berulang<select value={form.frequency} onChange={event => update("frequency", event.target.value as Frequency)}><option value="monthly">Setiap bulan</option><option value="weekly">Setiap minggu</option></select></label>
      <label>Jatuh tempo berikutnya<input required type="date" value={form.nextDate} onChange={event => update("nextDate", event.target.value)}/></label>
      <button className="save-button" type="submit" disabled={busy}>{busy ? "Menyimpan..." : "Simpan jadwal"} <ChevronRight size={18}/></button>
    </form></div></DrawerContent></Drawer>
  </section>;
}