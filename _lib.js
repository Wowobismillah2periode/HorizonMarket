// Fungsi bantu: Redis (Upstash), hash password, token sesi. Nggak butuh library tambahan.
const crypto = require('crypto');

// Cari URL & token Redis REST di Environment Variables.
// Nama variabelnya bisa kena prefix dari integrasi Vercel (contoh: UPSTASH_REDIS_REST_KV_REST_API_URL),
// jadi dicari berdasarkan akhiran nama. URL WAJIB diawali https:// (variabel rediss:// sengaja diabaikan).
function cari(akhiran, valid) {
  for (const [k, v] of Object.entries(process.env)) if (akhiran.test(k) && valid(String(v || ''))) return String(v).trim();
}
const konfig = () => ({
  url: cari(/(^|_)(KV_REST_API_URL|REDIS_REST_URL)$/, v => /^https:\/\//.test(v.trim())),
  tok: cari(/(^|_)(KV_REST_API_TOKEN|REDIS_REST_TOKEN)$/, v => v.trim().length > 10),
});

async function redis(...cmd) {
  const { url, tok } = konfig();
  if (!url || !tok) throw new Error('Env Redis REST tidak ditemukan: butuh URL berawalan https:// dan token REST');
  let r;
  try { r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + tok }, body: JSON.stringify(cmd) }); }
  catch { throw new Error('Gagal terhubung ke Redis'); }       // pesan sengaja polos: jangan pernah menyertakan URL/token
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis menolak permintaan (HTTP ' + r.status + ')');
  return j.result;
}
async function getJSON(key, fallback) {
  const v = await redis('GET', key);
  return v ? JSON.parse(v) : fallback;
}
const setJSON = (key, val) => redis('SET', key, JSON.stringify(val));

// bandingin teks dengan waktu konstan (anti timing attack)
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const eq = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

// format tersimpan: "salt_hex:hash_hex" (scrypt). Bikinnya pakai tools/buat-hash.js
function verifyHash(plain, stored) {
  const [s, h] = String(stored || '').split(':');
  if (!s || !h) { crypto.scryptSync(String(plain), 'x', 64); return false; }
  const d = crypto.scryptSync(String(plain), Buffer.from(s, 'hex'), 64);
  return crypto.timingSafeEqual(d, Buffer.from(h, 'hex'));
}

// token sesi bertanda tangan HMAC, disimpan di cookie HttpOnly
const mac = body => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + mac(body);
}
async function session(req) {
  const m = /(?:^|; )adm=([^;]+)/.exec(req.headers.cookie || '');
  if (!m || !process.env.SESSION_SECRET) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig || !eq(sig, mac(body))) return null;
  let p;
  try { p = JSON.parse(Buffer.from(body, 'base64url')); } catch { return null; }
  if (!p.sid || !(p.exp > Date.now())) return null;
  const u = await redis('GET', 'sess:' + p.sid);                  // sesi harus masih terdaftar di server
  if (!u || !admins().some(a => a.username === u)) return null;   // dan admin-nya masih ada di daftar (dicabut = sesi ikut mati)
  if (await redis('GET', 'blok:' + u)) return null;               // di-kick pemilik = sesi langsung mati
  return { ...p, u };
}
// Daftar admin: admin utama (ADMIN_USERNAME, dst) + admin tambahan (ADMIN_TAMBAHAN = JSON array).
// Format satu admin tambahan: {"username":"..","email":"..","passwordHash":"..","codeHash":".."}
function admins() {
  const out = [];
  if (process.env.ADMIN_USERNAME) out.push({ username: process.env.ADMIN_USERNAME, email: process.env.ADMIN_EMAIL,
    passwordHash: process.env.ADMIN_PASSWORD_HASH, codeHash: process.env.ADMIN_CODE_HASH });
  try { const x = JSON.parse(process.env.ADMIN_TAMBAHAN || '[]'); if (Array.isArray(x)) out.push(...x.filter(a => a && a.username)); } catch {}
  return out;
}
const cookie = (v, age) => `adm=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;

module.exports = { redis, getJSON, setJSON, eq, verifyHash, sign, session, cookie, admins };
