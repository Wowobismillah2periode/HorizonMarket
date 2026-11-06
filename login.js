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
  const ok = [
    L.eq(str(b.username), process.env.ADMIN_USERNAME || ''),
    L.eq(str(b.email).toLowerCase(), String(process.env.ADMIN_EMAIL || '').toLowerCase()),
    L.verifyHash(str(b.password), process.env.ADMIN_PASSWORD_HASH),
    L.verifyHash(str(b.kode), process.env.ADMIN_CODE_HASH),
  ].every(Boolean);

  await new Promise(r => setTimeout(r, 400));
  if (!ok) return res.status(401).json({ error: 'Data login salah.' });

  await L.redis('DEL', k);
  const sid = crypto.randomBytes(16).toString('hex');
  await L.redis('SET', 'sess:' + sid, '1', 'EX', '7200');         // sesi tersimpan di server, hangus otomatis 2 jam
  res.setHeader('Set-Cookie', L.cookie(L.sign({ sid, exp: Date.now() + 2 * 3600e3 }), 7200));
  res.json({ ok: true });
};
