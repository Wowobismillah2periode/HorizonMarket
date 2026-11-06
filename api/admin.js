// Semua aksi admin. Wajib login (cookie sesi + sesi masih terdaftar di server) + header X-Req (anti CSRF).
const crypto = require('crypto');
const L = require('./_lib');

const STATUS = ['ready', 'booking', 'sold'];
const txt = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const angka = x => String(x || '').replace(/\D/g, '').slice(0, 12);
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
  if (req.method === 'GET') return res.json({ ok: true });
  if (req.method !== 'POST' || req.headers['x-req'] !== '1') return res.status(403).end();

  const b = req.body || {};
  if (b.aksi === 'keluar') {
    await L.redis('DEL', 'sess:' + ses.sid);                      // sesi dimatikan di server, token curian ikut mati
    res.setHeader('Set-Cookie', L.cookie('', 0));
    return res.json({ ok: true });
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
    return res.json({ ok: true });
  }

  // ubah judul / deskripsi / harga kartu yang sudah tayang (akun baru maupun akun lama)
  if (b.aksi === 'edit') {
    const judul = txt(b.judul, 60), harga = angka(b.harga), detail = rapi(b.detail);
    if (!judul || !harga || !detail.length) return res.status(400).json({ error: 'Judul, deskripsi, dan harga wajib diisi.' });
    const akun = await L.getJSON('akun', []);
    const a = akun.find(x => x.id === b.id);
    if (a) { Object.assign(a, { judul, detail, harga }); await L.setJSON('akun', akun); }
    else {
      const kode = txt(b.id, 60);
      if (!kode) return res.status(400).json({ error: 'Kode kosong.' });
      const lama = await L.getJSON('lama', {});
      lama[kode] = { ...(lama[kode] || {}), judul, detail, harga };
      await L.setJSON('lama', lama);
    }
    return res.json({ ok: true });
  }

  if (b.aksi === 'tambahAkun' || b.aksi === 'tambahTesti') {
    const full = webp(b.foto, 900000), kecil = webp(b.kecil, 300000);
    if (!full || !kecil) return res.status(400).json({ error: 'Foto harus berupa file WebP yang valid dan ukurannya wajar.' });
    if (b.aksi === 'tambahAkun') {
      const detail = rapi(b.detail), judul = txt(b.judul, 60), harga = angka(b.harga);
      if (!judul || !harga) return res.status(400).json({ error: 'Judul dan harga wajib diisi.' });
      const id = crypto.randomUUID();
      await L.setJSON('img:' + id, { full, kecil });
      const akun = await L.getJSON('akun', []);
      akun.push({ id, judul, detail, harga, status: 'ready', foto: id });
      await L.setJSON('akun', akun);
      return res.json({ ok: true, id });
    }
    const id = crypto.randomUUID();
    await L.setJSON('img:' + id, { full, kecil });
    const testi = await L.getJSON('testi', []);
    testi.push({ id, foto: id, barang: txt(b.barang, 120), harga: txt(b.harga, 60), sistem: txt(b.sistem, 120) });
    await L.setJSON('testi', testi);
    return res.json({ ok: true, id });
  }

  if (b.aksi === 'hapus') {
    const id = txt(b.id, 60);
    if (b.tipe === 'testi') {
      const t = await L.getJSON('testi', []);
      await L.setJSON('testi', t.filter(x => x.id !== id));
      await L.redis('DEL', 'img:' + id);
      return res.json({ ok: true });
    }
    const akun = await L.getJSON('akun', []);
    if (akun.some(x => x.id === id)) {                            // akun baru: dihapus beserta fotonya
      await L.setJSON('akun', akun.filter(x => x.id !== id));
      await L.redis('DEL', 'img:' + id);
    } else {                                                      // akun lama: ditandai "hapus" (file HTML tetap, tapi disembunyikan)
      if (!id) return res.status(400).json({ error: 'Kode kosong.' });
      const lama = await L.getJSON('lama', {});
      lama[id] = { ...(lama[id] || {}), hapus: true };
      await L.setJSON('lama', lama);
    }
    return res.json({ ok: true });
  }
  res.status(400).json({ error: 'Aksi tidak dikenal.' });
};
