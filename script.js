
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  deleteDoc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/* ══════════════════════════════════════════
   🔧 FIREBASE CONFIG — GANTI DENGAN MILIKMU
══════════════════════════════════════════ */
const firebaseConfig = {
  apiKey:            "AIzaSyDLZVH_o64kLBE076DZaCezWF4afMP89E8",
  authDomain:        "confessing-652f1.firebaseapp.com",
  projectId:         "confessing-652f1",
  storageBucket:     "confessing-652f1.firebasestorage.app",
  messagingSenderId: "760175496764",
  appId:             "1:760175496764:web:68ce6647d861af293a7d39",
};

/* ══════════════════════════════════════════
   INIT FIREBASE
══════════════════════════════════════════ */
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COLLECTION = 'confessions';

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let currentFilter = 'semua';
let selectedMood  = null;
let isSubmitting  = false;
let allDocs       = [];          // semua dokumen dari Firestore
const MAX_CHARS   = 280;

/* ID sesi browser ini (untuk tandai confess milik sendiri) */
const SESSION_ID = (() => {
  let id = sessionStorage.getItem('bisikan_session');
  if (!id) { id = 'sess-' + Date.now().toString(36); sessionStorage.setItem('bisikan_session', id); }
  return id;
})();

/* Like yang sudah dilakukan sesi ini (pakai localStorage) */
const likedSet = new Set(JSON.parse(localStorage.getItem('bisikan_liked_v2') || '[]'));

function saveLiked() {
  localStorage.setItem('bisikan_liked_v2', JSON.stringify([...likedSet]));
}

