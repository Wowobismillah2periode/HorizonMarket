// Fungsi bantu: Redis (Upstash), hash password, token sesi. Nggak butuh library tambahan.
const crypto = require('crypto');

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK  = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

async function redis(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
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
function session(req) {
  const m = /(?:^|; )adm=([^;]+)/.exec(req.headers.cookie || '');
  if (!m || !process.env.SESSION_SECRET) return null;
  const [body, sig] = m[1].split('.');
  if (!body || !sig || !eq(sig, mac(body))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url')); return p.exp > Date.now() ? p : null; }
  catch { return null; }
}
const cookie = (v, age) => `adm=${v}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;

module.exports = { redis, getJSON, setJSON, eq, verifyHash, sign, session, cookie };
