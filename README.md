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
- `/forgot-password` mengirim tautan pemulihan melalui Supabase Auth tanpa mengungkap apakah email terdaftar.
- Tautan recovery kembali melalui `/auth/callback?next=/update-password`, lalu PKCE code ditukar menjadi session server-side.
- `/update-password` hanya dapat dibuka dengan session terautentikasi dan memperbarui password menggunakan `auth.updateUser`.
- `/profile` memungkinkan user mengubah nama profil; email tetap berasal dari Supabase Auth.
- Record `profiles` dibuat otomatis saat user Auth dibuat.
- Route aplikasi dilindungi melalui `proxy.ts`.
- Identity diverifikasi menggunakan `supabase.auth.getClaims()`.
- Request `/api/*` tanpa session valid mendapat HTTP 401.
- Sign out lebih dulu memastikan session Supabase berakhir, lalu membersihkan cache perangkat Arus agar kegagalan jaringan tidak menghapus data offline saat user sebenarnya masih login. Jika pembersihan lokal gagal karena tab lain masih aktif, Arus memberi peringatan sebelum login berikutnya pada perangkat bersama.

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

PWA menyimpan snapshot terakhir di perangkat untuk pengalaman offline. Transaksi baru yang gagal karena jaringan atau timeout dapat masuk antrean perangkat dan dicoba lagi saat online. ID transaksi dibuat di client, sehingga sinkronisasi ulang tetap idempotent bila respons server sempat terputus setelah transaksi tersimpan.

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

Arus menggunakan Next.js native di Vercel. Database dan auth berada di Supabase. Legacy Cloudflare D1, Drizzle SQLite, Vinext, Vite runtime, dan Wrangler telah dihapus dari repository aktif.

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
- Response aplikasi membawa header anti-clickjacking, MIME sniffing protection, referrer policy, permissions policy, HSTS, dan CSP minimal.
- Response `/api/*` memakai `Cache-Control: no-store` agar data finansial terautentikasi tidak disimpan sebagai cache browser atau shared proxy.
- Header `X-Powered-By` Next.js dinonaktifkan.
- Mutasi `/api/*` menolak request browser cross-site berdasarkan `Origin` / `Sec-Fetch-Site` sebelum data diakses.
- Body API wajib `application/json`, JSON rusak menghasilkan 4xx, dan payload biasa dibatasi 64 KB; restore backup memiliki batas 3 MB.
- Pesan registrasi tidak mengonfirmasi secara eksplisit apakah sebuah email sudah memiliki akun.
- `/api/health` menyediakan probe uptime publik yang minimal, tanpa membaca session, database, atau data user.
- Error server finance memiliki correlation ID melalui header `X-Request-Id`; log production dicatat sebagai JSON terstruktur tanpa body request.
- CI menjalankan lint, typecheck, test, dan production build sebelum perubahan dianggap layak deploy.
- Finance API client membatasi request biasa 10 detik dan operasi backup/restore 30 detik agar UI tidak menggantung tanpa batas.
- Retry otomatis hanya berlaku untuk GET yang aman, maksimal satu kali pada gangguan jaringan atau HTTP 502/503/504. POST/PATCH/DELETE tidak pernah diulang otomatis.
- `FinanceApiError` membawa status, jenis kegagalan, dan correlation `requestId` dari server bila tersedia untuk membantu troubleshooting.

## Database schema di version control

Schema aplikasi Supabase dicatat di `supabase/schemas/arus.sql`. File tersebut adalah snapshot deklaratif dari object aplikasi yang aktif: tabel finance, profil, RLS, RPC, dan trigger profil.

Karena finance schema awal dibuat sebelum workflow Supabase CLI dibakukan, repository belum memiliki baseline migration hasil `supabase db pull`. Ikuti `supabase/README.md` sebelum perubahan schema berikutnya agar migration history dan repository kembali sinkron.

Data D1 lama tidak otomatis dipindahkan. Bila ada backup D1 yang masih perlu dipertahankan, restore melalui menu cadangan setelah user login.