/* ══════════════════════════════════════════
   CSS INJEKSI (animasi & efek)
══════════════════════════════════════════ */
function injectStyles() {
  const s = document.createElement('style');
  s.textContent = `
    @keyframes bisikanFadeUp {
      from { opacity:0; transform:translateY(16px) scale(.98); }
      to   { opacity:1; transform:none; }
    }
    @keyframes bisikanGlow {
      0%   { box-shadow: 0 0 0 0   rgba(201,116,138,.5); }
      60%  { box-shadow: 0 0 0 10px rgba(201,116,138,0); }
      100% { box-shadow: 0 0 0 0   rgba(201,116,138,0); }
    }
    @keyframes bisikanPop {
      0%  { transform: scale(1); }
      40% { transform: scale(1.55); }
      100%{ transform: scale(1); }
    }
    @keyframes bisikanParticle {
      0%   { transform: translate(0,0) scale(1); opacity:1; }
      100% { transform: translate(var(--dx),var(--dy)) scale(0); opacity:0; }
    }
    @keyframes bisikanSpin {
      to { transform: rotate(360deg); }
    }
    @keyframes bisikanShimmer {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }
    @keyframes bisikanPulse {
      0%,100%{ opacity:1; } 50%{ opacity:.4; }
    }
    @keyframes bisikanFadeOut {
      to { opacity:0; transform:translateX(24px) scale(.97); max-height:0; padding:0; margin:0; border:none; }
    }
    @keyframes bisikanBounce {
      0%,80%,100%{ transform:translateY(0); }
      40%         { transform:translateY(-5px); }
    }
    @keyframes bisikanShake {
      0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)}   60%{transform:translateX(-4px)}
      80%{transform:translateX(4px)}
    }

    .confess-card { overflow:hidden; }
    .confess-card.is-new   { animation: bisikanFadeUp .4s cubic-bezier(.22,1,.36,1) both, bisikanGlow .8s ease .4s; }
    .confess-card.entering { animation: bisikanFadeUp .35s cubic-bezier(.22,1,.36,1) both; }
    .confess-card.removing { animation: bisikanFadeOut .3s ease forwards; }

    .like-btn.popping { animation: bisikanPop .3s cubic-bezier(.34,1.56,.64,1); }

    .bisikan-ripple {
      position:absolute; border-radius:50%;
      background:rgba(201,116,138,.22);
      transform:scale(0);
      animation: bisikanRippleAnim .5s linear;
      pointer-events:none;
    }
    @keyframes bisikanRippleAnim { to { transform:scale(4); opacity:0; } }

    .char-counter {
      font-size:.72rem; color:var(--muted); text-align:right;
      margin-top:6px; transition:color .2s; font-family:'Inter',sans-serif;
    }
    .char-counter.warn { color:#C2B97B; }
    .char-counter.over { color:#C27B7B; animation:bisikanPulse .6s infinite; }

    .send-btn .spinner {
      display:inline-block; width:12px; height:12px;
      border:2px solid rgba(255,255,255,.35); border-top-color:#fff;
      border-radius:50%; animation:bisikanSpin .6s linear infinite;
      vertical-align:middle; margin-right:6px;
    }

    .skeleton-card {
      background:var(--card); border:1px solid var(--border);
      border-radius:14px; padding:28px; margin-bottom:16px;
    }
    .skeleton-line {
      height:14px; border-radius:7px; margin-bottom:10px;
      background:linear-gradient(90deg,#1E2436 25%,#2C3250 50%,#1E2436 75%);
      background-size:400px 100%;
      animation:bisikanShimmer 1.4s ease infinite;
    }
    .skeleton-line.short{ width:40%; }
    .skeleton-line.mid  { width:70%; }
    .skeleton-line.full { width:100%; }

    .typing-dots span {
      display:inline-block; width:4px; height:4px; border-radius:50%;
      background:var(--lavender); margin:0 1px;
      animation:bisikanBounce .9s infinite;
    }
    .typing-dots span:nth-child(2){ animation-delay:.15s; }
    .typing-dots span:nth-child(3){ animation-delay:.30s; }

    .delete-btn {
      background:none; border:none; color:var(--muted); cursor:pointer;
      padding:4px; border-radius:6px; transition:color .2s;
      display:flex; align-items:center; gap:4px;
      font-size:.78rem; font-family:'Inter',sans-serif;
    }
    .delete-btn:hover { color:#C27B7B; }
    .delete-btn svg { width:13px; height:13px; }

    /* Status realtime indicator */
    .realtime-dot {
      display:inline-block; width:7px; height:7px; border-radius:50%;
      background:#4CAF50; margin-right:6px;
      box-shadow:0 0 0 0 rgba(76,175,80,.5);
      animation:bisikanRealtimePulse 2s infinite;
    }
    @keyframes bisikanRealtimePulse {
      0%  { box-shadow:0 0 0 0   rgba(76,175,80,.5); }
      70% { box-shadow:0 0 0 6px rgba(76,175,80,0); }
      100%{ box-shadow:0 0 0 0   rgba(76,175,80,0); }
    }
    .realtime-badge {
      font-size:.7rem; color:#4CAF50; letter-spacing:.06em;
      display:flex; align-items:center; margin-bottom:20px;
    }

    /* Error banner */
    .error-banner {
      background:rgba(194,123,123,.12); border:1px solid #C27B7B;
      border-radius:10px; padding:14px 18px; margin-bottom:16px;
      font-size:.85rem; color:#C27B7B; display:none;
    }
    .error-banner.show { display:block; }
  `;
  document.head.appendChild(s);
}

