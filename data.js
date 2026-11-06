// Data publik buat website utama (stok + testimoni + status & perubahan akun lama)
const L = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const [akun, testi, status, lama] = await Promise.all([
    L.getJSON('akun', []), L.getJSON('testi', []), L.getJSON('status', {}), L.getJSON('lama', {})]);
  res.json({ akun, testi, status, lama });
};
