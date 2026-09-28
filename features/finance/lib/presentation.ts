export const money = (value: number) =>
  "Rp " + Math.round(value).toLocaleString("id-ID");

export const day = (date = new Date()) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

export const dateText = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

export const categoryEmoji = (category: string) => ({
  "Makanan & Minuman": "☕",
  Transportasi: "🚗",
  Belanja: "🛍",
  Tagihan: "🧾",
  Kesehatan: "✚",
  Hiburan: "🎾",
  Pendidikan: "📚",
  Gaji: "↗",
  Transfer: "⇄",
} as Record<string, string>)[category] || "◈";