/* ══════════════════════════════════════════
   SKELETON LOADING
══════════════════════════════════════════ */
function showSkeleton() {
  const list = document.getElementById('confess-list');
  if (!list) return;
  list.innerHTML = [1,2,3].map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line full"></div>
      <div class="skeleton-line mid"></div>
      <div class="skeleton-line short" style="margin-top:18px"></div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════
   REALTIME BADGE
══════════════════════════════════════════ */
function injectRealtimeBadge() {
  const header = document.querySelector('.feed-header');
  if (!header) return;
  const badge = document.createElement('div');
  badge.className = 'realtime-badge';
  badge.innerHTML = `<span class="realtime-dot"></span> Realtime — terhubung ke Firestore`;
  header.insertAdjacentElement('afterend', badge);
}

/* ══════════════════════════════════════════
   ERROR BANNER
══════════════════════════════════════════ */
function showError(msg) {
  let banner = document.getElementById('bisikan-error');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'bisikan-error';
    banner.className = 'error-banner';
    document.querySelector('.feed-section')?.prepend(banner);
  }
  banner.textContent = '⚠️ ' + msg;
  banner.classList.add('show');
}
function hideError() {
  document.getElementById('bisikan-error')?.classList.remove('show');
}

/* ══════════════════════════════════════════
   CHAR COUNTER
══════════════════════════════════════════ */
function initCharCounter() {
  const textarea = document.getElementById('confess-input');
  if (!textarea) return;
  const counter = document.createElement('div');
  counter.className = 'char-counter';
  counter.id = 'char-counter';
  counter.textContent = `0 / ${MAX_CHARS}`;
  textarea.parentNode.insertBefore(counter, textarea.nextSibling);
  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / ${MAX_CHARS}`;
    counter.classList.toggle('warn', len > MAX_CHARS * 0.8 && len <= MAX_CHARS);
    counter.classList.toggle('over', len > MAX_CHARS);
  });
}

/* ══════════════════════════════════════════
   TYPING INDICATOR
══════════════════════════════════════════ */
function initTypingIndicator() {
  const textarea = document.getElementById('confess-input');
  const label    = document.querySelector('.compose-label');
  if (!textarea || !label) return;
  const original = label.textContent;
  let timer = null, typing = false;
  textarea.addEventListener('input', () => {
    if (!typing) {
      typing = true;
      label.innerHTML = `✦ sedang menulis… <span class="typing-dots"><span></span><span></span><span></span></span>`;
    }
    clearTimeout(timer);
    timer = setTimeout(() => { typing = false; label.textContent = original; }, 1200);
  });
  textarea.addEventListener('blur', () => { clearTimeout(timer); typing = false; label.textContent = original; });
}

/* ══════════════════════════════════════════
   PARTICLE BURST
══════════════════════════════════════════ */
function burstParticles(originEl) {
  const rect   = originEl.getBoundingClientRect();
  const cx     = rect.left + rect.width / 2;
  const cy     = rect.top  + rect.height / 2;
  const colors = ['#C9748A','#8B85C1','#F5EFE6','#C2B97B'];
  for (let i = 0; i < 14; i++) {
    const p    = document.createElement('div');
    const ang  = (i / 14) * Math.PI * 2;
    const dist = 40 + Math.random() * 40;
    const size = 5 + Math.random() * 6;
    Object.assign(p.style, {
      position:'fixed', left:cx+'px', top:cy+'px',
      width:size+'px', height:size+'px', borderRadius:'50%',
      background: colors[i % colors.length], pointerEvents:'none', zIndex:'9999',
      '--dx': Math.cos(ang)*dist+'px', '--dy': Math.sin(ang)*dist+'px',
      animation: `bisikanParticle .6s ease forwards`,
      animationDelay: (Math.random()*.1)+'s',
    });
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
}

/* ══════════════════════════════════════════
   RIPPLE
══════════════════════════════════════════ */
function addRipple(card, e) {
  const rect = card.getBoundingClientRect();
  const r    = document.createElement('span');
  r.className = 'bisikan-ripple';
  const size = Math.max(rect.width, rect.height) * 1.2;
  Object.assign(r.style, {
    width: size+'px', height: size+'px',
    left: (e.clientX - rect.left - size/2)+'px',
    top:  (e.clientY - rect.top  - size/2)+'px',
  });
  card.appendChild(r);
  setTimeout(() => r.remove(), 520);
}

/* ══════════════════════════════════════════
   SHAKE
══════════════════════════════════════════ */
function shakeElement(el) {
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = 'bisikanShake .4s ease';
  setTimeout(() => el.style.animation = '', 400);
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  if (!ts) return 'baru saja';
  const ms = ts.toMillis ? ts.toMillis() : ts;
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d === 1) return '1 hari lalu';
  if (d < 7)   return `${d} hari lalu`;
  return new Date(ms).toLocaleDateString('id-ID', { day:'numeric', month:'short' });
}

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
   MOOD SELECTOR
══════════════════════════════════════════ */
function initMood() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mood = btn.dataset.mood;
      if (selectedMood === mood) {
        selectedMood = null;
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
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
   FILTER
══════════════════════════════════════════ */
function initFilter() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderFeed();
    });
  });
}

/* ══════════════════════════════════════════
   RENDER FEED
══════════════════════════════════════════ */
function renderFeed(newId = null) {
  const list  = document.getElementById('confess-list');
  const empty = document.getElementById('empty-state');
  if (!list) return;

  const filtered = currentFilter === 'semua'
    ? allDocs
    : allDocs.filter(c => c.mood === currentFilter);

  const countEl = document.getElementById('feed-count');
  if (countEl) countEl.textContent = `${filtered.length} bisikan`;

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = filtered.map((c, i) => {
    const isNew  = c.id === newId;
    const liked  = likedSet.has(c.id);
    const isMine = c.sessionId === SESSION_ID;
    return `
      <div class="confess-card ${isNew ? 'is-new' : 'entering'}"
           data-mood="${c.mood}" data-id="${c.id}"
           style="animation-delay:${isNew ? 0 : i * 0.04}s">
        <div class="confess-mood">
          <span class="dot"></span>${c.mood}
        </div>
        <p class="confess-text">${escapeHtml(c.text)}</p>
        <div class="confess-meta">
          <span class="confess-time">${timeAgo(c.createdAt)}</span>
          <div class="confess-actions">
            <button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${c.id}" aria-label="Suka">
              <svg viewBox="0 0 24 24" fill="${liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <span class="like-count">${c.likes || 0}</span>
            </button>
            <button class="action-btn reply-btn" data-id="${c.id}" aria-label="Balas">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              balas
            </button>
            ${isMine ? `
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

/* ══════════════════════════════════════════
   BIND EVENTS PADA KARTU
══════════════════════════════════════════ */
function bindCardEvents(list) {
  // Ripple
  list.querySelectorAll('.confess-card').forEach(card => {
    card.addEventListener('click', e => {
      if (!e.target.closest('button')) addRipple(card, e);
    });
  });

  // Like — update Firestore
  list.querySelectorAll('.like-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.id;

      btn.classList.remove('popping');
      btn.offsetHeight;
      btn.classList.add('popping');
      setTimeout(() => btn.classList.remove('popping'), 350);

      const ref   = doc(db, COLLECTION, id);
      const liked = likedSet.has(id);
      try {
        await updateDoc(ref, { likes: increment(liked ? -1 : 1) });
        if (liked) { likedSet.delete(id); btn.classList.remove('liked'); btn.querySelector('svg').setAttribute('fill','none'); }
        else       { likedSet.add(id);    btn.classList.add('liked');    btn.querySelector('svg').setAttribute('fill','currentColor'); burstParticles(btn); }
        saveLiked();
        // Update count lokal (Firestore listener akan sync juga)
        const countEl = btn.querySelector('.like-count');
        if (countEl) countEl.textContent = parseInt(countEl.textContent) + (liked ? -1 : 1);
      } catch (err) {
        showToast('Gagal update like 😔');
        console.error(err);
      }
    });
  });

  // Balas — scroll ke compose
  list.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id    = btn.dataset.id;
      const entry = allDocs.find(c => c.id === id);
      if (!entry) return;
      const textarea = document.getElementById('confess-input');
      if (!textarea) return;
      const preview = entry.text.length > 40 ? entry.text.slice(0,40)+'…' : entry.text;
      textarea.value = `// membalas: "${preview}"\n`;
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      textarea.dispatchEvent(new Event('input'));
      document.getElementById('tulis')?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  });

  // Hapus — delete dari Firestore
  list.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Hapus bisikan ini?')) return;
      const id   = btn.dataset.id;
      const card = btn.closest('.confess-card');
      card.classList.add('removing');
      try {
        await deleteDoc(doc(db, COLLECTION, id));
        showToast('Bisikan dihapus 🗑️');
        // onSnapshot akan otomatis update feed
      } catch (err) {
        card.classList.remove('removing');
        showToast('Gagal menghapus 😔');
        console.error(err);
      }
    });
  });
}

