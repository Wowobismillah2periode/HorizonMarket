// Ambil data dari /api/data lalu pasang ke halaman (stok akun / testimoni).
// Semua teks dari admin dipasang pakai textContent (aman dari XSS).
(async () => {
  let data;
  try { data = await (await fetch('/api/data', { cache: 'no-store' })).json(); } catch { return; }
  data.lama = data.lama || {};
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const LABEL = { ready: '✓ READY', booking: '⏳ BOOKING', sold: '✕ SOLD' };
  const rupiah = n => 'Rp ' + Number(n).toLocaleString('id-ID');

  function pasangStatus(k, s) {
    k.dataset.status = s;
    k.classList.toggle('terjual', s === 'sold');
    const b = k.querySelector('.status'); b.className = 'status ' + s; b.textContent = LABEL[s];
    const wa = k.querySelector('.wa'); if (wa) wa.lastChild.textContent = s === 'sold' ? 'Tanya Restok' : 'Chat via WhatsApp';
  }
  function foto(id, alt, badge) {
    const b = el('button', 'foto'); b.dataset.full = '/api/img?id=' + id; b.setAttribute('aria-label', 'Lihat foto lengkap ' + alt);
    const i = el('img'); i.src = '/api/img?id=' + id + '&k=1'; i.alt = alt; i.loading = 'lazy';
    b.append(i, badge); return b;
  }
  function isiDetail(ul, detail) {
    ul.replaceChildren();
    detail.forEach(d => { const li = el('li'); li.append(el('span', null, d.k), el('b', null, d.v)); ul.append(li); });
  }
  // Pesan WA otomatis: "Bang, mau beli akun kode [BSAE 08] (Rp.35.000)". Kode diambil dari baris deskripsi
  // yang namanya mengandung "kode" (kalau nggak ada, pakai judul). Nomor tujuan = nomor penjual yang diisi saat upload.
  const WA_DEFAULT = '6285863549795';
  function linkWA(detail, judul, harga, wa) {
    const kode = (detail.find(d => /kode/i.test(d.k)) || { v: judul }).v;
    const pesan = `Bang, mau beli akun kode ${kode} (Rp.${Number(harga).toLocaleString('id-ID')})`;
    return 'https://wa.me/' + (wa || WA_DEFAULT) + '?text=' + encodeURIComponent(pesan);
  }

  // ===== halaman stok akun =====
  const grid = document.getElementById('testi-grid') ? null : document.querySelector('.grid');   // null di halaman testimoni
  if (grid) {
    document.querySelectorAll('.kartu').forEach(k => {          // akun lama (ditulis di HTML)
      const kode = k.querySelector('.detail b')?.textContent;   // kode ASLI dari HTML, dibaca sebelum ada perubahan
      const o = data.lama[kode];
      if (o && o.hapus) return k.remove();                      // dihapus lewat admin
      if (o && o.judul) {                                       // diedit lewat admin
        k.querySelector('.nama').textContent = o.judul;
        isiDetail(k.querySelector('.detail'), o.detail);
        k.querySelector('.harga').textContent = rupiah(o.harga);
        k.querySelector('.wa').href = linkWA(o.detail, o.judul, o.harga);
        k.querySelector('.foto').setAttribute('aria-label', 'Lihat foto lengkap ' + o.judul);
        k.querySelector('.foto img').alt = 'Screenshot akun ' + o.judul;
      }
      const rows = [...k.querySelectorAll('.detail li')].map(li => ({ k: li.children[0].textContent, v: li.children[1].textContent }));
      k.querySelector('.wa').href = linkWA(rows, k.querySelector('.nama').textContent, k.querySelector('.harga').textContent.replace(/\D/g, ''), o && o.wa);
      if (data.status[kode]) pasangStatus(k, data.status[kode]);
    });
    data.akun.forEach(a => {                                    // akun baru dari admin
      const k = el('article', 'kartu');
      const ul = el('ul', 'detail'); isiDetail(ul, a.detail);
      const wa = el('a', 'wa'); wa.target = '_blank'; wa.rel = 'noopener'; wa.href = linkWA(a.detail, a.judul, a.harga, a.wa);
      wa.innerHTML = '<svg aria-hidden="true"><use href="#i-wa"/></svg>'; wa.append('Chat via WhatsApp');
      k.append(foto(a.foto, a.judul, el('span', 'status')), el('h2', 'nama', a.judul), ul, el('p', 'harga', rupiah(a.harga)), wa);
      grid.append(k); pasangStatus(k, a.status);
    });
    document.querySelector('.chip[aria-pressed="true"]')?.click();   // terapkan filter yang lagi aktif
  }

  // ===== halaman testimoni =====
  const tg = document.getElementById('testi-grid');
  if (tg && data.testi.length) {
    data.testi.forEach((t, i) => {
      const k = el('article', 'kartu testi');
      // urutan zig-zag: baris 1 kanan->kiri, baris 2 kiri->kanan, dst.
      const baris = Math.floor(i / 2) + 1, pos = i % 2;
      k.style.gridRow = baris; k.style.gridColumn = (baris % 2 ? (pos ? 1 : 2) : (pos ? 2 : 1));
      const ul = el('ul', 'deskripsi');
      [...(t.toko ? [['🏪Toko : ', t.toko]] : []), ['📂Barang : ', t.barang], ['💸Harga : ', t.harga], ['👥Sistem : ', t.sistem]].forEach(([a, b]) => ul.append(el('li', null, a + b)));
      k.append(foto(t.foto, 'Testimoni ' + (i + 1), el('span', 'status ready', 'Testi ' + (i + 1))), ul);
      tg.append(k);
    });
    document.getElementById('kosong').hidden = true;
    document.querySelectorAll('.kartu').forEach((k, i) => { k.style.setProperty('--i', i); k.classList.add('masuk'); });
  }
})();
