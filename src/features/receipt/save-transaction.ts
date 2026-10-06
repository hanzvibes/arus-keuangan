import { createClient } from "@/lib/supabase/client";
import { prepareReceiptImage } from "./image";
import { receiptApi } from "./client";
import { receiptDuplicateReasons } from "./duplicate";
import { receiptNeedsReview } from "./validation";
import type { ReceiptDraft, ReceiptScan } from "./types";

const fullImageCrop = { x: 0, y: 0, width: 1, height: 1 };

type DuplicateReview = {
  ids: string[];
  token: string;
  reasons: Record<string, string[]>;
};

type Params = {
  scan: ReceiptScan;
  draft: ReceiptDraft;
  accountId: string;
  savePhoto: boolean;
  photo: Blob | null;
  duplicateToken: string | null;
};

type Result =
  | { kind: "saved"; scan: ReceiptScan }
  | { kind: "duplicate"; scan: ReceiptScan; duplicate: DuplicateReview };

export async function saveReceiptTransaction({
  scan,
  draft,
  accountId,
  savePhoto,
  photo,
  duplicateToken,
}: Params): Promise<Result> {
  let current = scan;
  let remote: ReceiptScan | null = null;

  try {
    remote = await receiptApi.get(current.id);
  } catch (error) {
    if (!(error instanceof Error && error.message === "Scan tidak ditemukan.")) throw error;
  }

  if (!remote) {
    const created = await receiptApi.create(current);
    current = { ...current, version: created.version };
  } else if (remote.version !== current.version) {
    throw Error("Draft berubah di perangkat lain. Muat ulang sebelum menyimpan.");
  }

  if (!current.transactionId) {
    const updated = await receiptApi.update({
      ...current,
      draft,
      savePhoto,
      status: receiptNeedsReview(draft) ? "review" : "success",
    });
    current = { ...current, draft, savePhoto, version: updated.version };
  }

  let photoPath: string | null = null;
  if (current.transactionId && savePhoto && !photo) {
    photoPath = (await receiptApi.detail(current.transactionId)).receipt.photoPath;
  }
  if (current.transactionId && savePhoto && !photoPath && !photo) {
    throw Error("Pilih foto asli lagi atau matikan pilihan simpan foto.");
  }

  if (savePhoto && photo) {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw Error("Sesi login tidak valid.");

    const supported = ["image/png", "image/webp", "image/jpeg"].includes(photo.type);
    const extension = photo.type === "image/png" || !supported
      ? "png"
      : photo.type === "image/webp"
        ? "webp"
        : "jpg";
    const source = supported ? photo : (await prepareReceiptImage(photo, fullImageCrop, 0)).blob;

    photoPath = (await receiptApi.reservePhoto(current.id, extension)).photoPath;
    const uploaded = await supabase.storage
      .from("arus-receipts")
      .upload(photoPath, source, { contentType: source.type, upsert: true });
    if (uploaded.error) throw uploaded.error;
  }

  const result = current.transactionId
    ? await receiptApi.updateTransaction(current.id, {
        expectedVersion: current.version,
        accountId,
        draft,
        photoPath,
      })
    : await receiptApi.finalize(current.id, {
        expectedVersion: current.version,
        transactionId: crypto.randomUUID(),
        accountId,
        draft,
        duplicateToken,
        photoPath,
      });

  if ("duplicate" in result && result.duplicate && result.token) {
    const ids = result.transactionIds ?? [];
    const reasons: Record<string, string[]> = {};
    try {
      const history = (await receiptApi.list()).scans;
      for (const id of ids) {
        const match = history.find(item => item.transactionId === id);
        reasons[id] = match ? receiptDuplicateReasons(match, current) : [];
      }
    } catch {
      // Candidate transaction IDs remain useful even when history refresh fails.
    }

    return {
      kind: "duplicate",
      scan: current,
      duplicate: { ids, token: result.token, reasons },
    };
  }

  return { kind: "saved", scan: current };
}
