// Semua aksi admin. Wajib login (cookie sesi + sesi masih terdaftar di server) + header X-Req (anti CSRF).
const crypto = require('crypto');
const L = require('./_lib');

const STATUS = ['ready', 'booking', 'sold'];
const txt = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const angka = x => String(x || '').replace(/\D/g, '').slice(0, 12);
const VERSI = 'v7';                                              // dicocokkan dengan versi admin.html (buat deteksi file yang belum ter-update)
const WA_DEFAULT = '6285863549795';                              // nomor bawaan akun lama
// terima "+62 812-3456-7890" / "0812..." / "812..." -> "628123456789"; salah format -> ''
function normWA(x) {
  let d = String(x || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d;
  return /^62\d{8,13}$/.test(d) ? d : '';
}
const rapi = d => (Array.isArray(d) ? d : []).slice(0, 12)
  .map(r => ({ k: txt(r && r.k, 40), v: txt(r && r.v, 80) })).filter(r => r.k && r.v);

// foto harus data-URL WebP, ukuran wajar, DAN isi file-nya beneran WebP (header RIFF....WEBP)
function webp(x, max) {
  const pre = 'data:image/webp;base64,';
  if (typeof x !== 'string' || !x.startsWith(pre) || x.length > max) return null;
  const b64 = x.slice(pre.length), head = Buffer.from(b64.slice(0, 24), 'base64');
  return head.length >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP' ? b64 : null;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ses = await L.session(req);
  if (!ses) return res.status(401).json({ error: 'Belum login.' });
  const pemilik = ses.u === process.env.ADMIN_USERNAME;            // pemilik = admin utama
  if (req.method === 'GET') {
    if (req.query && req.query.admins) {                           // daftar admin + status (khusus pemilik)
      if (!pemilik) return res.status(403).json({ error: 'Khusus pemilik.' });
      const out = [];
      for (const a of L.admins()) out.push({ username: a.username, email: a.email, pemilik: a.username === process.env.ADMIN_USERNAME,
        blok: !!(await L.redis('GET', 'blok:' + a.username)) });
      return res.json({ admins: out });
    }
    if (req.query && req.query.daftar) {                           // daftar buat panel: lengkap dengan pemilik postingan & boleh-hapus-nggaknya
      const [akun, testi, status, lama] = await Promise.all([L.getJSON('akun', []), L.getJSON('testi', []), L.getJSON('status', {}), L.getJSON('lama', {})]);
      const bisa = i => { const o = (i && i.oleh) || process.env.ADMIN_USERNAME; return o === ses.u || !L.admins().some(a => a.username === o); };
      return res.json({ akun: akun.map(a => ({ ...a, bisaHapus: bisa(a) })), testi: testi.map(t => ({ ...t, bisaHapus: bisa(t) })), status, lama,
        bisaHapusLama: bisa(null), pemilikNama: process.env.ADMIN_USERNAME, waDefault: WA_DEFAULT });
    }
    if (req.query && req.query.log) {                              // riwayat 50 aktivitas terakhir
      const rows = await L.redis('LRANGE', 'log', '0', '49');
      return res.json({ log: (rows || []).map(r => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean) });
    }
    return res.json({ ok: true, user: ses.u, pemilik, versi: VERSI });
  }
  if (req.method !== 'POST' || req.headers['x-req'] !== '1') return res.status(403).end();

  const b = req.body || {};
  // setiap aksi yang berhasil dicatat: siapa, kapan, ngapain (50-100 terakhir)
  const ok = async o => {
    await L.redis('LPUSH', 'log', JSON.stringify({ t: Date.now(), u: ses.u, aksi: b.aksi, id: txt(b.id || b.username, 60), status: b.status }));
    await L.redis('LTRIM', 'log', '0', '99');
    return res.json(o);
  };
  if (b.aksi === 'keluar') {
    await L.redis('DEL', 'sess:' + ses.sid);                      // sesi dimatikan di server, token curian ikut mati
    res.setHeader('Set-Cookie', L.cookie('', 0));
    return ok({ ok: true });
  }

  // kick / pulihkan admin: khusus pemilik, berlaku langsung (nggak perlu Redeploy)
  if (b.aksi === 'kick' || b.aksi === 'pulihkan') {
    if (!pemilik) return res.status(403).json({ error: 'Khusus pemilik.' });
    const u = txt(b.username, 100);
    if (u === ses.u) return res.status(400).json({ error: 'Pemilik tidak bisa di-kick.' });
    if (!L.admins().some(a => a.username === u)) return res.status(400).json({ error: 'Admin tidak ditemukan.' });
    if (b.aksi === 'kick') await L.redis('SET', 'blok:' + u, '1'); else await L.redis('DEL', 'blok:' + u);
    return ok({ ok: true });
  }

  if (b.aksi === 'status') {
    if (!STATUS.includes(b.status)) return res.status(400).json({ error: 'Status salah.' });
    const akun = await L.getJSON('akun', []);
    const a = akun.find(x => x.id === b.id);
    if (a) { a.status = b.status; await L.setJSON('akun', akun); }
    else {   // akun lama (ditulis manual di HTML), disimpan berdasarkan kode
      const kode = txt(b.id, 60);
      if (!kode) return res.status(400).json({ error: 'Kode kosong.' });
      const st = await L.getJSON('status', {});
      st[kode] = b.status; await L.setJSON('status', st);
    }
    return ok({ ok: true });
  }

  // ubah judul / deskripsi / harga kartu yang sudah tayang (akun baru maupun akun lama)
  if (b.aksi === 'edit') {
    const judul = txt(b.judul, 60), harga = angka(b.harga), detail = rapi(b.detail);
    if (!judul || !harga || !detail.length) return res.status(400).json({ error: 'Judul, deskripsi, dan harga wajib diisi.' });
    const wa = b.wa ? normWA(b.wa) : '';
    if (b.wa && !wa) return res.status(400).json({ error: 'Nomor WhatsApp tidak valid (contoh: +62 812-3456-7890).' });
    const akun = await L.getJSON('akun', []);
    const a = akun.find(x => x.id === b.id);
    if (a) { Object.assign(a, { judul, detail, harga, ...(wa ? { wa } : {}) }); await L.setJSON('akun', akun); }
    else {
      const kode = txt(b.id, 60);
      if (!kode) return res.status(400).json({ error: 'Kode kosong.' });
      const lama = await L.getJSON('lama', {});
      lama[kode] = { ...(lama[kode] || {}), judul, detail, harga, ...(wa ? { wa } : {}) };
      await L.setJSON('lama', lama);
    }
    return ok({ ok: true });
  }

  if (b.aksi === 'tambahAkun' || b.aksi === 'tambahTesti') {
    const full = webp(b.foto, 900000), kecil = webp(b.kecil, 300000);
    if (!full || !kecil) return res.status(400).json({ error: 'Foto harus berupa file WebP yang valid dan ukurannya wajar.' });
    if (b.aksi === 'tambahAkun') {
      const detail = rapi(b.detail), judul = txt(b.judul, 60), harga = angka(b.harga);
      if (!judul || !harga) return res.status(400).json({ error: 'Judul dan harga wajib diisi.' });
      const wa = normWA(b.wa);
      if (!wa) return res.status(400).json({ error: 'Nomor WhatsApp wajib diisi dan harus valid (contoh: +62 812-3456-7890).' });
      const id = crypto.randomUUID();
      await L.setJSON('img:' + id, { full, kecil });
      const akun = await L.getJSON('akun', []);
      akun.push({ id, judul, detail, harga, wa, oleh: ses.u, status: 'ready', foto: id });
      await L.setJSON('akun', akun);
      return ok({ ok: true, id });
    }
    const toko = txt(b.toko, 60);
    if (!toko) return res.status(400).json({ error: 'Nama toko wajib diisi.' });
    const id = crypto.randomUUID();
    await L.setJSON('img:' + id, { full, kecil });
    const testi = await L.getJSON('testi', []);
    testi.push({ id, foto: id, toko, oleh: ses.u, barang: txt(b.barang, 120), harga: txt(b.harga, 60), sistem: txt(b.sistem, 120) });
    await L.setJSON('testi', testi);
    return ok({ ok: true, id });
  }

  if (b.aksi === 'hapus') {
    const id = txt(b.id, 60);
    // pemilik postingan = yang mengunggah. Postingan lama tanpa catatan & akun lama (BSAE) = milik admin utama.
    // Kalau pemiliknya sudah nggak ada di daftar admin (dicabut), postingan boleh dihapus siapa saja (biar nggak nyangkut selamanya).
    const boleh = i => { const o = (i && i.oleh) || process.env.ADMIN_USERNAME; return o === ses.u || !L.admins().some(a => a.username === o) ? null : o; };
    const tolak = o => res.status(403).json({ error: 'Postingan ini milik "' + o + '". Kamu nggak bisa menghapusnya.' });
    if (b.tipe === 'testi') {
      const t = await L.getJSON('testi', []);
      const item = t.find(x => x.id === id), o = boleh(item);
      if (item && o) return tolak(o);
      await L.setJSON('testi', t.filter(x => x.id !== id));
      await L.redis('DEL', 'img:' + id);
      return ok({ ok: true });
    }
    const akun = await L.getJSON('akun', []);
    const item = akun.find(x => x.id === id);
    const o = boleh(item);                                         // akun lama (item kosong) = milik admin utama
    if (o) return tolak(o);
    if (item) {                                                    // akun baru: dihapus beserta fotonya
      await L.setJSON('akun', akun.filter(x => x.id !== id));
      await L.redis('DEL', 'img:' + id);
    } else {                                                       // akun lama: ditandai "hapus" (file HTML tetap, tapi disembunyikan)
      if (!id) return res.status(400).json({ error: 'Kode kosong.' });
      const lama = await L.getJSON('lama', {});
      lama[id] = { ...(lama[id] || {}), hapus: true };
      await L.setJSON('lama', lama);
    }
    return ok({ ok: true });
  }
  res.status(400).json({ error: 'Aksi tidak dikenal.' });
};
