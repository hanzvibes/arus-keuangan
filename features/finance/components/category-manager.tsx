"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { defaultCategories } from "@/lib/categories";
import { financeApi } from "@/data/client/finance-api";
import { readQueue } from "@/lib/offline";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Category = { id: string; name: string };
type Props = { custom: Category[]; offline: boolean; pendingCount: number; onChange: () => Promise<void> };

export function CategoryManager({ custom, offline, pendingCount, onChange }: Props) {
  const [name, setName] = useState(""), [editing, setEditing] = useState<string | null>(null), [deleting, setDeleting] = useState<Category | null>(null), [busy, setBusy] = useState(false);
  async function request(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    if (pendingCount) { toast.error("Kirim atau batalkan transaksi tertunda sebelum mengubah kategori."); return; }
    setBusy(true);
    try {
      if ((await readQueue()).length) throw Error("Kirim atau batalkan transaksi tertunda sebelum mengubah kategori.");
      await financeApi.category(method, body);
      await onChange(); setName(""); setEditing(null); setDeleting(null); toast.success(method === "DELETE" ? "Kategori dihapus." : "Kategori disimpan.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Kategori belum bisa diproses."); }
    finally { setBusy(false); }
  }
  return <div className="surface data-panel category-manager"><div className="data-panel-head"><div><h2>Kategori</h2><p>Tambahkan kategori pribadi. Mengubah nama akan memperbarui transaksi, budget, dan jadwal terkait.</p></div></div>
    <form className="category-add" onSubmit={event => { event.preventDefault(); void request(editing ? "PATCH" : "POST", { id: editing, name }); }}><input aria-label="Nama kategori" maxLength={50} required placeholder="Nama kategori baru" value={name} disabled={offline || busy || pendingCount>0} onChange={event => setName(event.target.value)}/><button disabled={offline || busy || pendingCount>0 || !name.trim()} type="submit">{editing ? <Check size={17}/> : <Plus size={17}/>} {editing ? "Simpan" : "Tambah"}</button>{editing && <button type="button" className="category-cancel" aria-label="Batal edit kategori" onClick={() => { setEditing(null); setName(""); }}><X size={17}/></button>}</form>
    {offline && <p className="inline-note">Hubungkan internet untuk mengubah kategori.</p>}
    {pendingCount>0 && <p className="inline-note">Selesaikan transaksi tertunda sebelum mengubah kategori agar kategorinya tetap sesuai.</p>}
    <div className="category-chips"><span>Kategori bawaan</span><div>{defaultCategories.map(category => <span className="category-chip" key={category}>{category}</span>)}</div></div>
    <div className="category-chips"><span>Kategorimu ({custom.length})</span>{custom.length ? <div>{custom.map(category => <span className="category-chip editable" key={category.id}>{category.name}<button aria-label={`Edit kategori ${category.name}`} disabled={offline || busy || pendingCount>0} onClick={() => { setEditing(category.id); setName(category.name); }}><Pencil size={14}/></button><button aria-label={`Hapus kategori ${category.name}`} disabled={offline || busy || pendingCount>0} onClick={() => setDeleting(category)}><Trash2 size={14}/></button></span>)}</div> : <p>Belum ada kategori pribadi.</p>}</div>
    <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus kategori {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>Kategori yang masih digunakan tidak dapat dihapus. Transaksimu tidak akan ikut terhapus.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction disabled={busy} variant="destructive" onClick={() => deleting && void request("DELETE", { id: deleting.id })}>Hapus</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}