/* ══════════════════════════════════════════════════════
   UNDANGAN PERNIKAHAN — main.js
   Google Sheets via Apps Script Web App
   ══════════════════════════════════════════════════════ */

const API_URL    = 'https://script.google.com/macros/s/AKfycbzanfx7b3rMDB1gd91egaMtr8fVTqchoGQsz684ANugqamuXfY-bEHgd1kLYyb4KUyB/exec';
const SHEET_NAME = 'Example';

/* avatar colour cycle */
const AVATAR_CLS = ['wish-avatar-a', 'wish-avatar-b', 'wish-avatar-c'];

/* kehadiran → badge class + label */
const BADGE_MAP = {
  'Hadir'       : ['badge badge-hadir', '✅ Insya Allah Hadir'],
  'Tidak Hadir' : ['badge badge-tidak', '❌ Tidak Dapat Hadir'],
  'Masih Ragu'  : ['badge badge-ragu',  '🤔 Masih Belum Pasti'],
};

/* ════════════════════════════
   RECIPIENT  ?to=Nama+Tamu
   ════════════════════════════ */
function initRecipient() {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get('to') || params.get('nama') || '';
  if (!raw) return;

  const name = decodeURIComponent(raw.replace(/\+/g, ' ')).trim();
  if (!name) return;

  const block  = document.getElementById('cover-recipient');
  const nameEl = document.getElementById('cover-recipient-name');
  if (block && nameEl) {
    nameEl.textContent   = name;
    block.style.display  = 'block';
    block.style.opacity  = '0';
    block.style.transform = 'translateY(12px)';
    block.style.transition = 'opacity 0.7s ease 0.4s, transform 0.7s ease 0.4s';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      block.style.opacity   = '1';
      block.style.transform = 'translateY(0)';
    }));
  }

  /* pre-fill nama di form ucapan */
  const wishNameEl = document.getElementById('input-nama');
  if (wishNameEl && !wishNameEl.value) wishNameEl.value = name;
}

/* ════════════════════════════
   OPEN INVITATION
   ════════════════════════════ */
function openInvitation() {
  document.getElementById('cover').classList.add('hidden');
  document.getElementById('main').classList.add('visible');
  document.getElementById('sticky-nav').classList.add('visible');

  // show floating action buttons
  const fab = document.getElementById('fab-group');
  if (fab) {
    fab.style.display = 'flex';
    fab.style.opacity = '0'; fab.style.transition = 'opacity 0.6s ease 0.8s';
    requestAnimationFrame(() => requestAnimationFrame(() => { fab.style.opacity = '1'; }));
  }

  startCountdown();
  spawnHearts();
  initScrollSpy();
  loadWishes();

  // autoplay music — this runs inside a user gesture (button click) so allowed
  if (window._tryPlayMusic) window._tryPlayMusic();
}

/* ════════════════════════════
   SMOOTH SCROLL
   ════════════════════════════ */
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ════════════════════════════
   COUNTDOWN
   ════════════════════════════ */
function startCountdown() {
  const target = new Date('2026-05-31T08:00:00+07:00').getTime();
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) { ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id => document.getElementById(id).textContent='00'); return; }
    const d=Math.floor(diff/86400000), h=Math.floor((diff%86400000)/3600000),
          m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
    document.getElementById('cd-days').textContent  = String(d).padStart(2,'0');
    document.getElementById('cd-hours').textContent = String(h).padStart(2,'0');
    document.getElementById('cd-mins').textContent  = String(m).padStart(2,'0');
    document.getElementById('cd-secs').textContent  = String(s).padStart(2,'0');
  }
  tick(); setInterval(tick, 1000);
}

/* ════════════════════════════
   LOAD WISHES  (GET)
   ════════════════════════════ */
