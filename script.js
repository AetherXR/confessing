'use strict';

/* ── Konstanta ── */
const LS_KEY     = 'bisikan_confessions_v1';
const LS_LIKED   = 'bisikan_liked_v1';
const MAX_CHARS  = 280;

const INITIAL_DATA = [
  { id: 'seed-1', text: 'Aku suka seseorang yang bahkan tidak tahu aku ada. Sudah dua tahun.', mood: 'cinta',   time: '2 jam lalu',  ts: Date.now() - 7200000,  likes: 47 },
  { id: 'seed-2', text: 'Kadang aku pura-pura sibuk supaya tidak ada yang mengajak keluar. Aku hanya butuh sendiri.', mood: 'bingung', time: '5 jam lalu',  ts: Date.now() - 18000000, likes: 89 },
  { id: 'seed-3', text: 'Aku menangis di kamar mandi kantor hari ini. Tidak ada yang tahu. Dan aku tidak apa-apa, kok.', mood: 'sedih',   time: '8 jam lalu',  ts: Date.now() - 28800000, likes: 124 },
  { id: 'seed-4', text: "Aku akhirnya bilang 'tidak' tanpa merasa bersalah. Rasanya seperti pertama kali bernapas lega.", mood: 'senang',  time: '1 hari lalu', ts: Date.now() - 86400000, likes: 211 },
  { id: 'seed-5', text: 'Aku masih menyimpan semua pesannya meski sudah setahun lebih. Bodoh ya.', mood: 'cinta',   time: '1 hari lalu', ts: Date.now() - 90000000, likes: 76 },
  { id: 'seed-6', text: 'Aku marah. Pada semua orang. Pada diriku sendiri. Tapi senyum terus karena tidak ada pilihan lain.', mood: 'marah',   time: '2 hari lalu', ts: Date.now() - 172800000, likes: 53 },
];

/* ── State ── */
let confessions  = [];
let likedSet     = new Set();
let currentFilter = 'semua';
let selectedMood  = null;
let isSubmitting  = false;

/* ══════════════════════════════════════════
   1. LOCAL STORAGE
══════════════════════════════════════════ */
function lsLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    confessions = raw ? JSON.parse(raw) : [...INITIAL_DATA];
  } catch {
    confessions = [...INITIAL_DATA];
  }
  try {
    const rawLiked = localStorage.getItem(LS_LIKED);
    likedSet = rawLiked ? new Set(JSON.parse(rawLiked)) : new Set();
  } catch {
    likedSet = new Set();
  }
}

function lsSave() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(confessions));
    localStorage.setItem(LS_LIKED, JSON.stringify([...likedSet]));
  } catch (e) {
    console.warn('LocalStorage penuh atau diblokir:', e);
  }
}

function lsClear() {
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_LIKED);
  confessions = [...INITIAL_DATA];
  likedSet    = new Set();
  lsSave();
  renderFeed(true);
  showToast('Data berhasil direset 🗑️');
}

