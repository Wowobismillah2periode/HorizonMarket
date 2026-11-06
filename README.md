# Horizon Market - Panduan Setup & Admin Panel

> **Untuk AI asisten (ChatGPT, dll.) yang membaca file ini:** Pengguna adalah pemula. Baca semua file project dulu, lalu pandu pengguna **langkah demi langkah, satu tahap per balasan**. Jangan ubah desain/struktur website kalau tidak perlu. **Jangan minta pengguna menulis password, kode unik, SESSION_SECRET, atau token Upstash di chat**; nilai rahasia ditempel sendiri langsung di dashboard Vercel. Kalau tampilan Vercel/Upstash berbeda dari yang kamu kira (UI sering berubah), minta screenshot. Kalau ada error, minta teks error atau screenshot dari Vercel > Deployments > Functions/Logs. **Mulai dari Langkah 1 dan tanya dulu: project Vercel sekarang dideploy lewat apa (GitHub / Vercel CLI / upload manual)?**

## 1. Konteks project

- Website jual-beli akun Roblox "Horizon Market", online di `horizonmarket.vercel.app` (hosting Vercel).
- Halaman: `index.html` (beranda), `stok_akun.html` (stok), `testimoni.html` (testimoni), `admin.html` (panel admin, BARU).
- CSS: `style.css`, `halaman.css`, `stok_akun.css`. Script: `dinamis.js` (menarik data dari API lalu memasangnya ke halaman publik).
- Backend (BARU) = Vercel Serverless Functions di folder `api/`:
  - `api/_lib.js`: helper (koneksi Redis, hash password scrypt, token sesi HMAC)
  - `api/login.js`: login admin (username + gmail + password + kode unik)
  - `api/data.js`: data publik (stok, testimoni, status akun) untuk website
  - `api/img.js`: menyajikan foto yang disimpan di Redis
  - `api/admin.js`: semua aksi admin (ubah status, tambah akun, tambah testimoni, hapus, logout)
- `tools/buat-hash.js`: script lokal untuk membuat hash password & kode unik.
- `vercel.json`: security headers. `package.json`: minimal Node 20.
- Tanpa library tambahan (tidak perlu `npm install`). Data & foto disimpan di **Upstash Redis** (foto disimpan sebagai base64 WebP).

## 2. Yang harus disiapkan

1. Akun Vercel yang sudah punya project horizonmarket.
2. Node.js versi LTS di laptop (nodejs.org), hanya untuk menjalankan `tools/buat-hash.js`.
3. Keputusan sendiri:
   - **Username** admin (bebas)
   - **Gmail** (hanya syarat login, tidak ada email yang dikirim)
   - **Password** (minimal 12 karakter, acak)
   - **Kode unik** (beda dari password)

## 3. Langkah setup

### Langkah 1 - Upload project baru ke Vercel
Isi folder `PROJECT WEBSITE JB` harus berada di **root** project (`index.html`, `api/`, `vercel.json`, `package.json` sejajar).
- Kalau lewat **GitHub**: ganti isi repo dengan isi folder ini lalu push.
- Kalau lewat **Vercel CLI**: di dalam folder ini jalankan `vercel` lalu `vercel --prod`.
- Kalau repo punya subfolder: set **Root Directory** di Vercel > Settings > General.

Pastikan folder `api/` terdeteksi sebagai Functions (Vercel > Deployments > deployment terbaru > tab Functions).

