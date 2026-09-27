# Arus — Keuangan Pribadi

Arus adalah aplikasi personal finance multi-user untuk mencatat akun, transaksi, transfer, budget, kategori pribadi, rekonsiliasi saldo, dan jadwal rutin.

## Arsitektur data

**Supabase adalah source of truth utama.**

- **Supabase Auth**: email/password, session cookie via `@supabase/ssr`.
- **Supabase Postgres**: menyimpan seluruh data finansial.
- **Row Level Security (RLS)**: setiap record dimiliki `user_id = auth.uid()`.
- **PWA / IndexedDB**: hanya cache perangkat dan antrean transaksi ketika jaringan gagal, bukan database utama.
- **API route Next.js**: menjaga kontrak API UI saat ini dan memakai Supabase session user di server.

Tabel utama:

- `accounts`
- `transactions`
- `budgets`
- `categories`
- `recurring`
- `profiles`

Semua tabel finansial mempunyai ownership per-user. Tabel `profiles` memakai `id = auth.users.id` dan hanya bisa dibaca/diubah oleh pemiliknya. Foreign key akun juga mengikat pasangan `(user_id, id)`, sehingga transaksi milik satu user tidak dapat menunjuk akun milik user lain.

Operasi yang harus atomik dijalankan sebagai fungsi Postgres:

- `arus_rename_category`
- `arus_skip_recurring`
- `arus_record_recurring`
- `arus_reconcile_balance`
- `arus_restore_backup`

Fungsi tersebut menggunakan `SECURITY INVOKER`, sehingga tetap tunduk pada RLS user yang sedang login.

## Environment

Salin environment contoh:

```sh
cp .env.example .env.local
```

Variable yang dibutuhkan:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Gunakan **publishable key** pada aplikasi. Jangan menaruh `service_role` atau secret key di variable `NEXT_PUBLIC_*`.

Variable yang sama perlu dikonfigurasi di Vercel atau platform hosting lain.

## Auth dan profil

- `/register` membuat akun Supabase Auth dengan email, password, dan nama.
- Jika email confirmation aktif, verifikasi kembali ke `/auth/callback` dan PKCE code ditukar menjadi session server-side.
- `/login` memakai email + password.
- `/profile` memungkinkan user mengubah nama profil; email tetap berasal dari Supabase Auth.
- Record `profiles` dibuat otomatis saat user Auth dibuat.
- Route aplikasi dilindungi melalui `proxy.ts`.
- Identity diverifikasi menggunakan `supabase.auth.getClaims()`.
- Request `/api/*` tanpa session valid mendapat HTTP 401.
- Sign out membersihkan cache perangkat Arus agar snapshot finansial user sebelumnya tidak terbaca user berikutnya pada perangkat bersama.

Untuk email confirmation di deployment, URL origin aplikasi perlu tersedia sebagai redirect URL yang diizinkan pada konfigurasi Supabase Auth.

## Isolasi multi-user

Data tidak dipisahkan hanya di frontend. Supabase RLS menerapkan aturan ownership langsung di Postgres:

```text
User A ── auth.uid() A ──> hanya row user_id A
User B ── auth.uid() B ──> hanya row user_id B
```

Role `anon` tidak memperoleh akses CRUD ke tabel finansial.

## Backup dan restore

Menu Data & Cadangan tetap menggunakan format JSON versi 2.

- Export hanya mengambil data user yang sedang login karena RLS.
- Restore divalidasi di aplikasi lalu dijalankan secara atomik melalui Postgres function.
- Restore hanya mengganti data milik user yang sedang login.

## Recurring

Jadwal mingguan atau bulanan tidak mendebit saldo otomatis. Pengguna memilih:

- **Catat** untuk membuat transaksi dan memajukan jadwal.
- **Lewati** untuk memajukan jadwal tanpa transaksi.

Record + advance dilakukan secara atomik di database.

## Offline

PWA menyimpan snapshot terakhir di perangkat untuk pengalaman offline. Transaksi yang gagal dikirim dapat masuk antrean perangkat dan dicoba lagi saat online.

Supabase Postgres tetap menjadi source of truth. Cache perangkat dibersihkan saat logout.

## Development

Prerequisite:

- Node.js `>=22.13.0`
- pnpm `11.25.0`

Command:

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
```

## Deployment

Arus sekarang menggunakan build **Next.js native**:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Cloudflare/Vinext tidak lagi dipakai oleh script runtime aplikasi. Database dan auth berada di Supabase.

### Vercel

Repository sudah menyertakan `vercel.json` dengan framework `nextjs`, install command pnpm, build command Next.js, serta header PWA untuk service worker.

Konfigurasi project di Vercel:

1. Import repository `hanzvibes/arus-keuangan`.
2. Root Directory: repository root.
3. Framework Preset: Next.js.
4. Tambahkan environment variable berikut untuk **Production** dan **Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
5. Deploy branch `main`.

Tidak diperlukan database Vercel, D1 binding, Wrangler, atau Cloudflare Worker.

Untuk email confirmation Supabase, tambahkan domain production Vercel ke Supabase Auth URL Configuration dan izinkan callback:

```text
https://<domain-production>/auth/callback
```

Preview deployment yang memakai signup/email confirmation juga perlu origin preview yang diizinkan, atau gunakan domain development khusus yang stabil.

## Security

Baseline keamanan database:

- RLS aktif untuk seluruh tabel finansial.
- Policies menggunakan `auth.uid() = user_id`.
- `anon` tidak punya CRUD access.
- Fungsi mutasi atomik memakai `SECURITY INVOKER`.
- Supabase security advisor dicek setelah perubahan schema.

## Catatan migrasi D1

Implementasi aktif tidak lagi membaca atau menulis Cloudflare D1. File legacy D1/Drizzle yang masih tersisa di repository hanya artefak starter lama dan dapat dihapus pada cleanup dependency terpisah.

Data D1 lama tidak otomatis dipindahkan karena runtime/database D1 production tidak tersedia melalui migrasi ini. Bila ada data lama yang perlu dipertahankan, ekspor dari instalasi D1 lama lalu restore melalui menu backup user setelah login.