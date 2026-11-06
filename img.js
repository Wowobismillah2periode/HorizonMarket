// Kirim foto yang disimpan di Redis. /api/img?id=xxx  (tambah &k=1 buat versi kecil)
const L = require('./_lib');
module.exports = async (req, res) => {
  const id = String(req.query.id || '');
  if (!/^[a-f0-9-]{36}$/.test(id)) return res.status(404).end();
  const f = await L.getJSON('img:' + id, null);
  if (!f) return res.status(404).end();
  res.setHeader('Content-Type', 'image/webp');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(req.query.k ? f.kecil : f.full, 'base64'));
};
