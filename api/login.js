// Login admin: username + email + password + kode unik. Semua harus benar.
const crypto = require('crypto');
const L = require('./_lib');

// hitung percobaan + pasang batas waktu dalam SATU perintah atomik (nggak bisa nyangkut tanpa expire)
const HITUNG = "local n=redis.call('INCR',KEYS[1]) if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end return n";

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  // IP asli dari header yang diisi Vercel (nggak bisa dipalsuin pengunjung)
  const h = req.headers;
  const ip = String(h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || 'x').split(',')[0].trim();
  const k = 'rl:' + ip;
  const n = Number(await L.redis('EVAL', HITUNG, '1', k, '900'));
  if (n > 5) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' });

  const b = req.body || {};
  const str = x => (typeof x === 'string' ? x.slice(0, 200) : '');
  // cari admin berdasarkan username. Kalau nggak ada, tetap jalanin verifikasi hash palsu biar waktunya sama
  const adm = L.admins().find(x => L.eq(x.username, str(b.username)));
  const t = adm || { email: '', passwordHash: '', codeHash: '' };
  const ok = [
    !!adm,
    L.eq(str(b.email).toLowerCase(), String(t.email || '').toLowerCase()),
    L.verifyHash(str(b.password), t.passwordHash),
    L.verifyHash(str(b.kode), t.codeHash),
  ].every(Boolean);

  await new Promise(r => setTimeout(r, 400));
  if (!ok) return res.status(401).json({ error: 'Data login salah.' });

  // data login benar tapi akun lagi di-kick -> kasih tahu (aman: cuma yang datanya benar yang lihat pesan ini)
  if (await L.redis('GET', 'blok:' + adm.username)) return res.status(403).json({ error: 'Akun ini dinonaktifkan oleh pemilik web.' });
  await L.redis('DEL', k);
  const sid = crypto.randomBytes(16).toString('hex');
  await L.redis('SET', 'sess:' + sid, adm.username, 'EX', '7200');         // sesi tersimpan di server, hangus otomatis 2 jam
  res.setHeader('Set-Cookie', L.cookie(L.sign({ sid, exp: Date.now() + 2 * 3600e3 }), 7200));
  res.json({ ok: true });
};
