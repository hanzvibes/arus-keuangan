"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Pencil, ReceiptText, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { receiptApi } from "../client";
import type { ReceiptMeta } from "../types";
import type { Transaction } from "@/domain/finance/types";

const money = (value: number | null | undefined) => value === null || value === undefined ? "—" : `Rp ${value.toLocaleString("id-ID")}`;

export function ReceiptDetail({ transaction, onClose, onEdit }: { transaction: Transaction | null; onClose: () => void; onEdit: (scanId: string) => void }) {
  const [detail, setDetail] = useState<{ id: string; receipt: ReceiptMeta; photoUrl: string | null } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  useEffect(() => {
    if (!transaction) return;
    let active = true;
    void receiptApi.detail(transaction.id).then(result => {
      if (active) { setDetail({ ...result, id: transaction.id }); setError(null); }
    }).catch(cause => { if (active) setError({ id: transaction.id, message: cause instanceof Error ? cause.message : "Detail struk gagal dimuat." }); });
    return () => { active = false; };
  }, [transaction]);
  const current = detail?.id === transaction?.id ? detail : null;
  const currentError = error?.id === transaction?.id ? error?.message : null;
  return <Drawer open={!!transaction} onOpenChange={open => !open && onClose()} direction="bottom">
    <DrawerContent className="form-sheet receipt-detail-sheet">
      <DrawerHeader><div className="drawer-heading"><DrawerTitle>Detail Struk</DrawerTitle><button aria-label="Tutup detail struk" onClick={onClose}><X size={19}/></button></div><DrawerDescription>Rincian transaksi yang sudah kamu simpan.</DrawerDescription></DrawerHeader>
      <div className="form-sheet-scroll receipt-body" data-vaul-no-drag>
        {currentError && <p role="alert" className="receipt-warning">{currentError}</p>}
        {!current && !currentError && <div role="status" className="skeleton loading-balance"><span className="sr-only">Memuat detail struk…</span></div>}
        {current && <>
          <div className="receipt-detail-hero"><span className="receipt-review-icon"><ReceiptText size={25}/></span><h3>{current.receipt.merchant || transaction?.note}</h3><strong>{money(transaction?.amount)}</strong><p>{transaction?.date} {current.receipt.time && `· ${current.receipt.time}`}</p></div>
          <dl className="receipt-detail-list"><div><dt>Metode pembayaran</dt><dd>{current.receipt.paymentMethod || "Tidak terbaca"}</dd></div><div><dt>Nomor struk</dt><dd>{current.receipt.invoice || "Tidak terbaca"}</dd></div>{(["subtotal", "tax", "service", "discount"] as const).map((key, i) => <div key={key}><dt>{["Subtotal", "Pajak", "Service", "Diskon"][i]}</dt><dd>{money(current.receipt[key])}</dd></div>)}</dl>
          <section className="receipt-detail-items"><h4>Barang <span>{current.receipt.items.length}</span></h4>{current.receipt.items.length ? current.receipt.items.map((item, index) => <div key={index}><span><b>{item.name}</b><small>{item.quantity ?? "?"} × {money(item.unitPrice)}</small></span><strong>{money(item.total)}</strong></div>) : <p>Barang tidak terdeteksi.</p>}</section>
          {current.photoUrl && <a className="receipt-secondary" href={current.photoUrl} target="_blank" rel="noreferrer"><ExternalLink size={17}/> Buka foto struk</a>}
          {current.receipt.scanId && <div className="receipt-sticky-actions"><button className="save-button" onClick={() => onEdit(current.receipt.scanId!)}><Pencil size={17}/> Edit detail struk</button></div>}
        </>}
      </div>
    </DrawerContent>
  </Drawer>;
}
