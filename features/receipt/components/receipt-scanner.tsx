"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Check, RotateCw, Trash2, Upload, X, ScanLine, Crop as CropIcon, LoaderCircle, ShieldCheck } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { createClient } from "@/lib/supabase/client";
import { readReceiptDrafts, writeReceiptDrafts } from "@/lib/offline";
import { BrowserReceiptOcr } from "../ocr";
import { decodeReceipt, hashReceiptImage, prepareReceiptImage, type Crop } from "../image";
import { parseReceipt } from "../parser";
import { receiptNeedsReview, validDate, validateReceiptDraft } from "../validation";
import { receiptApi } from "../client";
import { receiptDuplicateReasons } from "../duplicate";
import { ReceiptReview, receiptFieldNames as fieldNames, type DuplicateReview } from "./receipt-review";
import type { Account, Transaction } from "@/domain/finance/types";
import type { ReceiptDraft, ReceiptProgress, ReceiptScan } from "../types";

type Stage = "capture" | "preview" | "processing" | "review";
type Props = { open: boolean; onClose: () => void; onSaved: () => Promise<void>; accounts: Account[]; transactions: Transaction[]; categories: string[]; initialScan?: ReceiptScan | null; initialAccountId?: string };
const blankCrop: Crop = { x: 0, y: 0, width: 1, height: 1 };