/* ══════════════════════════════════════════
   2. HELPERS
══════════════════════════════════════════ */
function uid() {
  return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d === 1) return '1 hari lalu';
  if (d < 7)   return `${d} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function refreshTimes() {
  document.querySelectorAll('.confess-time[data-ts]').forEach(el => {
    el.textContent = timeAgo(parseInt(el.dataset.ts));
  });
}

/* ══════════════════════════════════════════
   3. ANIMASI TAMBAHAN — CSS injeksi
══════════════════════════════════════════ */
function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    /* Card enter */
    @keyframes bisikanFadeUp {
      from { opacity: 0; transform: translateY(16px) scale(.98); }
      to   { opacity: 1; transform: translateY(0)    scale(1);   }
    }

    /* Like burst */
    @keyframes bisikanPop {
      0%   { transform: scale(1);    opacity: 1; }
      40%  { transform: scale(1.55); opacity: 1; }
      100% { transform: scale(1);    opacity: 1; }
    }

    /* Particle */
    @keyframes bisikanParticle {
      0%   { transform: translate(0,0) scale(1);    opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
    }

    /* Send button loading spinner */
    @keyframes bisikanSpin {
      to { transform: rotate(360deg); }
    }

    /* Shimmer skeleton */
    @keyframes bisikanShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }

    /* Char counter warning pulse */
    @keyframes bisikanPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: .4; }
    }

    /* New card highlight */
    @keyframes bisikanGlow {
      0%   { box-shadow: 0 0 0 0 rgba(201,116,138,.5); }
      60%  { box-shadow: 0 0 0 10px rgba(201,116,138,0); }
      100% { box-shadow: 0 0 0 0  rgba(201,116,138,0); }
    }

    /* Ripple */
    .bisikan-ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(201,116,138,.25);
      transform: scale(0);
      animation: bisikanRippleAnim .5s linear;
      pointer-events: none;
    }
    @keyframes bisikanRippleAnim {
      to { transform: scale(4); opacity: 0; }
    }

    .confess-card { overflow: hidden; }

    .confess-card.is-new {
      animation: bisikanFadeUp .4s cubic-bezier(.22,1,.36,1) both,
                 bisikanGlow   .8s ease .4s;
    }

    .confess-card.entering {
      animation: bisikanFadeUp .35s cubic-bezier(.22,1,.36,1) both;
    }

    .like-btn.popping {
      animation: bisikanPop .3s cubic-bezier(.34,1.56,.64,1);
    }

    .char-counter {
      font-size: .72rem;
      color: var(--muted);
      text-align: right;
      margin-top: 6px;
      transition: color .2s;
      font-family: 'Inter', sans-serif;
    }
    .char-counter.warn  { color: #C2B97B; }
    .char-counter.over  { color: #C27B7B; animation: bisikanPulse .6s infinite; }

    .send-btn .spinner {
      display: inline-block;
      width: 12px; height: 12px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: bisikanSpin .6s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }

    .skeleton-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 28px;
      margin-bottom: 16px;
    }
    .skeleton-line {
      height: 14px;
      border-radius: 7px;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #1E2436 25%, #2C3250 50%, #1E2436 75%);
      background-size: 400px 100%;
      animation: bisikanShimmer 1.4s ease infinite;
    }
    .skeleton-line.short { width: 40%; }
    .skeleton-line.mid   { width: 70%; }
    .skeleton-line.full  { width: 100%; }

    /* Typing dots in textarea label */
    .typing-dots span {
      display: inline-block;
      width: 4px; height: 4px;
      border-radius: 50%;
      background: var(--lavender);
      margin: 0 1px;
      animation: bisikanBounce .9s infinite;
    }
    .typing-dots span:nth-child(2) { animation-delay: .15s; }
    .typing-dots span:nth-child(3) { animation-delay: .30s; }
    @keyframes bisikanBounce {
      0%, 80%, 100% { transform: translateY(0); }
      40%            { transform: translateY(-5px); }
    }

    /* Delete button */
    .delete-btn {
      background: none;
      border: none;
      color: var(--muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      transition: color .2s;
      display: flex; align-items: center; gap: 4px;
      font-size: .78rem;
      font-family: 'Inter', sans-serif;
    }
    .delete-btn:hover { color: #C27B7B; }
    .delete-btn svg { width: 13px; height: 13px; }

    /* Confess card delete fade */
    .confess-card.removing {
      animation: bisikanFadeOut .3s ease forwards;
    }
    @keyframes bisikanFadeOut {
      to { opacity: 0; transform: translateX(20px) scale(.97); max-height: 0; padding: 0; margin: 0; }
    }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════
   4. SKELETON LOADING
══════════════════════════════════════════ */
function showSkeleton() {
  const list = document.getElementById('confess-list');
  list.innerHTML = [1, 2, 3].map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line full"></div>
      <div class="skeleton-line mid"></div>
      <div class="skeleton-line short" style="margin-top:18px"></div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════
   5. CHAR COUNTER
══════════════════════════════════════════ */
function initCharCounter() {
  const textarea = document.getElementById('confess-input');
  if (!textarea) return;

  // Inject counter element setelah textarea
  const counter = document.createElement('div');
  counter.className = 'char-counter';
  counter.id = 'char-counter';
  counter.textContent = `0 / ${MAX_CHARS}`;
  textarea.parentNode.insertBefore(counter, textarea.nextSibling);

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / ${MAX_CHARS}`;
    counter.classList.remove('warn', 'over');
    if (len > MAX_CHARS) counter.classList.add('over');
    else if (len > MAX_CHARS * 0.8) counter.classList.add('warn');
  });
}

