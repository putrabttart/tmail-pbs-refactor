# PBS Mail

Aplikasi temp mail berbasis Next.js (App Router) dengan UI publik dan dashboard admin.

## Fitur Utama
- Alias email sementara, inbox menampilkan pesan terbaru (dibatasi 3 pada UI publik).
- Dashboard admin: statistik alias/domain/log, tambah/hapus domain dan alias, clear logs, token revoke.
- Partner API Key v1: pihak ketiga bisa generate alias, baca inbox alias miliknya, dan ambil OTP.
- Keamanan: Supabase Auth (email/password) untuk admin + allowlist email (`ADMIN_EMAILS`), validasi input (Zod), optional token encryption AES-128, audit log admin actions.
- Observabilitas: health checks (`/health`, `/health/token`), structured logging, cache metrics.
- Deploy-ready: Next.js 14, API routes, migrasi Supabase untuk storage.

## Stack Singkat
- Frontend/Backend: Next.js 14 (App Router)
- Auth admin UI: Supabase Auth (email/password)
- Gmail access: Google APIs (read-only)
- Storage: Supabase (table KV) untuk token dan data runtime

## Prasyarat
- Node.js 18+
- Akun Supabase
- Akun Google Cloud (untuk Gmail API)
- Domain + Cloudflare (Email Routing)

## Variabel Lingkungan (root `.env.local`)
```env
PORT=3000
ADMIN_EMAILS=admin@domain.com,owner@domain.com
ADMIN_API_KEY=  # optional (legacy fallback, kosongkan jika tidak dipakai)

ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080

GOOGLE_CLIENT_ID=<client-id-google>
GOOGLE_CLIENT_SECRET=<client-secret-google>
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
MAX_MESSAGES=20

# Partner API Key
PARTNER_API_ENABLED=true
PARTNER_KEY_PEPPER=<opsional-secret-pepper-untuk-hash-api-key>
PARTNER_DEFAULT_RATE_LIMIT=60
PARTNER_MAX_WAIT_SECONDS=20

TOKEN_ENCRYPTION_KEY=<opsional-32-hex-untuk-AES-128>
TOKEN_PATH=

# Supabase (client)
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>

# Supabase (server storage)
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_KV_TABLE=app_kv
SUPABASE_TABLE_ALIASES=app_aliases
SUPABASE_TABLE_DOMAINS=app_domains
SUPABASE_TABLE_LOGS=app_logs
SUPABASE_TABLE_AUDIT=app_audit
SUPABASE_TABLE_API_KEYS=app_api_keys
SUPABASE_TABLE_PARTNER_ALIASES=app_partner_aliases
SUPABASE_TABLE_PARTNER_ACCESS_LOGS=app_partner_access_logs
```

## Instalasi Lokal (Ringkas)
```bash
npm install
npm run dev
# Buka http://localhost:3000 untuk user UI
# Buka http://localhost:3000/admin/login untuk login admin
```

## Setup Supabase (Auth + Storage KV)
1. Buat project Supabase.
2. Aktifkan Email/Password Auth.
3. Buat user admin (Auth -> Users) dan auto-confirm.
4. Jalankan SQL storage KV (lihat file `supabase/schema.template.sql` atau `supabase/migrations/20260204_0001_app_kv.sql`).
5. Set env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_KV_TABLE`.
6. Isi `ADMIN_EMAILS` dengan email admin yang diizinkan.

## Setup Google OAuth (Gmail API)
1. Buat project di Google Cloud.
2. Enable Gmail API.
3. Buat OAuth Client (Web Application).
4. Set Authorized redirect URIs:
   - Local: `http://localhost:3000/oauth2callback`
   - Production: `https://<domain-anda>/oauth2callback`
5. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

## Setup Cloudflare Email Routing + DNS
Tujuan: semua email ke domain kamu diarahkan ke 1 inbox Gmail (yang juga dipakai oleh Gmail API).

### 1. Tambahkan Domain ke Cloudflare
- Pastikan nameserver domain sudah menunjuk ke Cloudflare.

### 2. Aktifkan Email Routing
- Cloudflare Dashboard -> Email -> Email Routing -> Enable.
- Tambahkan Destination Address (email tujuan), lalu verifikasi lewat email.

