// Jalankan di komputer lu (bukan di server):  node tools/buat-hash.js
// Hasilnya ditempel ke Environment Variables di Vercel. Password asli JANGAN disimpan di file.
const crypto = require('crypto');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const tanya = q => new Promise(r => rl.question(q, r));
const hash = t => { const s = crypto.randomBytes(16); return s.toString('hex') + ':' + crypto.scryptSync(t, s, 64).toString('hex'); };
(async () => {
  const pw = await tanya('Password admin (minimal 12 karakter): ');
  const kode = await tanya('Kode unik: ');
  rl.close();
  if (pw.length < 12) return console.log('Password kependekan, minimal 12 karakter.');
  console.log('\nTempel ke Vercel > Settings > Environment Variables:\n');
  console.log('ADMIN_USERNAME=<username lu>');
  console.log('ADMIN_EMAIL=<gmail lu>');
  console.log('ADMIN_PASSWORD_HASH=' + hash(pw));
  console.log('ADMIN_CODE_HASH=' + hash(kode));
  console.log('SESSION_SECRET=' + crypto.randomBytes(48).toString('base64url'));
})();
