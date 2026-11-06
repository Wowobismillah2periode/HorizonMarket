// Data publik buat website utama. Nama admin pengunggah ("oleh") sengaja dibuang.
const L = require('./_lib');
const bersih = ({ oleh, ...sisa }) => sisa;
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const [akun, testi, status, lama] = await Promise.all([
    L.getJSON('akun', []), L.getJSON('testi', []), L.getJSON('status', {}), L.getJSON('lama', {})]);
  res.json({ akun: akun.map(bersih), testi: testi.map(bersih), status, lama });
};