async function loadWishes() {
  const skeleton   = document.getElementById('wish-skeleton');
  const list       = document.getElementById('wish-list');
  const errorEl    = document.getElementById('wish-error');
  const countEl    = document.getElementById('wish-count');
  const refreshBtn = document.getElementById('btn-refresh');

  skeleton.style.display  = 'flex';
  list.style.display      = 'none';
  errorEl.style.display   = 'none';
  refreshBtn.style.display = 'none';
  list.innerHTML           = '';

  try {
    /* GET — ?sheetName=Example  (match contoh usage) */
    const res  = await fetch(`${API_URL}?sheetName=${encodeURIComponent(SHEET_NAME)}&t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    skeleton.style.display = 'none';
    list.style.display     = 'flex';

    if (!data || data.length === 0) {
      list.innerHTML = `<p style="text-align:center;color:var(--sage);font-size:0.8rem;padding:1.5rem 0;font-style:italic;">
        Jadilah yang pertama memberikan ucapan 🌸</p>`;
      countEl.textContent = '0 Ucapan';
      return;
    }

    /* newest first */
    const sorted = [...data].reverse();
    sorted.forEach((w, i) => list.appendChild(buildCard(w, i)));
    countEl.textContent = `${data.length} Ucapan`;

  } catch (err) {
    console.error('loadWishes:', err);
    skeleton.style.display   = 'none';
    errorEl.style.display    = 'block';
    refreshBtn.style.display = 'inline-flex';
  }
}

/* ════════════════════════════
   SUBMIT WISH  (POST JSON, no-cors)
   ════════════════════════════ */
async function submitWish() {
  const nama      = document.getElementById('input-nama').value.trim();
  const hp        = document.getElementById('input-hp').value.trim();
  const kehadiran = document.getElementById('input-kehadiran').value;
  const pesan     = document.getElementById('input-pesan').value.trim();
  const toast     = document.getElementById('wish-toast');
  const btn       = document.getElementById('btn-kirim');

  if (!nama)  { showToast(toast, '⚠️ Nama wajib diisi',    'error'); document.getElementById('input-nama').focus();  return; }
  if (!pesan) { showToast(toast, '⚠️ Ucapan wajib diisi', 'error'); document.getElementById('input-pesan').focus(); return; }

  /* loading */
  btn.disabled = true;
  btn.querySelector('.btn-text').style.display    = 'none';
  btn.querySelector('.btn-spinner').style.display = 'flex';

  const payload = {
    sheetName : SHEET_NAME,
    date      : new Date().toISOString(),
    nama, nomor_hp: hp, kehadiran, pesan,
  };

  try {
    /* POST with JSON body — no-cors because Apps Script doesn't return CORS on POST */
    await fetch(API_URL, {
      method  : 'POST',
      mode    : 'no-cors',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(payload),
    });

    showToast(toast, '✓ Ucapan terkirim! Jazakallah 🤍', 'success');

    /* reset form */
    document.getElementById('input-nama').value      = '';
    document.getElementById('input-hp').value        = '';
    document.getElementById('input-kehadiran').value = '';
    document.getElementById('input-pesan').value     = '';
    document.getElementById('pesan-count').textContent = '0';

    /* re-fill nama dari ?to= jika ada */
    const raw = new URLSearchParams(window.location.search).get('to') || new URLSearchParams(window.location.search).get('nama') || '';
    if (raw) document.getElementById('input-nama').value = decodeURIComponent(raw.replace(/\+/g,' ')).trim();

    /* optimistic card di atas list */
    const list = document.getElementById('wish-list');
    list.style.display = 'flex';
    const card = buildCard({ date: new Date().toISOString(), nama, nomor_hp: hp, kehadiran, pesan }, 0);
    card.style.cssText += ';opacity:0;transform:translateY(14px);transition:all 0.4s ease;';
    list.prepend(card);
    requestAnimationFrame(() => requestAnimationFrame(() => { card.style.opacity='1'; card.style.transform='translateY(0)'; }));

    /* update counter */
    const countEl = document.getElementById('wish-count');
    const prev = parseInt(countEl.textContent) || 0;
    countEl.textContent = `${prev + 1} Ucapan`;

    /* scroll ke list setelah animasi */
    setTimeout(() => list.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);

    /* reload dari server setelah 2 detik */
    setTimeout(loadWishes, 2000);

  } catch (err) {
    console.error('submitWish:', err);
    showToast(toast, '❌ Gagal mengirim. Coba lagi.', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').style.display    = 'flex';
    btn.querySelector('.btn-spinner').style.display = 'none';
  }
}

/* ════════════════════════════
   BUILD WISH CARD DOM
   ════════════════════════════ */
function buildCard(w, i) {
  const div      = document.createElement('div');
  div.className  = 'wish-card';
  const initial  = (w.nama || '?').charAt(0).toUpperCase();
  const avatarCls = AVATAR_CLS[i % 3];
  const dateStr  = formatDate(w.date);
  const [badgeCls, badgeLbl] = BADGE_MAP[w.kehadiran] || ['', ''];

  div.innerHTML = `
    <div class="wish-card-header">
      <div class="wish-avatar ${avatarCls}">${initial}</div>
      <div class="wish-card-meta">
        <p class="wish-author">${escHtml(w.nama || 'Anonim')}</p>
        <div class="wish-meta-row">
          ${badgeCls ? `<span class="${badgeCls}">${badgeLbl}</span>` : ''}
          ${dateStr  ? `<span class="wish-date">${dateStr}</span>`   : ''}
        </div>
      </div>
    </div>
    <p class="wish-text">${escHtml(w.pesan || '')}</p>
  `;
  return div;
}

/* ════════════════════════════
   HELPERS
   ════════════════════════════ */
function showToast(el, msg, type) {
  el.textContent = msg; el.className = `wish-toast ${type}`; el.style.display = 'block';
  clearTimeout(el._t); el._t = setTimeout(() => { el.style.display='none'; }, 5000);
}

function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d)) return raw;   // already formatted string
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ════════════════════════════
   CHAR COUNTER (pesan)
   ════════════════════════════ */
function initCharCounter() {
  const ta = document.getElementById('input-pesan');
  const ct = document.getElementById('pesan-count');
  if (!ta || !ct) return;
  ta.addEventListener('input', () => { ct.textContent = ta.value.length; });
}

/* ════════════════════════════
   FLOATING HEARTS
   ════════════════════════════ */
function spawnHearts() {
  const container = document.getElementById('hearts-container');
  if (!container) return;
  const s = document.createElement('style');
  s.textContent = `@keyframes riseHeart{0%{opacity:0;transform:translateY(0) scale(.5)}20%{opacity:.75}100%{opacity:0;transform:translateY(-220px) scale(1.2) rotate(12deg)}}`;
  document.head.appendChild(s);
  function mk() {
    const h = document.createElement('div'); h.textContent='♥';
    const sz=12+Math.random()*14, dur=4+Math.random()*4;
    h.style.cssText=`position:absolute;left:${Math.random()*100}%;bottom:0;font-size:${sz}px;color:#c9a96e;opacity:0;animation:riseHeart ${dur}s ease forwards;pointer-events:none;`;
    container.appendChild(h); setTimeout(()=>h.remove(), dur*1000+200);
  }
  setInterval(mk, 1300);
}

/* ════════════════════════════
   SCROLL SPY
   ════════════════════════════ */
function initScrollSpy() {
  const map = [
    ['sec-hero',     'nav-beranda'],
    ['sec-mempelai', 'nav-mempelai'],
    ['sec-jadwal',   'nav-jadwal'],
    ['sec-lokasi',   'nav-lokasi'],
    ['sec-ucapan',   'nav-ucapan'],
  ];
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const m = map.find(([id]) => id === e.target.id);
      if (m) { document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); document.getElementById(m[1])?.classList.add('active'); }
    });
  }, { threshold: 0.4 });
  map.forEach(([id]) => { const el=document.getElementById(id); if(el) obs.observe(el); });
}