/* ══════════════════════════════════════════
   REALTIME LISTENER — onSnapshot
══════════════════════════════════════════ */
function startRealtimeListener() {
  showSkeleton();
  const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));

  onSnapshot(q,
    (snapshot) => {
      hideError();
      const prevIds = new Set(allDocs.map(d => d.id));
      allDocs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

      // Temukan dokumen baru (realtime insert dari orang lain)
      const newDoc = allDocs.find(d => !prevIds.has(d.id) && d.sessionId !== SESSION_ID);
      renderFeed(newDoc?.id ?? null);

      // Auto-refresh waktu setiap menit
      setInterval(() => {
        document.querySelectorAll('.confess-time').forEach(el => {
          const id    = el.closest('.confess-card')?.dataset?.id;
          const entry = allDocs.find(c => c.id === id);
          if (entry?.createdAt) el.textContent = timeAgo(entry.createdAt);
        });
      }, 60000);
    },
    (error) => {
      console.error('Firestore error:', error);
      showError('Gagal terhubung ke database. Periksa konfigurasi Firebase kamu.');
    }
  );
}

/* ══════════════════════════════════════════
   SEND — simpan ke Firestore
══════════════════════════════════════════ */
function initSend() {
  const btn      = document.getElementById('send-btn');
  const textarea = document.getElementById('confess-input');
  if (!btn || !textarea) return;

  // Ctrl/Cmd + Enter untuk kirim
  textarea.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') btn.click();
  });

  btn.addEventListener('click', async () => {
    if (isSubmitting) return;
    const text = textarea.value.trim();
    if (!text) { shakeElement(textarea); return; }
    if (text.length > MAX_CHARS) {
      shakeElement(document.getElementById('char-counter'));
      showToast(`Maksimal ${MAX_CHARS} karakter ✍️`);
      return;
    }

    isSubmitting = true;
    const original = btn.innerHTML;
    btn.innerHTML  = `<span class="spinner"></span> Mengirim…`;
    btn.disabled   = true;

    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        text,
        mood:      selectedMood || 'bingung',
        likes:     0,
        sessionId: SESSION_ID,           // untuk fitur hapus milik sendiri
        createdAt: serverTimestamp(),    // waktu server Firestore
      });

      // Reset form
      textarea.value = '';
      document.getElementById('char-counter').textContent = `0 / ${MAX_CHARS}`;
      document.getElementById('char-counter').classList.remove('warn','over');
      resetMood();

      burstParticles(btn);
      showToast('Bisikanmu terkirim 🤫');

      // Scroll ke feed
      setTimeout(() => {
        document.getElementById('feed')?.scrollIntoView({ behavior:'smooth', block:'start' });
      }, 350);

    } catch (err) {
      console.error('Gagal kirim:', err);
      showToast('Gagal mengirim bisikan 😔 Cek koneksi kamu.');
    } finally {
      btn.innerHTML = original;
      btn.disabled  = false;
      isSubmitting  = false;
    }
  });
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
function init() {
  injectStyles();
  injectRealtimeBadge();
  initCharCounter();
  initTypingIndicator();
  initMood();
  initFilter();
  initSend();
  startRealtimeListener();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
