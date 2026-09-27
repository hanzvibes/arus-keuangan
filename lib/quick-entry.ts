export type QuickEntry = { type: "income" | "expense" | "transfer"; amount: number; category: string; note: string };

export function parseQuickEntry(input: string): { entry?: QuickEntry; error?: string } {
  const text = input.trim();
  if (!text || text.length > 150) return { error: "Tulis satu transaksi singkat, maksimal 150 karakter." };
  const pattern = /(?:rp\s*)?(\d+(?:[.,]\d{1,3})*)(?:\s*(juta|jt|ribu|rb|k))?/gi;
  const matches = [...text.matchAll(pattern)];
  if (matches.length !== 1) return { error: matches.length ? "Ada lebih dari satu angka. Tulis satu transaksi saja." : "Jumlah belum terbaca. Contoh: kopi 25rb." };
  const match = matches[0], raw = match[1], unit = match[2]?.toLowerCase();
  if (!unit && raw.includes(",")) return { error: "Jumlah belum jelas. Gunakan 25000 atau 25rb." };
  const base = unit ? Number(raw.replace(/\./g, "").replace(",", ".")) : Number(raw.replace(/[.,]/g, ""));
  const multiplier = ["juta", "jt"].includes(unit || "") ? 1_000_000 : ["ribu", "rb", "k"].includes(unit || "") ? 1_000 : 1;
  const amount = Math.round(base * multiplier);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000_000_000) return { error: "Jumlah transaksi tidak valid." };
  const lower = text.toLowerCase();
  const type = /\b(transfer|pindah|kirim)\b/.test(lower) ? "transfer" : /\b(gaji|terima|pemasukan|dapat|bonus|honor|jual)\b/.test(lower) ? "income" : "expense";
  let category = type === "income" ? "Gaji" : type === "transfer" ? "Transfer" : "Lainnya";
  if (type === "expense") {
    if (/kopi|makan|sarapan|jajan|minum|resto|snack|latte/.test(lower)) category = "Makanan & Minuman";
    else if (/bensin|ojek|grab|gojek|parkir|tol|taksi|transport/.test(lower)) category = "Transportasi";
    else if (/listrik|internet|pulsa|air|sewa|tagihan/.test(lower)) category = "Tagihan";
    else if (/obat|dokter|klinik|sehat/.test(lower)) category = "Kesehatan";
    else if (/film|game|tenis|tennis|hiburan/.test(lower)) category = "Hiburan";
    else if (/sekolah|kursus|buku|kuliah/.test(lower)) category = "Pendidikan";
    else if (/belanja|baju|sepatu|beli/.test(lower)) category = "Belanja";
  }
  const note = text.replace(match[0], "").replace(/\s+/g, " ").trim() || category;
  return { entry: { type, amount, category, note } };
}
