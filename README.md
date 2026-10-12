# Backend – Field Report Management

REST API untuk aplikasi laporan lapangan: Express + TypeScript + PostgreSQL.

## Prasyarat

- Node.js 20+
- Database PostgreSQL (lokal atau Neon)

## Setup

```bash
cd backend
npm install
cp .env.example .env   # lalu isi DATABASE_URL dan JWT_SECRET
npm run db:init         # jalankan schema.sql
npm run db:seed         # isi akun demo + laporan contoh
npm run dev             # jalan di http://localhost:4000
```

| Perintah         | Kegunaan                                      |
|------------------|-----------------------------------------------|
| `npm run dev`    | Jalankan server mode watch (tsx)              |
| `npm run build`  | Kompilasi TypeScript ke `dist/`               |
| `npm start`      | Jalankan hasil build (`node dist/server.js`)  |
| `npm run db:init`| Eksekusi `schema.sql` ke database             |
| `npm run db:seed`| Reset + isi ulang data demo (idempoten)       |

Smoke test end-to-end (butuh server menyala):

```bash
./scripts/smoke-test.sh http://localhost:4000
```

## Deploy ke Vercel (backend)

Repo/backend ini siap deploy sebagai Vercel Project terpisah:

- **Root Directory** project diisi `backend` (atau deploy dari repo backend tersendiri).
- File `api/index.ts` adalah entry serverless (me-export `app` Express tanpa
  `app.listen`), dan `vercel.json` meneruskan semua `/api/*` ke sana.
- File `.env` tidak ikut deploy — isi env lewat
  **Settings → Environment Variables** (minimal untuk **Production**):

| Key | Nilai production |
|---|---|
| `DATABASE_URL` | Connection string **pooled** dari Neon (host ber `-pooler`, `?sslmode=require`) |
| `JWT_SECRET` | String acak baru min 16 karakter (jangan pakai secret lokal) |
| `JWT_EXPIRES_IN` | `1d` |
| `CORS_ORIGIN` | URL frontend production, mis. `https://field-report-app.vercel.app` |
| `NODE_ENV` | `production` |

`PORT` tidak perlu diisi (diatur Vercel). Setiap selesai tambah/ubah env,
lakukan **Redeploy** agar berlaku (env hanya dipakai deployment baru).

## Akun Demo (dari seed)

| Role     | Email                | Password    |
|----------|----------------------|-------------|
| Admin    | admin@demo.com       | Admin123!   |
| Pelapor  | pelapor1@demo.com    | Pelapor123! |
| Pelapor  | pelapor2@demo.com    | Pelapor123! |
| Approver | approver@demo.com    | Approver123!|

## Ringkasan Endpoint

Base URL `/api`. Auth lewat header `Authorization: Bearer <token>`.
Format error: `{ "message": "...", "errors"?: [...] }`.

| Method | Path                  | Akses             | Deskripsi                              |
|--------|-----------------------|-------------------|----------------------------------------|
| GET    | /health               | Publik            | Cek server `{ status: "ok" }`          |
| POST   | /auth/login           | Publik            | Body `{email, password}` → `{token, user}` |
| GET    | /auth/me              | Login             | Data user saat ini                     |
| GET    | /users                | Admin             | Daftar user                            |
| POST   | /users                | Admin             | Buat user (201)                        |
| PATCH  | /users/:id            | Admin             | Ubah `name, role, isActive, password`  |
| POST   | /reports              | Pelapor           | Buat laporan (201, status `pending`)   |
| GET    | /reports              | Semua role login  | Daftar + `meta` (`status, page, limit` sebagai query) |
| GET    | /reports/:id          | Sesuai akses      | Detail + riwayat approval              |
| PUT    | /reports/:id          | Pelapor (pemilik) | Edit jika masih `pending`              |
| PATCH  | /reports/:id/status   | Approver          | Body `{status: "approved"\|"rejected", note?}` |

## Asumsi Role & Aturan

- Tidak ada registrasi mandiri; akun hanya dibuat admin.
- Pelapor otomatis difilter hanya melihat laporan miliknya; akses milik orang lain → 404 (bukan 403).
- Edit laporan hanya jika status `pending`, selain itu → 409.
- Approver boleh membalik keputusan (`approved` ↔ `rejected`) dari status apa pun, selalu dalam satu transaksi (update status + insert riwayat). Status sama dengan saat ini → 409. Tidak ada jalan kembali ke `pending`.
- Admin tidak boleh menonaktifkan dirinya sendiri atau mengubah role-nya sendiri (→ 409).
- User nonaktif tidak bisa login (→ 403) dan token lamanya ditolak (→ 401).
- Password di-hash (bcrypt), JWT secret dari env, CORS dibatasi `CORS_ORIGIN`, semua query SQL terparameter.
