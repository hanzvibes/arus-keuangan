"use client";

import { AlertCircle, Check, ChevronRight, Plus, ReceiptText, Trash2 } from "lucide-react";
import type { Transaction } from "@/domain/finance/types";
import type { ReceiptDraft } from "../types";
import { receiptArithmetic, receiptNeedsReview } from "../validation";

export const receiptFieldNames = { merchant: "Merchant", date: "Tanggal", total: "Nominal", paymentMethod: "Metode pembayaran", category: "Kategori", time: "Waktu", invoice: "Nomor struk", subtotal: "Subtotal", tax: "Pajak", service: "Service", discount: "Diskon" } as const;
export type ReceiptFieldKey = keyof typeof receiptFieldNames;
export type DuplicateReview = { ids: string[]; token: string; reasons: Record<string, string[]> };

type Props = {
  draft: ReceiptDraft;
  onChange: (draft: ReceiptDraft) => void;
  onFieldChange: (key: ReceiptFieldKey, value: string) => void;
  accounts: { id: string; name: string }[];
  accountId: string;
  onAccountChange: (id: string) => void;
  categories: string[];
  transactions: Transaction[];
  duplicate: DuplicateReview | null;
  acknowledged: boolean;
  onAcknowledgedChange: (checked: boolean) => void;
};

export function ReceiptReview({ draft, onChange, onFieldChange, accounts, accountId, onAccountChange, categories, transactions, duplicate, acknowledged, onAcknowledgedChange }: Props) {
  const arithmetic = receiptArithmetic(draft);
  function field(key: ReceiptFieldKey) {
    const value = draft[key];
    const low = !value.checked && (value.ambiguous || value.confidence !== null && value.confidence < 80 || value.value === null && ["date", "total"].includes(key));
    const money = ["total", "subtotal", "tax", "service", "discount"].includes(key);
    return <label key={key} className={`receipt-field${low ? " receipt-low" : ""}${key === "total" ? " receipt-total-field" : ""}`}>
      <span className="receipt-field-heading">{receiptFieldNames[key]}<span className="receipt-confidence">{value.checked ? <><Check size={12}/> Diperiksa pengguna</> : low ? <><AlertCircle size={13}/> Periksa{value.confidence !== null ? ` · ${value.confidence}%` : ""}</> : value.confidence !== null ? `${value.confidence}%` : ""}</span></span>
      <input type={key === "date" ? "date" : money ? "number" : "text"} inputMode={money ? "numeric" : undefined} value={value.value ?? ""} placeholder={key === "total" ? "0" : "Belum terdeteksi"} onChange={event => onFieldChange(key, event.target.value)}/>
      {key === "total" && <small>Rupiah · jumlah yang akan dicatat</small>}
    </label>;
  }
  return <div className="receipt-review">
    <div className="receipt-review-intro"><span className="receipt-review-icon"><ReceiptText size={24}/></span><div><h3>Periksa strukmu</h3><p>Pastikan detailnya benar sebelum disimpan.</p></div></div>
    {field("total")}
    <div className="receipt-field-group">{field("merchant")}{field("date")}
      <label className="receipt-field"><span className="receipt-field-heading">Akun</span><select value={accountId} onChange={event => onAccountChange(event.target.value)}><option value="">Pilih akun</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label className="receipt-field"><span className="receipt-field-heading">Kategori{draft.category.inferred && !draft.category.checked && <small>Saran</small>}</span><select value={draft.category.value ?? "Lainnya"} onChange={event => onFieldChange("category", event.target.value)}>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></label>
      {field("paymentMethod")}
      <label className="receipt-field"><span className="receipt-field-heading">Catatan</span><input value={draft.note} maxLength={150} placeholder="Tambahkan catatan" onChange={event => onChange({ ...draft, note: event.target.value })}/></label>
    </div>
    <p className="receipt-confidence-help">Persentase menunjukkan keyakinan pembacaan teks. Tetap periksa nominal dan tanggalnya.</p>
    <details><summary>Item & rincian <span className="receipt-count">{draft.items.length}</span></summary>
      <div className="receipt-field-group">{(["time", "invoice", "subtotal", "tax", "service", "discount"] as const).map(field)}</div>
      <div className="receipt-items">{draft.items.map((item, index) => <div key={index} className="receipt-item">
        <div className="receipt-item-heading"><span>Item {index + 1}</span><button type="button" aria-label={`Hapus item ${index + 1}`} onClick={() => onChange({ ...draft, items: draft.items.filter((_, i) => i !== index) })}><Trash2 size={17}/></button></div>
        <label className="receipt-item-name">Nama barang<input value={item.name} placeholder="Nama barang" onChange={event => onChange({ ...draft, items: draft.items.map((row, i) => i === index ? { ...row, name: event.target.value } : row) })}/></label>
        {(["quantity", "unitPrice", "total"] as const).map(key => <label key={key}>{key === "quantity" ? "Jumlah" : key === "unitPrice" ? "Harga satuan" : "Total item"}<input type="number" step={key === "quantity" ? "any" : "1"} inputMode="decimal" value={item[key] ?? ""} onChange={event => onChange({ ...draft, items: draft.items.map((row, i) => i === index ? { ...row, [key]: event.target.value ? Number(event.target.value) : null } : row) })}/></label>)}
      </div>)}</div>
      <button type="button" className="receipt-add-item" onClick={() => onChange({ ...draft, items: [...draft.items, { name: "", quantity: null, unitPrice: null, total: null, confidence: null }] })}><Plus size={17}/> Tambah item</button>
    </details>
    <p className={`receipt-validation ${arithmetic === "match" ? "is-valid" : ""}`}><AlertCircle size={17}/>{arithmetic === "mismatch" ? "Rincian belum cocok dengan total. Periksa kembali nominalnya." : arithmetic === "unknown" ? "Rincian belum dapat diverifikasi." : "Rincian cocok dengan total."}</p>
    {draft.warnings.map((warning, index) => <p className="receipt-warning" key={index}><AlertCircle size={16}/>{warning}</p>)}
    {duplicate && <div className="receipt-duplicate"><strong><AlertCircle size={18}/> Kemungkinan duplikat</strong><ul>{duplicate.ids.map(id => { const match = transactions.find(row => row.id === id); return <li key={id}><ChevronRight size={15}/><span>{match ? `${match.merchant || match.note} · ${match.date} · Rp ${match.amount.toLocaleString("id-ID")}` : `Transaksi ${id}`}<small>{duplicate.reasons[id]?.length ? duplicate.reasons[id].join(", ") : "Detail struk cocok"}</small></span></li>; })}</ul></div>}
    {(duplicate || receiptNeedsReview(draft)) && <label className="receipt-check receipt-acknowledgment"><input type="checkbox" checked={acknowledged} onChange={event => onAcknowledgedChange(event.target.checked)}/><span>{duplicate ? "Saya sudah memeriksa dan tetap ingin menyimpan" : "Saya sudah memeriksa hasil scan"}</span></label>}
  </div>;
}
