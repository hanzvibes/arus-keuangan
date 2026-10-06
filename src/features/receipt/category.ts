export function inferReceiptCategory(merchant: string, items: string): string {
  const text = `${merchant} ${items}`.toLocaleLowerCase("id-ID");
  if (/indomaret|alfamart|alfamidi|superindo|hypermart|supermarket|minimarket/.test(text)) return "Belanja";
  if (/spbu|pertamina|shell|bp akr|bensin|solar|pertamax/.test(text)) return "Transportasi";
  if (/restoran|restaurant|coffee|kopi|cafe|kafe|bakery|warung|makan|nasi|ayam|pizza/.test(text)) return "Makanan & Minuman";
  if (/apotek|farmasi|pharmacy|obat|klinik/.test(text)) return "Kesehatan";
  return "Lainnya";
}
