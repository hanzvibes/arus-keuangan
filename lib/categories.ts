export const defaultCategories = ["Makanan & Minuman", "Transportasi", "Belanja", "Tagihan", "Kesehatan", "Hiburan", "Pendidikan", "Gaji", "Hadiah", "Lainnya"];

export function allCategories(custom: { name: string }[]) {
  return [...defaultCategories, ...custom.map(row => row.name)];
}
