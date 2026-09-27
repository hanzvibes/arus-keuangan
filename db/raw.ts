import { env } from "cloudflare:workers";

export function database() {
  if (!env.DB) throw new Error("Penyimpanan belum tersedia. Coba lagi sebentar.");
  return env.DB;
}
