// Semua aksi admin. Wajib login (cookie sesi) + header X-Req (anti CSRF).
const crypto = require('crypto');
const L = require('./_lib');

const STATUS = ['ready', 'booking', 'sold'];
const txt = (x, max) => (typeof x === 'string' ? x.trim().slice(0, max) : '');
const webp = (x, max) => typeof x === 'string' && x.startsWith('data:image/webp;base64,') && x.length < max
  ? x.slice('data:image/webp;base64,'.length) : null;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const ses = L.session(req);
  if (!ses) return res.status(401).json({ error: 'Belum login.' });
  if (req.method === 'GET') return res.json({ ok: true });
  if (req.method !== 'POST' || req.headers['x-req'] !== '1') return res.status(403).end();

  const b = req.body || {};
  if (b.aksi === 'keluar') {
    res.setHeader('Set-Cookie', L.cookie('', 0));
    return res.json({ ok: true });
  }

  if (b.aksi === 'status') {
    if (!STATUS.includes(b.status)) return res.status(400).json({ error: 'Status salah.' });
    const akun = await L.getJSON('akun', []);
    const a = akun.find(x => x.id === b.id);
    if (a) { a.status = b.status; await L.setJSON('akun', akun); }
    else {   // akun lama (yang ditulis manual di HTML), disimpan berdasarkan kode
      const kode = txt(b.id, 60);
      if (!kode) return res.status(400).json({ error: 'Kode kosong.' });
      const st = await L.getJSON('status', {});
      st[kode] = b.status; await L.setJSON('status', st);
    }
    return res.json({ ok: true });
  }

  if (b.aksi === 'tambahAkun' || b.aksi === 'tambahTesti') {
    const full = webp(b.foto, 900000), kecil = webp(b.kecil, 300000);
    if (!full || !kecil) return res.status(400).json({ error: 'Foto harus WebP dan ukurannya wajar.' });
    const id = crypto.randomUUID();
    await L.setJSON('img:' + id, { full, kecil });
    if (b.aksi === 'tambahAkun') {
      const detail = (Array.isArray(b.detail) ? b.detail : []).slice(0, 12)
        .map(d => ({ k: txt(d.k, 40), v: txt(d.v, 80) })).filter(d => d.k && d.v);
      const judul = txt(b.judul, 60), harga = String(b.harga || '').replace(/\D/g, '').slice(0, 12);
      if (!judul || !harga) return res.status(400).json({ error: 'Judul dan harga wajib diisi.' });
      const akun = await L.getJSON('akun', []);
      akun.push({ id, judul, detail, harga, status: 'ready', foto: id });
      await L.setJSON('akun', akun);
    } else {
      const t = { id, foto: id, barang: txt(b.barang, 120), harga: txt(b.harga, 60), sistem: txt(b.sistem, 120) };
      const testi = await L.getJSON('testi', []);
      testi.push(t); await L.setJSON('testi', testi);
    }
    return res.json({ ok: true, id });
  }

  if (b.aksi === 'hapus') {
    const key = b.tipe === 'testi' ? 'testi' : 'akun';
    const list = (await L.getJSON(key, [])).filter(x => x.id !== b.id);
    await L.setJSON(key, list);
    await L.redis('DEL', 'img:' + txt(b.id, 40));
    return res.json({ ok: true });
  }
  res.status(400).json({ error: 'Aksi tidak dikenal.' });
};