export function ReceiptScanner({ open, onClose, onSaved, accounts, transactions, categories, initialScan, initialAccountId }: Props) {
  const [stage, setStage] = useState<Stage>(initialScan?.draft ? "review" : "capture");
  const [photo, setPhoto] = useState<Blob | null>(null), [preview, setPreview] = useState("");
  const [crop, setCrop] = useState<Crop>(blankCrop), [rotation, setRotation] = useState(0), [savePhoto, setSavePhoto] = useState(initialScan?.savePhoto ?? false);
  const [draft, setDraft] = useState<ReceiptDraft | null>(initialScan?.draft ?? null), [scan, setScan] = useState<ReceiptScan | null>(initialScan ?? null);
  const [progress, setProgress] = useState<ReceiptProgress | null>(null), [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState(initialAccountId || accounts[0]?.id || ""), [acknowledged, setAcknowledged] = useState(false), [cameraActive, setCameraActive] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateReview | null>(null);
  const gallery = useRef<HTMLInputElement>(null), cameraInput = useRef<HTMLInputElement>(null), reviewPhotoInput = useRef<HTMLInputElement>(null), video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), controller = useRef<AbortController | null>(null), job = useRef(0);
  const stopCamera = useCallback(() => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; setCameraActive(false); }, []);
  const cancel = useCallback(() => { job.current++; controller.current?.abort(); controller.current = null; stopCamera(); }, [stopCamera]);
  useEffect(() => () => cancel(), [cancel]);
  async function cacheDraft(next: ReceiptScan) {
    try { const { data } = await createClient().auth.getUser(); if (!data.user) return; const old = await readReceiptDrafts<ReceiptScan>(data.user.id) || []; await writeReceiptDrafts(data.user.id, [...old.filter(item => item.id !== next.id), next]); } catch { /* Keep the in-memory draft. */ }
  }
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (video.current && stream.current) video.current.srcObject = stream.current; }, [stage, cameraActive]);
  async function selectPhoto(file?: File) {
    if (!file) return;
    setMessage(""); setDuplicate(null); setDraft(null); stopCamera();
    try { const image = await decodeReceipt(file); image.close(); setPhoto(file); setPreview(URL.createObjectURL(file)); setCrop(blankCrop); setRotation(0); setStage("preview"); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Foto tidak dapat dibuka."); }
  }
  async function selectReviewPhoto(file?: File) {
    if (!file || !scan) return;
    try {
      const image = await decodeReceipt(file); image.close();
      if (await hashReceiptImage(file) !== scan.imageHash) throw Error("Pilih foto asli yang sama dengan scan ini.");
      setPhoto(file); setMessage("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Foto tidak dapat dipakai."); }
  }
  async function startCamera() {
    setMessage("");
    try { stopCamera(); stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }); setCameraActive(true); setStage("capture"); if (video.current) video.current.srcObject = stream.current; }
    catch { setMessage("Kamera tidak tersedia atau izin ditolak. Gunakan pilihan Kamera perangkat atau Galeri."); }
  }
  async function capture() {
    if (!video.current?.videoWidth) return;
    const canvas = document.createElement("canvas"); canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    canvas.getContext("2d")?.drawImage(video.current, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .92));
    if (blob) await selectPhoto(new File([blob], "struk.jpg", { type: "image/jpeg" }));
  }
  function changeField<K extends keyof typeof fieldNames>(key: K, value: string) {
    if (!draft) return;
    const money = ["total","subtotal","tax","service","discount"].includes(key);
    const parsed = money ? value === "" ? null : Number(value) : value || null;
    setDraft({ ...draft, [key]: { ...draft[key], value: parsed, checked: true, ambiguous: false } });
    setAcknowledged(false); setDuplicate(null);
  }
  function changeCrop(key: keyof Crop, percent: number) {
    const requested = percent / 100;
    setCrop(current => {
      if (key === "x") return { ...current, x: Math.min(requested, 1 - current.width) };
      if (key === "y") return { ...current, y: Math.min(requested, 1 - current.height) };
      if (key === "width") return { ...current, width: Math.max(.05, Math.min(requested, 1 - current.x)) };
      return { ...current, height: Math.max(.05, Math.min(requested, 1 - current.y)) };
    });
  }
  async function processPhoto() {
    if (!photo) return;
    const current = ++job.current; const abort = new AbortController(); controller.current = abort;
    setStage("processing"); setMessage(""); setProgress({ stage: "image" });
    const timer = window.setTimeout(() => abort.abort(), 120000);
    let processingScan: ReceiptScan | null = null;
    try {
      const imageHash = await hashReceiptImage(photo);
      const prepared = await prepareReceiptImage(photo, crop, rotation);
      if (abort.signal.aborted) throw Error("Scan melewati batas waktu.");
      let next: ReceiptScan = scan && !scan.transactionId && !scan.draft ? { ...scan, status: "processing", imageHash, visualHash: prepared.visualHash, savePhoto } : { id: crypto.randomUUID(), status: "processing", draft: null, imageHash, visualHash: prepared.visualHash, savePhoto, transactionId: null, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      processingScan = next;
      setScan(next);
      try { if (scan && scan.id === next.id) { const saved = await receiptApi.update(next); next = { ...next, version: saved.version }; } else { const saved = await receiptApi.create(next); next = { ...next, version: saved.version }; } }
      catch { await cacheDraft(next); }
      processingScan = next;
      const ocr = await new BrowserReceiptOcr().recognize(prepared.blob, setProgress, abort.signal);
      if (current !== job.current) return;
      setProgress({ stage: "parsing" });
      const parsed = parseReceipt(ocr);
      if (prepared.darkness) parsed.warnings.push("Foto terlihat gelap. Periksa hasil baca.");
      if (prepared.blurry) parsed.warnings.push("Foto mungkin buram. Periksa hasil baca.");
      if (ocr.words.some(word => word.x < 5 || word.y < 5 || word.x + word.width > prepared.width - 5 || word.y + word.height > prepared.height - 5)) parsed.warnings.push("Sebagian teks dekat tepi foto. Struk mungkin terpotong.");
      if (!ocr.text.trim()) parsed.warnings.push("Teks tidak terbaca. Coba foto ulang.");
      next = { ...next, status: ocr.text.trim() ? receiptNeedsReview(parsed) ? "review" : "success" : "failed", draft: parsed, updatedAt: new Date().toISOString() };
      processingScan = next;
      setDraft(parsed); setScan(next); setStage("review");
      try { const saved = await receiptApi.update(next); setScan({ ...next, version: saved.version }); }
      catch { await cacheDraft(next); setMessage("Draft masih di perangkat ini. Sambungkan internet untuk menyimpan riwayat dan transaksi."); }
      if (!savePhoto) { setPhoto(null); setPreview(""); }
    } catch (error) {
      if (current !== job.current) return;
      setMessage(abort.signal.aborted ? "Scan dihentikan atau melewati 120 detik. Coba ulang." : error instanceof Error ? error.message : "OCR gagal. Coba foto ulang.");
      if (processingScan) { const failed: ReceiptScan = { ...processingScan, status: "failed", updatedAt: new Date().toISOString() }; setScan(failed); void receiptApi.update(failed).catch(() => cacheDraft(failed)); }
      setStage("preview");
    } finally { clearTimeout(timer); controller.current = null; }
  }
  async function save() {
    if (!draft || !scan) return;
    if (!validateReceiptDraft(draft) || !accountId || !validDate(draft.date.value ?? "")) { setMessage("Isi merchant, tanggal, nominal, dan akun dengan benar."); return; }
    if (savePhoto && !photo && !scan.transactionId) { setMessage("Pilih foto asli lagi atau matikan pilihan simpan foto."); return; }
    if (receiptNeedsReview(draft) && !acknowledged) { setMessage("Centang pemeriksaan hasil scan sebelum menyimpan."); return; }
    setBusy(true); setMessage("");
    try {
      let current = scan;
      let remote: ReceiptScan | null = null;
      try { remote = await receiptApi.get(current.id); }
      catch (error) { if (!(error instanceof Error && error.message === "Scan tidak ditemukan.")) throw error; }
      if (!remote) {
        const created = await receiptApi.create(current);
        current = { ...current, version: created.version };
      } else if (remote.version !== current.version) {
        throw Error("Draft berubah di perangkat lain. Muat ulang sebelum menyimpan.");
      }
      if (!current.transactionId) {
        const updated = await receiptApi.update({ ...current, draft, savePhoto, status: receiptNeedsReview(draft) ? "review" : "success" });
        current = { ...current, draft, savePhoto, version: updated.version };
        setScan(current);
      }
      let photoPath: string | null = null;
      if (current.transactionId && savePhoto && !photo) photoPath = (await receiptApi.detail(current.transactionId)).receipt.photoPath;
      if (current.transactionId && savePhoto && !photoPath && !photo) throw Error("Pilih foto asli lagi atau matikan pilihan simpan foto.");
      if (savePhoto && photo) {
        const supabase = createClient(); const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) throw Error("Sesi login tidak valid.");
        const extension = photo.type === "image/png" || !["image/png","image/webp","image/jpeg"].includes(photo.type) ? "png" : photo.type === "image/webp" ? "webp" : "jpg";
        const source = ["image/png","image/webp","image/jpeg"].includes(photo.type) ? photo : (await prepareReceiptImage(photo, blankCrop, 0)).blob;
        photoPath = (await receiptApi.reservePhoto(current.id, extension)).photoPath;
        const uploaded = await supabase.storage.from("arus-receipts").upload(photoPath, source, { contentType: source.type, upsert: true });
        if (uploaded.error) { setMessage("Upload foto gagal. Coba simpan lagi atau matikan pilihan simpan foto."); throw uploaded.error; }
      }
      const result = current.transactionId
        ? await receiptApi.updateTransaction(current.id, { expectedVersion: current.version, accountId, draft, photoPath })
        : await receiptApi.finalize(current.id, { expectedVersion: current.version, transactionId: crypto.randomUUID(), accountId, draft, duplicateToken: duplicate?.token ?? null, photoPath });
      if ("duplicate" in result && result.duplicate && result.token) {
        const ids = result.transactionIds ?? [];
        const reasons: Record<string, string[]> = {};
        try {
          const history = (await receiptApi.list()).scans;
          for (const id of ids) {
            const match = history.find(item => item.transactionId === id);
            reasons[id] = match ? receiptDuplicateReasons(match, current) : [];
          }
        } catch { /* The transaction candidates still appear by ID. */ }
        setDuplicate({ ids, token: result.token, reasons });
        setAcknowledged(false);
        setMessage("Struk ini mungkin sudah dicatat. Periksa transaksi yang cocok sebelum lanjut.");
        return;
      }
      await onSaved(); onClose();
    } catch (error) {
      try {
        const remote = (await receiptApi.list()).scans.find(item => item.id === scan.id);
        if (remote?.transactionId && !scan.transactionId) { await onSaved(); onClose(); return; }
      } catch { /* Keep the draft and show the original failure. */ }
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan struk.");
    }
    finally { setBusy(false); }
  }
  const step = stage === "capture" || stage === "preview" ? 0 : stage === "processing" ? 1 : 2;
  const progressTitle = progress?.stage === "engine" ? "Menyiapkan pembaca struk" : progress?.stage === "image" ? "Menyiapkan gambar" : progress?.stage === "ocr" ? "Membaca strukmu" : "Menyusun draft transaksi";
  return <Drawer open={open} onOpenChange={value => { if (!value && !busy) onClose(); }} direction="bottom">
    <DrawerContent className="form-sheet receipt-sheet">
      <DrawerHeader><div className="drawer-heading"><DrawerTitle>{stage === "review" ? "Review Struk" : "Scan Struk"}</DrawerTitle><button disabled={busy} aria-label="Tutup scan struk" onClick={onClose}><X size={19}/></button></div><DrawerDescription>Foto diproses di perangkatmu. Kamu yang mengonfirmasi transaksi.</DrawerDescription></DrawerHeader>
      <ol className="receipt-steps" aria-label="Tahap scan struk">{["Foto", "Proses", "Review"].map((label, index) => <li key={label} className={index <= step ? "active" : ""} aria-current={index === step ? "step" : undefined}><span>{index < step ? <Check size={12}/> : index + 1}</span>{label}</li>)}</ol>
      <div className="form-sheet-scroll receipt-body" data-vaul-no-drag>
        {stage === "capture" && <div className="receipt-capture">
          <video ref={video} autoPlay playsInline muted className={cameraActive ? "receipt-video" : "hidden"}/>
          {!cameraActive && <><span className="receipt-capture-art"><ScanLine size={48} strokeWidth={1.3}/></span><h3>Satu foto, lebih praktis</h3><p>Letakkan struk di permukaan datar.<br/>Pastikan seluruh teks terlihat dan cukup terang.</p></>}
          {cameraActive && <button className="save-button" onClick={() => void capture()}><Camera size={19}/> Ambil foto</button>}
          <div className="receipt-capture-choices"><button onClick={() => void startCamera()}><Camera size={24}/><strong>Buka kamera</strong><small>Ambil foto sekarang</small></button><button onClick={() => gallery.current?.click()}><Upload size={24}/><strong>Pilih foto</strong><small>Dari galeri perangkat</small></button></div>
          <button className="receipt-native-camera" onClick={() => cameraInput.current?.click()}>Gunakan kamera perangkat</button>
          <p className="receipt-privacy"><ShieldCheck size={15}/> Foto tidak disimpan secara default</p>
        </div>}
        <input ref={reviewPhotoInput} type="file" accept="image/*" hidden onChange={event => { void selectReviewPhoto(event.target.files?.[0]); event.target.value = ""; }}/>
        <input ref={gallery} type="file" accept="image/*" hidden onChange={event => { void selectPhoto(event.target.files?.[0]); event.target.value = ""; }}/>
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={event => { void selectPhoto(event.target.files?.[0]); event.target.value = ""; }}/>
        {stage === "preview" && <div className="receipt-preview">
          <div className="receipt-image-stage">{preview && <div className="receipt-image-frame" style={{ transform: `rotate(${rotation}deg)` }}><Image unoptimized src={preview} alt="Pratinjau struk sebelum diproses" width={900} height={1200}/><div className="receipt-crop-outline" style={{ left: `${crop.x*100}%`, top: `${crop.y*100}%`, width: `${crop.width*100}%`, height: `${crop.height*100}%` }}/></div>}</div>
          <div className="receipt-preview-toolbar"><button onClick={() => setRotation(value => (value + 90) % 360)}><RotateCw size={19}/><span>Putar</span></button><button onClick={() => cameraInput.current?.click()}><Camera size={19}/><span>Foto ulang</span></button><button onClick={() => gallery.current?.click()}><Upload size={19}/><span>Ganti</span></button><button onClick={() => { setPhoto(null); setPreview(""); setStage("capture"); }}><Trash2 size={19}/><span>Hapus</span></button></div>
          <details><summary><CropIcon size={17}/> Potong gambar</summary><p className="receipt-help">Sesuaikan area agar hanya struk yang terbaca.</p>{(["width", "height", "x", "y"] as const).map(key => <label key={key}>{key === "x" ? "Posisi kiri" : key === "y" ? "Posisi atas" : key === "width" ? "Lebar" : "Tinggi"}<input type="range" min={key === "width" || key === "height" ? "5" : "0"} max="100" value={Math.round(crop[key] * 100)} onChange={event => changeCrop(key, Number(event.target.value))}/></label>)}</details>
          <label className="receipt-check receipt-photo-choice"><input type="checkbox" checked={savePhoto} onChange={event => setSavePhoto(event.target.checked)}/><span>Simpan foto bersama transaksi<small>Opsional. Dapat dibuka lagi dari detail transaksi.</small></span></label>
          <div className="receipt-sticky-actions"><button className="save-button" onClick={() => void processPhoto()}><ScanLine size={19}/> Proses struk</button></div>
        </div>}
        {stage === "processing" && <div className="receipt-processing" role="status" aria-live="polite"><span className="receipt-progress-icon"><LoaderCircle size={40}/></span><h3>{progressTitle}</h3><p>Tunggu sebentar, detail struk sedang dibaca.</p>{progress?.percent !== undefined ? <><progress max="100" value={progress.percent} aria-label="Progres membaca struk"/><strong>{progress.percent}%</strong></> : <div className="receipt-progress-indeterminate"/>}<p className="receipt-help">Transaksi belum disimpan.</p><button onClick={() => { cancel(); setStage("preview"); }}>Batalkan proses</button></div>}
        {stage === "review" && draft && <>
          <ReceiptReview draft={draft} onChange={setDraft} onFieldChange={changeField} accounts={accounts} accountId={accountId} onAccountChange={setAccountId} categories={categories} transactions={transactions} duplicate={duplicate} acknowledged={acknowledged} onAcknowledgedChange={setAcknowledged}/>
          <label className="receipt-check receipt-photo-choice"><input type="checkbox" checked={savePhoto} onChange={event => setSavePhoto(event.target.checked)}/><span>Simpan foto bersama transaksi<small>{photo || scan?.transactionId ? "Foto disimpan secara privat di akunmu." : "Pilih kembali foto asli jika ingin menyimpannya."}</small></span></label>
          {savePhoto && !photo && <button className="receipt-secondary" onClick={() => reviewPhotoInput.current?.click()}><Upload size={17}/> Pilih foto asli lagi</button>}
          <div className="receipt-sticky-actions"><button className="receipt-secondary" disabled={busy} onClick={() => { setStage("capture"); setMessage(""); }}>Scan ulang</button><button className="save-button" disabled={busy || !validateReceiptDraft(draft) || !accountId || duplicate !== null && !acknowledged} onClick={() => void save()}>{busy ? <LoaderCircle size={18}/> : <Check size={18}/>} {busy ? "Menyimpan…" : duplicate ? "Tetap simpan" : "Simpan Transaksi"}</button></div>
        </>}
        {message && <p role="alert" className="receipt-warning">{message}</p>}
      </div>
    </DrawerContent>
  </Drawer>;
}
