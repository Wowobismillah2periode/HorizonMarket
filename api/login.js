// Login admin: username + email + password + kode unik. Semua harus benar.
const L = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  // batasi percobaan: maksimal 5x per 15 menit per IP
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const k = 'rl:' + ip;
  const n = await L.redis('INCR', k);
  if (n === 1) await L.redis('EXPIRE', k, 900);
  if (n > 5) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.' });

  const b = req.body || {};
  const str = x => (typeof x === 'string' ? x.slice(0, 200) : '');
  // semua dicek (nggak berhenti di yang pertama salah) biar waktu responsnya sama
  const ok = [
    L.eq(str(b.username), process.env.ADMIN_USERNAME || ''),
    L.eq(str(b.email).toLowerCase(), String(process.env.ADMIN_EMAIL || '').toLowerCase()),
    L.verifyHash(str(b.password), process.env.ADMIN_PASSWORD_HASH),
    L.verifyHash(str(b.kode), process.env.ADMIN_CODE_HASH),
  ].every(Boolean);

  await new Promise(r => setTimeout(r, 400));
  if (!ok) return res.status(401).json({ error: 'Data login salah.' });   // pesan sengaja umum

  await L.redis('DEL', k);
  res.setHeader('Set-Cookie', L.cookie(L.sign({ exp: Date.now() + 2 * 3600e3 }), 7200));
  res.json({ ok: true });
};