/* ══════════════════════════════════════════
   6. TYPING INDICATOR di label compose
══════════════════════════════════════════ */
function initTypingIndicator() {
  const textarea = document.getElementById('confess-input');
  const label    = document.querySelector('.compose-label');
  if (!textarea || !label) return;

  const originalText = label.textContent;
  const dotsHtml = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  let typingTimer = null;
  let isTyping = false;

  textarea.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      label.innerHTML = `✦ sedang menulis… ${dotsHtml}`;
    }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      label.textContent = originalText;
    }, 1200);
  });

  textarea.addEventListener('blur', () => {
    clearTimeout(typingTimer);
    isTyping = false;
    label.textContent = originalText;
  });
}

/* ══════════════════════════════════════════
   7. PARTICLE BURST saat kirim
══════════════════════════════════════════ */
function burstParticles(originEl) {
  const rect    = originEl.getBoundingClientRect();
  const cx      = rect.left + rect.width / 2;
  const cy      = rect.top  + rect.height / 2;
  const colors  = ['#C9748A', '#8B85C1', '#F5EFE6', '#C2B97B'];
  const count   = 14;

  for (let i = 0; i < count; i++) {
    const p   = document.createElement('div');
    const ang = (i / count) * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    const dx  = Math.cos(ang) * dist;
    const dy  = Math.sin(ang) * dist;
    const size = 5 + Math.random() * 6;

    Object.assign(p.style, {
      position:   'fixed',
      left:       cx + 'px',
      top:        cy + 'px',
      width:      size + 'px',
      height:     size + 'px',
      borderRadius: '50%',
      background: colors[i % colors.length],
      pointerEvents: 'none',
      zIndex:     9999,
      '--dx':     dx + 'px',
      '--dy':     dy + 'px',
      animation:  `bisikanParticle .6s ease forwards`,
      animationDelay: (Math.random() * 0.1) + 's',
    });

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

/* ══════════════════════════════════════════
   8. RIPPLE pada confess card
══════════════════════════════════════════ */
function addRipple(card, e) {
  const rect = card.getBoundingClientRect();
  const r    = document.createElement('span');
  r.className = 'bisikan-ripple';
  const size = Math.max(rect.width, rect.height) * 1.2;
  Object.assign(r.style, {
    width:  size + 'px',
    height: size + 'px',
    left:   (e.clientX - rect.left - size / 2) + 'px',
    top:    (e.clientY - rect.top  - size / 2) + 'px',
  });
  card.appendChild(r);
  setTimeout(() => r.remove(), 520);
}

/* ══════════════════════════════════════════
   9. SEND LOGIC
══════════════════════════════════════════ */
function initSend() {
  const btn      = document.getElementById('send-btn');
  const textarea = document.getElementById('confess-input');
  if (!btn || !textarea) return;

  // Kirim dengan Ctrl/Cmd + Enter juga
  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') btn.click();
  });

  btn.addEventListener('click', async () => {
    if (isSubmitting) return;
    const text = textarea.value.trim();
    if (!text) {
      shakeElement(textarea);
      return;
    }
    if (text.length > MAX_CHARS) {
      shakeElement(document.getElementById('char-counter'));
      showToast(`Maksimal ${MAX_CHARS} karakter ✍️`);
      return;
    }

    // Animasi tombol loading
    isSubmitting = true;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Mengirim…`;
    btn.disabled = true;

    // Simulasi delay kirim (realistis)
    await delay(600);

    const entry = {
      id:    uid(),
      text,
      mood:  selectedMood || 'bingung',
      ts:    Date.now(),
      time:  'baru saja',
      likes: 0,
    };

    confessions.unshift(entry);
    lsSave();

    // Reset form
    textarea.value = '';
    document.getElementById('char-counter').textContent = `0 / ${MAX_CHARS}`;
    document.getElementById('char-counter').classList.remove('warn', 'over');
    resetMood();

    // Render & efek
    renderFeed(false, entry.id);
    burstParticles(btn);
    showToast('Bisikanmu terkirim 🤫');

    btn.innerHTML = originalHTML;
    btn.disabled  = false;
    isSubmitting  = false;

    // Auto-scroll ke feed jika di atas compose
    setTimeout(() => {
      document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 350);
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function shakeElement(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'bisikanShake .4s ease';
  const s = document.createElement('style');
  s.textContent = `@keyframes bisikanShake {
    0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)}
    60%{transform:translateX(-4px)} 80%{transform:translateX(4px)}
  }`;
  document.head.appendChild(s);
  setTimeout(() => el.style.animation = '', 400);
}

/* ══════════════════════════════════════════
   10. MOOD SELECTOR
══════════════════════════════════════════ */
function initMood() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      if (selectedMood === mood) {
        resetMood();
      } else {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMood = mood;
      }
    });
  });
}

function resetMood() {
  selectedMood = null;
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
}

/* ══════════════════════════════════════════
   11. FILTER
══════════════════════════════════════════ */
function initFilter() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderFeed(true);
    });
  });
}

/* ══════════════════════════════════════════
   12. RENDER FEED
══════════════════════════════════════════ */
function renderFeed(withSkeleton = false, newId = null) {
  const list  = document.getElementById('confess-list');
  const empty = document.getElementById('empty-state');
  if (!list) return;

  const filtered = currentFilter === 'semua'
    ? confessions
    : confessions.filter(c => c.mood === currentFilter);

  const countEl = document.getElementById('feed-count');
  if (countEl) countEl.textContent = `${filtered.length} bisikan`;

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  if (withSkeleton) {
    showSkeleton();
    setTimeout(() => buildCards(list, filtered, newId), 400);
  } else {
    buildCards(list, filtered, newId);
  }
}

function buildCards(list, filtered, newId) {
  list.innerHTML = filtered.map((c, i) => {
    const isNew  = c.id === newId;
    const liked  = likedSet.has(c.id);
    return `
      <div class="confess-card ${isNew ? 'is-new' : 'entering'}"
           data-mood="${c.mood}"
           data-id="${c.id}"
           style="animation-delay:${isNew ? 0 : i * 0.04}s">
        <div class="confess-mood">
          <span class="dot"></span>${c.mood}
        </div>
        <p class="confess-text">${escapeHtml(c.text)}</p>
        <div class="confess-meta">
          <span class="confess-time" data-ts="${c.ts}">${c.time || timeAgo(c.ts)}</span>
          <div class="confess-actions">
            <button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${c.id}" aria-label="Suka">
              <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span class="like-count">${c.likes}</span>
            </button>
            <button class="action-btn reply-btn" data-id="${c.id}" aria-label="Balas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              balas
            </button>
            ${isUserEntry(c.id) ? `
            <button class="action-btn delete-btn" data-id="${c.id}" aria-label="Hapus">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
              hapus
            </button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  bindCardEvents(list);
}

/* Cek apakah confess ini milik sesi ini (user_entries di sessionStorage) */
function isUserEntry(id) {
  try {
    const mine = JSON.parse(sessionStorage.getItem('bisikan_mine') || '[]');
    return mine.includes(id);
  } catch { return false; }
}

function markUserEntry(id) {
  try {
    const mine = JSON.parse(sessionStorage.getItem('bisikan_mine') || '[]');
    mine.push(id);
    sessionStorage.setItem('bisikan_mine', JSON.stringify(mine));
  } catch {}
}

/* ══════════════════════════════════════════
   13. EVENT BINDING pada kartu
══════════════════════════════════════════ */
function bindCardEvents(list) {
  // Ripple on card click (bukan button)
  list.querySelectorAll('.confess-card').forEach(card => {
    card.addEventListener('click', e => {
      if (!e.target.closest('button')) addRipple(card, e);
    });
  });

  // Like
  list.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const entry = confessions.find(c => c.id === id);
      if (!entry) return;

      // Pop animation
      btn.classList.remove('popping');
      btn.offsetHeight;
      btn.classList.add('popping');
      setTimeout(() => btn.classList.remove('popping'), 350);

      if (likedSet.has(id)) {
        likedSet.delete(id);
        entry.likes = Math.max(0, entry.likes - 1);
        btn.classList.remove('liked');
        btn.querySelector('svg').setAttribute('fill', 'none');
      } else {
        likedSet.add(id);
        entry.likes++;
        btn.classList.add('liked');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
        // Mini particles dari tombol like
        burstParticles(btn);
      }

      btn.querySelector('.like-count').textContent = entry.likes;
      lsSave();
    });
  });

  // Balas — scroll ke compose dan prefill
  list.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id     = btn.dataset.id;
      const entry  = confessions.find(c => c.id === id);
      if (!entry) return;
      const textarea = document.getElementById('confess-input');
      if (!textarea) return;
      const preview = entry.text.length > 40 ? entry.text.slice(0, 40) + '…' : entry.text;
      textarea.value = `// membalas: "${preview}"\n`;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      document.getElementById('tulis')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Trigger counter update
      textarea.dispatchEvent(new Event('input'));
    });
  });

  // Hapus (hanya confess milik sesi ini)
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id   = btn.dataset.id;
      const card = btn.closest('.confess-card');

      card.classList.add('removing');
      setTimeout(() => {
        confessions = confessions.filter(c => c.id !== id);
        lsSave();
        renderFeed();
        showToast('Bisikan dihapus 🗑️');
      }, 320);
    });
  });
}