### 3. DNS Records Wajib
Hapus MX record lama jika ada, lalu tambahkan record berikut.

MX:
- Name: `@`
- Value: `route1.mx.cloudflare.net`
- Priority: `49`
- Name: `@`
- Value: `route2.mx.cloudflare.net`
- Priority: `50`
- Name: `@`
- Value: `route3.mx.cloudflare.net`
- Priority: `50`

TXT (SPF):
- Name: `@`
- Value: `v=spf1 include:_spf.mx.cloudflare.net ~all`

TXT (DMARC, opsional disarankan):
- Name: `_dmarc`
- Value: `v=DMARC1; p=none; rua=mailto:postmaster@yourdomain.com`

### 4. Buat Route
- Tambahkan Route: `*@domain.com` -> destination email yang sudah diverifikasi.

### 5. Tambahkan Domain ke Aplikasi
- Buka `/admin` -> tab Domains -> Add domain (misal: `domain.com`).
- Pastikan domain `active`.

## Alur Login Admin
1. Buat user admin di Supabase Auth (email dan password).
2. Buka `/admin/login`, login dengan email/password.
3. Akses `/admin` dan data akan terbuka jika email termasuk `ADMIN_EMAILS`.

## Endpoint Utama
- Publik: `/api/messages?alias=...`, `/api/messages/:id`, `/api/aliases`.
- Admin: `/api/admin/stats`, `/api/admin/aliases`, `/api/admin/domains`, `/api/admin/logs`, `/api/admin/keys`, `/auth/revoke`.
- Partner v1: `/api/v1/partner/health`, `/api/v1/partner/aliases`, `/api/v1/partner/messages`, `/api/v1/partner/messages/:id`, `/api/v1/partner/otp`.
- Health: `/health`, `/health/token`.

## Dokumentasi API Partner Publik
Halaman dokumentasi terpisah dan bisa diakses publik di:

- `/docs/api-partner`

Halaman ini memuat cara pakai API, header autentikasi, scope, alur integrasi, dan contoh request.

## Partner API Key (Third-party)
Partner API memakai header:

```http
x-api-key: tpk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Flow umum:
1. Admin buat API key di dashboard admin (menu API Key).
2. Third-party panggil `POST /api/v1/partner/aliases` untuk generate alias.
3. Third-party panggil `GET /api/v1/partner/messages?alias=...` untuk inbox alias tersebut.
4. Third-party panggil `GET /api/v1/partner/otp?alias=...&waitSeconds=20` untuk ambil OTP terbaru.

Catatan:
- API key hanya ditampilkan sekali saat dibuat/rotate.
- Isolasi alias per API key: key lain tidak bisa membaca alias yang bukan miliknya.
- Scope API key tersedia: `alias:create`, `messages:read`, `otp:read`.

## Deploy ke Vercel
1. Set semua ENV di Vercel (Production).
2. Pastikan `GOOGLE_REDIRECT_URI` sudah pakai domain produksi.
3. Deploy.

## Catatan Keamanan
- Jangan taruh `SUPABASE_SERVICE_ROLE_KEY` di client.
- Isi `ADMIN_EMAILS` agar hanya email tertentu yang boleh akses admin.
- Rotasi secret jika pernah terpublikasi.
- Gunakan `TOKEN_ENCRYPTION_KEY` agar token Gmail tersimpan terenkripsi.

## Struktur Ringkas
```text
app/
  page.jsx          (UI publik PBS Mail)
  admin/page.jsx    (Dashboard admin, protected Supabase session)
  admin/login/      (Halaman login admin email/password)
  api/...           (API routes Next.js)
lib/server/...      (Runtime, Gmail, validation, logging)
lib/supabaseClient.js
supabase/           (SQL schema & migrations)
.env.local
```

## Troubleshooting Singkat
- 401 / admin API: pastikan login admin sukses dan email ada di `ADMIN_EMAILS`.
- OAuth error `redirect_uri_mismatch`: samakan `GOOGLE_REDIRECT_URI` dengan Google Console.
- Tidak bisa login admin: user belum dibuat/confirm di Supabase Auth.
- Email tidak masuk: cek MX, SPF, dan route di Cloudflare Email Routing.