/* ════════════════════════════
   INIT ON DOM READY
   ════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initRecipient();
  initCharCounter();
  initMusic();   // prepare audio + UI — actual play triggered by openInvitation()

  /* scroll reveal */
  const ro = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => ro.observe(el));
});

/* ════════════════════════════════════════
   MUSIC PLAYER
   ════════════════════════════════════════ */
let musicReady = false;

function initMusic() {
  const audio   = document.getElementById('bg-music');
  const fab     = document.getElementById('fab-music');
  const iconP   = document.getElementById('icon-play');
  const iconPa  = document.getElementById('icon-pause');
  const ring    = document.getElementById('fab-ring');
  const tip     = document.getElementById('fab-music-tip');

  if (!audio) return;

  /* Try autoplay — browsers may block until user interaction.
     We start it on openInvitation() which IS a user gesture.   */
  audio.volume = 0.5;

  const tryPlay = () => {
    audio.play()
      .then(() => {
        setPlayingUI(true);
        musicReady = true;
      })
      .catch(() => {
        /* autoplay blocked — will play on first toggle */
        setPlayingUI(false);
        musicReady = false;
      });
  };

  // expose tryPlay so openInvitation can call it
  window._tryPlayMusic = tryPlay;

  audio.addEventListener('play',  () => setPlayingUI(true));
  audio.addEventListener('pause', () => setPlayingUI(false));
  audio.addEventListener('ended', () => setPlayingUI(false));

  function setPlayingUI(playing) {
    fab.classList.toggle('is-playing', playing);
    iconP.style.display  = playing ? 'none'  : 'block';
    iconPa.style.display = playing ? 'block' : 'none';
    tip.textContent      = playing ? 'Jeda'  : 'Putar';
  }
}

function toggleMusic() {
  const audio = document.getElementById('bg-music');
  if (!audio) return;
  if (audio.paused) {
    audio.play().catch(console.error);
  } else {
    audio.pause();
  }
}

/* ════════════════════════════════════════
   MODAL AMPLOP
   ════════════════════════════════════════ */
function openAmplop() {
  const modal = document.getElementById('modal-amplop');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // re-trigger animation
  const box = modal.querySelector('.modal-box');
  box.style.animation = 'none';
  requestAnimationFrame(() => { box.style.animation = ''; });
}

function closeAmplop(e) {
  if (e && e.target !== document.getElementById('modal-amplop')) return;
  const modal = document.getElementById('modal-amplop');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAmplop();
});

/* ════════════════════════════════════════
   COPY REKENING
   ════════════════════════════════════════ */
async function copyRek(id, btn) {
  const text = document.getElementById(id)?.textContent?.replace(/\s/g, '').trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback for older browsers
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  // visual feedback on button
  const span = btn.querySelector('span');
  const prev = span.textContent;
  span.textContent = '✓ Disalin!';
  btn.classList.add('copied');
  setTimeout(() => { span.textContent = prev; btn.classList.remove('copied'); }, 2000);
}