### Langkah 2 - Pasang database Upstash Redis
Vercel > project > tab **Storage** (atau Marketplace) > Upstash > Redis > buat database (gratis) > Connect ke project ini.
Ini otomatis menambah Environment Variables koneksi (`KV_REST_API_URL` + `KV_REST_API_TOKEN`, atau `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Kode mendukung dua-duanya. Pastikan ter-apply ke environment **Production**.

### Langkah 3 - Bikin hash password & kode unik (di laptop)
Buka terminal/CMD di folder project, jalankan:

```
node tools/buat-hash.js
```

Dia menanyakan password (min 12 karakter) lalu kode unik, lalu mencetak 5 baris:

```
ADMIN_USERNAME=<username lu>
ADMIN_EMAIL=<gmail lu>
ADMIN_PASSWORD_HASH=xxxxxxxx:yyyyyyyy...
ADMIN_CODE_HASH=xxxxxxxx:yyyyyyyy...
SESSION_SECRET=zzzzzzzz...
```

- `<username lu>` dan `<gmail lu>` hanya placeholder: **isi sendiri dengan data asli**.
- Password yang diketik terlihat di layar, pastikan tidak ada yang melihat.
- Hash berformat `salt:hash` (ada titik dua). Tempel utuh, tanpa tanda kutip dan tanpa spasi di awal/akhir.

### Langkah 4 - Isi Environment Variables di Vercel
Vercel > project > Settings > Environment Variables. Tambahkan 5 variabel (Name = sebelum `=`, Value = sesudahnya): `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_CODE_HASH`, `SESSION_SECRET`. Centang environment **Production**.

### Langkah 5 - Redeploy (WAJIB)
Variabel baru hanya aktif setelah deploy ulang: Vercel > Deployments > deployment terbaru > titik tiga > **Redeploy**.

### Langkah 6 - Verifikasi
1. Buka `https://horizonmarket.vercel.app/api/data` -> harus muncul `{"akun":[],"testi":[],"status":{}}`.
   - Error 500: variabel Upstash belum nyambung. Error 404: folder `api/` tidak ter-deploy atau Root Directory salah.
2. Buka `https://horizonmarket.vercel.app/admin.html` -> harus muncul form login.
3. Login dengan 4 data: username, gmail, password, kode unik.

## 4. Cara pakai admin panel

Buka `/admin.html` dan login. Ada 3 tab:

### Tab "Stok & Status"
- Menampilkan semua akun: 9 akun lama (BSAE 01-09, ditulis manual di `stok_akun.html`) + akun baru dari panel.
- Tiap akun punya tombol **Ready / Booking / Sold**. Klik = status di website langsung berubah (badge READY/BOOKING/SOLD; kalau Sold kartu jadi abu-abu dan tombol WA berubah jadi "Tanya Restok").
- Tombol filter (Semua/Ready/Booking/Sold) di panel hanya untuk memudahkan melihat daftar di panel.
- Akun baru punya tombol **Hapus**. Akun lama hanya bisa diubah statusnya (hapus harus edit `stok_akun.html`).
- Status akun lama disimpan berdasarkan kode di kartu (nilai pertama di bagian detail, misal `[BSAE 01]`). Jangan ubah kode itu di HTML kalau mau statusnya tetap nyambung.

### Tab "Tambah Stok Akun"
1. Pilih foto spek akun (rasio 7:10). Foto dikompres otomatis di browser jadi WebP (versi besar untuk klik-lihat-penuh, versi kecil untuk kartu).
2. Isi **Judul** (contoh: Bacon BSAE).
3. **Deskripsi**: ada 4 baris awal (Kode Akun, Robux, Gamepass, Data). Isi kolom kanan; kolom kiri (nama) boleh diubah. Klik **+ Tambah deskripsi** untuk baris baru. Baris yang salah satu kolomnya kosong diabaikan.
4. Isi **Harga**, angka saja (contoh `45000` tampil "Rp 45.000").
5. Klik **Upload ke website**. Pesan hijau "Berhasil!" = akun langsung tampil di `stok_akun.html` (paling belakang), status awal Ready.
6. Tombol WhatsApp kartu baru otomatis berisi "Bang, beli akun kode : <kode> (Rp<harga>)". Kode diambil dari baris deskripsi yang namanya mengandung kata "kode" (kalau tidak ada, pakai judul).

### Tab "Testimoni"
1. Pilih foto testimoni (rasio 7:10).
2. Isi 3 kolom **Barang, Harga, Sistem**. Di website tampil sebagai:
   - 📂Barang : ...
   - 💸Harga : ...
   - 👥Sistem : ...
3. Klik **Upload ke website**. Kartu tanpa harga & tombol WA; pojok kiri atas berisi penghitung "Testi 1", "Testi 2", dst.
4. Susunan di `testimoni.html` (2 kolom, zig-zag): baris 1 kanan→kiri (Testi 1 kanan, Testi 2 kiri), baris 2 kiri→kanan (Testi 3 kiri, Testi 4 kanan), dan seterusnya.
5. Di bawah form ada daftar testimoni dengan tombol **Hapus**. Setelah dihapus, nomor otomatis menyesuaikan.

Tombol **Keluar** (kanan atas) = logout.

## 5. Fitur keamanan

- Login butuh 4 data sekaligus; pesan error sengaja umum ("Data login salah").
- Password & kode disimpan sebagai hash scrypt di Environment Variables (bukan di kode, bukan di database).
- Maksimal 5 percobaan login per IP per 15 menit (lalu diblokir 15 menit).
- Sesi: cookie HttpOnly + Secure + SameSite=Strict, berlaku 2 jam, ditandatangani HMAC dengan `SESSION_SECRET`.
- Semua aksi admin dicek di server (wajib cookie sesi + header `X-Req`).
- Teks dari admin dipasang dengan `textContent` (aman dari XSS). Foto divalidasi (harus WebP, ukuran wajar).
- Jangan bagikan password/kode/SESSION_SECRET/token Upstash. Untuk memaksa semua sesi logout: ganti `SESSION_SECRET` lalu Redeploy.

## 6. Troubleshooting

| Masalah | Penyebab / solusi |
|---|---|
| `/api/data` atau `/api/login` 404 | Folder `api/` tidak ter-deploy atau Root Directory salah (`index.html` harus sejajar dengan `api/`). |
| Error 500 | Variabel Upstash belum ada atau belum Redeploy. Cek Vercel > Deployments > Functions/Logs. |
| Login selalu "Data login salah" | Cek username persis sama (huruf besar/kecil), gmail sama, password & kode sama dengan saat menjalankan `buat-hash.js`, hash ditempel utuh tanpa kutip/spasi. Setelah ubah env wajib Redeploy. |
| "Terlalu banyak percobaan" | Tunggu 15 menit, atau hapus key `rl:<ip>` di Upstash > Data Browser. |
| Upload gagal "Foto harus WebP..." | Pakai Chrome/Edge. Safari lama tidak bisa konversi ke WebP. Foto super besar bisa ditolak, coba yang lebih kecil. |
| Perubahan tidak terlihat | Refresh (Ctrl+F5). Data diambil langsung tanpa cache. |
| `admin.html` dibuka dari file di laptop | Tidak akan jalan; API hanya ada di Vercel. Untuk tes lokal pakai `vercel dev` (butuh Vercel CLI, env di-pull dengan `vercel env pull`). |

## 7. Catatan jujur / keterbatasan

- Alur sudah dites otomatis di browser dengan server & Redis **tiruan** (login, tambah akun, ubah status, tambah testimoni, urutan zig-zag, batas percobaan, logout). **Belum dites dengan Upstash Redis asli di Vercel**, jadi kalau ada error koneksi, itu kandidat pertama yang dicek.
- Belum ada: edit akun yang sudah ada (selain status), ubah urutan kartu, hapus 9 akun lama dari panel.
- Foto disimpan di Redis (base64). Paket gratis Upstash punya batas kapasitas; pantau di dashboard. Kalau stok makin banyak, pertimbangkan pindah foto ke Vercel Blob.
