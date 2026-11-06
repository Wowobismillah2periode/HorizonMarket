// Ambil data dari /api/data lalu pasang ke halaman (stok akun / testimoni).
// Semua teks dari admin dipasang pakai textContent (aman dari XSS).
(async () => {
  let data;
  try { data = await (await fetch('/api/data', { cache: 'no-store' })).json(); } catch { return; }
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

  // ===== halaman stok akun =====
  const grid = document.getElementById('testi-grid') ? null : document.querySelector('.grid');   // null di halaman testimoni
  if (grid) {
    document.querySelectorAll('.kartu').forEach(k => {          // akun lama: timpa status kalau diubah di admin
      const kode = k.querySelector('.detail b')?.textContent;
      if (data.status[kode]) pasangStatus(k, data.status[kode]);
    });
    data.akun.forEach(a => {
      const k = el('article', 'kartu');
      k.append(foto(a.foto, a.judul, el('span', 'status')), el('h2', 'nama', a.judul));
      const ul = el('ul', 'detail');
      a.detail.forEach(d => { const li = el('li'); li.append(el('span', null, d.k), el('b', null, d.v)); ul.append(li); });
      const kode = (a.detail.find(d => /kode/i.test(d.k)) || { v: a.judul }).v;
      const wa = el('a', 'wa'); wa.target = '_blank'; wa.rel = 'noopener';
      wa.href = 'https://wa.me/6285863549795?text=' + encodeURIComponent(`Bang, beli akun kode : ${kode} (${rupiah(a.harga).replace('Rp ', 'Rp')})`);
      wa.innerHTML = '<svg aria-hidden="true"><use href="#i-wa"/></svg>'; wa.append('Chat via WhatsApp');
      k.append(ul, el('p', 'harga', rupiah(a.harga)), wa);
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
      [['📂Barang : ', t.barang], ['💸Harga : ', t.harga], ['👥Sistem : ', t.sistem]].forEach(([a, b]) => ul.append(el('li', null, a + b)));
      k.append(foto(t.foto, 'Testimoni ' + (i + 1), el('span', 'status ready', 'Testi ' + (i + 1))), ul);
      tg.append(k);
    });
    document.getElementById('kosong').hidden = true;
    document.querySelectorAll('.kartu').forEach((k, i) => { k.style.setProperty('--i', i); k.classList.add('masuk'); });
  }
})();
