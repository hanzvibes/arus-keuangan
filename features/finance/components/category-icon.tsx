import { ArrowDownLeft, ArrowLeftRight, Car, Coffee, GraduationCap, HeartPulse, ReceiptText, ShoppingBag, Sparkles, Tag } from "lucide-react";

const icons = { "Makanan & Minuman": Coffee, Transportasi: Car, Belanja: ShoppingBag, Tagihan: ReceiptText, Kesehatan: HeartPulse, Hiburan: Sparkles, Pendidikan: GraduationCap, Gaji: ArrowDownLeft, Transfer: ArrowLeftRight };

export function CategoryIcon({ category, size = 18 }: { category: string; size?: number }) {
  const Icon = icons[category as keyof typeof icons] ?? Tag;
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true"/>;
}