/* ══════════════════════════════════════════
   14. TOAST
══════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  clearTimeout(toastTimer);
  t.textContent = msg;
  t.classList.add('show');
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════════
   15. RESET BUTTON (opsional, inject otomatis)
══════════════════════════════════════════ */
function injectResetBtn() {
  const footer = document.querySelector('footer');
  if (!footer) return;
  const btn = document.createElement('button');
  btn.textContent = 'Reset data';
  Object.assign(btn.style, {
    marginLeft:  '16px',
    background:  'none',
    border:      '1px solid #2C3250',
    borderRadius:'6px',
    color:       '#7A8099',
    fontSize:    '.72rem',
    padding:     '3px 10px',
    cursor:      'pointer',
    fontFamily:  'Inter, sans-serif',
    transition:  'color .2s, border-color .2s',
  });
  btn.addEventListener('mouseenter', () => {
    btn.style.color = '#C27B7B';
    btn.style.borderColor = '#C27B7B';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.color = '#7A8099';
    btn.style.borderColor = '#2C3250';
  });
  btn.addEventListener('click', () => {
    if (confirm('Reset semua data bisikan ke awal?')) lsClear();
  });
  footer.appendChild(btn);
}

/* ══════════════════════════════════════════
   16. TIME AUTO-REFRESH
══════════════════════════════════════════ */
function startTimeRefresh() {
  setInterval(refreshTimes, 60000); // setiap 1 menit
}

/* ══════════════════════════════════════════
   17. INIT — jalankan semua
══════════════════════════════════════════ */
function init() {
  injectStyles();
  lsLoad();
  initCharCounter();
  initTypingIndicator();
  initMood();
  initFilter();
  initSend();
  injectResetBtn();
  startTimeRefresh();

  // Shimmer saat pertama load
  showSkeleton();
  setTimeout(() => renderFeed(false), 500);
}

/* Tunggu DOM siap */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Override fungsi lama jika masih ada di inline script HTML */
window.__bisikanLoaded = true;
