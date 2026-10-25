/* Velum Music · interfaz */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const native = window.AndroidBridge || null;
  const P = window.Player, L = window.Lib;

  const fmt = sec => {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
  };
  const fmtLong = sec => { const h = Math.floor(sec / 3600), m = Math.round(sec % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };
  const plural = (n, a, b) => `${n.toLocaleString('es')} ${n === 1 ? a : b}`;
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // ---------- Íconos ----------
  const S_ = (d) => `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
  const ICONS = {
    play: '<path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.04-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14z"/>',
    pause: '<path d="M7 4.5h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zm7 0h3a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z"/>',
    next: '<path d="M2.5 6.2v11.6a.8.8 0 0 0 1.24.66L11.5 13.3v4.5a.8.8 0 0 0 1.24.66l8.4-5.8a.8.8 0 0 0 0-1.32l-8.4-5.8a.8.8 0 0 0-1.24.66v4.5L3.74 5.54a.8.8 0 0 0-1.24.66z"/>',
    prev: '<path d="M21.5 6.2v11.6a.8.8 0 0 1-1.24.66L12.5 13.3v4.5a.8.8 0 0 1-1.24.66l-8.4-5.8a.8.8 0 0 1 0-1.32l8.4-5.8a.8.8 0 0 1 1.24.66v4.5l7.76-5.16a.8.8 0 0 1 1.24.66z"/>',
    heartFill: '<path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2.2 0 3.6 1.2 5.4 3.2 1.8-2 3.2-3.2 5.4-3.2 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z"/>',
    heart: S_('<path d="M12 20s-7-4.3-8.9-8.6C1.7 8.2 3.6 5 6.8 5c2 0 3.3 1.1 5.2 3 1.9-1.9 3.2-3 5.2-3 3.2 0 5.1 3.2 3.7 6.4C19 15.7 12 20 12 20z"/>'),
    more: '<circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>',
    shuffle: S_('<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>'),
    repeat: S_('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
    repeat1: S_('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/>'),
    infinity: S_('<path d="M12 12c-2-2.7-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.3 6-4zm0 0c2 2.7 4 4 6 4a4 4 0 1 0 0-8c-2 0-4 1.3-6 4z"/>'),
    chevD: S_('<path d="m6 9 6 6 6-6"/>'),
    chevL: S_('<path d="m15 18-6-6 6-6"/>'),
    chevR: S_('<path d="m9 18 6-6-6-6"/>'),
    home: S_('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    library: S_('<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>'),
    playlist: S_('<path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/>'),
    search: S_('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    gear: S_('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    note: S_('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
    album: S_('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>'),
    artist: S_('<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>'),
    genre: S_('<path d="M12 2H2v10l9.3 9.3a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7" cy="7" r="1.5"/>'),
    folder: S_('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    clock: S_('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    flame: S_('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.2.2 1.6 1.2 2.7 2.5 2.7z"/>'),
    sparkles: S_('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
    refresh: S_('<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>'),
    plus: S_('<path d="M12 5v14M5 12h14"/>'),
    x: S_('<path d="M18 6 6 18M6 6l12 12"/>'),
    grip: S_('<path d="M4 9h16M4 15h16"/>'),
    lyrics: S_('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>'),
    queue: S_('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r=".6"/><circle cx="3.5" cy="12" r=".6"/><circle cx="3.5" cy="18" r=".6"/>'),
    moon: S_('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    eq: S_('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
    volLow: S_('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),
    volHigh: S_('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>'),
    playNext: S_('<path d="M3 6h13M3 12h9M3 18h9"/><path d="m16 13 5 3-5 3z"/>'),
    addQueue: S_('<path d="M3 6h13M3 12h13M3 18h7"/><path d="M17 15v6M14 18h6"/>'),
    addList: S_('<path d="M3 6h13M3 12h9M3 18h7"/><path d="M18 12v8M14 16h8"/>'),
    info: S_('<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>'),
    trash: S_('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    edit: S_('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    check: S_('<path d="M20 6 9 17l-5-5"/>'),
    chart: S_('<path d="M3 3v18h18"/><path d="M7 16v-4M12 16V8M17 16v-7"/>'),
    speed: S_('<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>'),
    sort: S_('<path d="M3 6h18M6 12h12M10 18h4"/>'),
    vibrate: S_('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 8v8M21 8v8"/>'),
    sliders: S_('<path d="M12 3v18"/><path d="M5 8v8"/><path d="M19 6v12"/>'),
    lock: S_('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
    dot: '<circle cx="12" cy="12" r="2"/>'
  };
  const icon = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  // ---------- Estado guardado ----------
  const DEFAULTS = {
    crossfade: 0, gapless: true, autoplay: true, speed: 1, volume: 1, engine: true,
    eq: { on: false, preset: 'flat', gains: P.EQ_PRESETS.flat.g.slice(), preamp: 0 },
    hideShort: false, haptics: true, songSort: 'title', albumSort: 'title', theme: 'obsidiana'
  };
  const THEMES = {
    obsidiana: { name: 'Obsidiana', bg: '#07070a', sw: 'linear-gradient(135deg,#1b1a1f,#07070a)', dot: 'linear-gradient(135deg,#fbecc6,#b98a43)', glow: 'rgba(232,197,130,.8)' },
    violeta: { name: 'Violeta', bg: '#0e0c13', sw: 'linear-gradient(135deg,#2a2140,#0e0c13)', dot: 'linear-gradient(135deg,#a77af7,#f0cf8c)', glow: 'rgba(167,122,247,.8)' },
    onix: { name: 'Ónix', bg: '#050505', sw: 'linear-gradient(135deg,#222,#050505)', dot: 'linear-gradient(135deg,#fff,#9da1ab)', glow: 'rgba(255,255,255,.6)' },
    zafiro: { name: 'Zafiro', bg: '#04070f', sw: 'linear-gradient(135deg,#13234a,#04070f)', dot: 'linear-gradient(135deg,#8fb4ff,#6fd8ff)', glow: 'rgba(112,160,255,.8)' },
    rubi: { name: 'Rubí', bg: '#0b0406', sw: 'linear-gradient(135deg,#3a1220,#0b0406)', dot: 'linear-gradient(135deg,#ff8aa6,#ffc684)', glow: 'rgba(255,120,150,.8)' },
    esmeralda: { name: 'Esmeralda', bg: '#030907', sw: 'linear-gradient(135deg,#0f3427,#030907)', dot: 'linear-gradient(135deg,#6ee8b8,#e6d184)', glow: 'rgba(94,226,176,.8)' }
  };
  function applyTheme(name) {
    const th = THEMES[name] ? name : 'obsidiana';
    document.documentElement.dataset.theme = th;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEMES[th].bg;
    try { if (native && native.setBarColor) native.setBarColor(THEMES[th].bg); } catch (e) { }
    try { localStorage.setItem('velum.theme', th); } catch (e) { }
  }
  const S = { settings: null, playlists: [], likes: new Set(), plays: {}, history: [], stats: {}, recent: [] };

  async function loadState() {
    const kv = k => DB.get('kv', k).catch(() => null);
    const st = (await kv('settings')) || {};
    S.settings = Object.assign({}, DEFAULTS, st);
    S.settings.eq = Object.assign({}, DEFAULTS.eq, st.eq || {});
    P.settings = S.settings;
    S.playlists = (await kv('playlists')) || [];
    S.likes = new Set((await kv('likes')) || []);
    S.plays = (await kv('plays')) || {};
    S.history = (await kv('history')) || [];
    S.stats = (await kv('stats')) || {};
    S.recent = (await kv('recentSearches')) || [];
  }
  const persist = {
    settings: () => DB.later('settings', S.settings, 300),
    playlists: () => DB.later('playlists', S.playlists, 200),
    likes: () => DB.later('likes', Array.from(S.likes), 200),
    plays: () => { DB.later('plays', S.plays, 1500); DB.later('history', S.history, 1500); },
    stats: () => DB.later('stats', S.stats, 4000),
    recent: () => DB.later('recentSearches', S.recent, 300)
  };

  function haptic() {
    if (!S.settings || !S.settings.haptics) return;
    try { if (native && native.haptic) native.haptic(); else if (navigator.vibrate) navigator.vibrate(6); } catch (e) { }
  }

  // ---------- Carátulas ----------
  const hue = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
  function loadArt(el) {
    const key = el.dataset.art;
    if (!key) return;
    L.artUrl(key).then(url => {
      if (!url || el.dataset.art !== key) return;
      let img = el.querySelector(':scope > img');
      if (!img) { img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; el.appendChild(img); }
      img.onload = () => img.classList.add('on');
      img.src = url;
      if (img.complete && img.naturalWidth) img.classList.add('on');
    });
  }
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); loadArt(e.target); } }), { rootMargin: '400px 300px' })
    : null;
  function hydrate(root) {
    $$('[data-art]:not([data-h])', root).forEach(el => { el.dataset.h = '1'; if (io) io.observe(el); else loadArt(el); });
  }
  function art(key, seed, cls = '', ic = 'note') {
    const h = hue(String(seed || key || ''));
    return `<div class="art ${cls}"${key ? ` data-art="${esc(key)}"` : ''} style="--h1:${250 + h % 45};--h2:${22 + (h >> 7) % 28}">${icon(ic)}</div>`;
  }
  function collage(ids, cls = '') {
    const keys = [];
    for (const id of ids) {
      const t = L.tracks.get(id);
      const k = t && L.artOf(t);
      if (k && !keys.includes(k)) keys.push(k);
      if (keys.length === 4) break;
    }
    if (keys.length < 4) return art(keys[0] || '', ids[0] || 'lista', cls, 'playlist');
    return `<div class="art collage ${cls}">${keys.map(k => art(k, k)).join('')}</div>`;
  }
  function setArt(el, key, seed) {
    const h = hue(String(seed || key || ''));
    el.style.setProperty('--h1', 250 + h % 45);
    el.style.setProperty('--h2', 22 + (h >> 7) % 28);
    el.innerHTML = icon('note');
    if (key) { el.dataset.art = key; loadArt(el); } else delete el.dataset.art;
  }

  // ---------- Listas de canciones ----------
  const LISTS = new Map();
  let listSeq = 0;
  function regList(ids, from, extra = {}) {
    const id = 'L' + (++listSeq);
    LISTS.set(id, Object.assign({ ids, from }, extra));
    if (LISTS.size > 400) LISTS.delete(LISTS.keys().next().value);
    return id;
  }
  const heartMini = `<span class="heart">${icon('heartFill')}</span>`;

  function rowHTML(t, i, o) {
    const cur = P.current();
    const playing = cur && cur.id === t.id;
    const eqi = '<span class="eqi"><i></i><i></i><i></i></span>';
    const lead = o.mode === 'num'
      ? `<span class="num">${t.trackNo || i + 1}</span>${eqi}`
      : `<span class="art-wrap">${art(L.artOf(t), t.album)}${eqi}</span>`;
    let sub = '';
    if (o.sub === 'artist') sub = o.albumArtist && t.artist === o.albumArtist ? '' : esc(t.artist);
    else if (o.sub === 'album') sub = esc(t.album);
    else if (o.sub !== 'none') sub = `${esc(t.artist)} · ${esc(t.album)}`;
    const liked = S.likes.has(t.id);
    if (liked) sub = heartMini + sub;
    const cls = 'row' + (playing ? ' playing' : '') + (o.mode === 'num' ? ' numbered' : '') + (L.canPlay(t) ? '' : ' unplayable');
    return `<div class="${cls}" data-i="${i}" data-id="${esc(t.id)}" role="button">${lead}<div class="rt"><div class="r1">${esc(t.title)}</div>${sub ? `<div class="r2">${sub}</div>` : ''}</div>${o.dur ? `<span class="dur">${t.duration ? fmt(t.duration) : ''}</span>` : ''}<button class="more" aria-label="Más opciones">${icon('more')}</button></div>`;
  }

  function mountTracks(host) {
    const list = LISTS.get(host.dataset.mount);
    if (!list) return;
    host.dataset.list = host.dataset.mount;
    host.classList.add('tracks');
    const o = { mode: host.dataset.mode || 'art', sub: host.dataset.sub || 'full', dur: host.dataset.dur === '1', albumArtist: list.albumArtist };
    const ids = list.ids;
    const render = i => { const t = L.tracks.get(ids[i]); return t ? rowHTML(t, i, o) : ''; };
    if (ids.length <= 150) { host.innerHTML = ids.map((_, i) => render(i)).join(''); hydrate(host); return; }
    // Lista virtual para bibliotecas grandes
    const sc = host.closest('.scroller');
    const H = 62;
    host.style.position = 'relative';
    host.style.height = ids.length * H + 'px';
    const pool = new Map();
    const tmp = document.createElement('div');
    const update = () => {
      if (!host.isConnected) { sc.removeEventListener('scroll', update); return; }
      const off = host.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
      const top = sc.scrollTop - off;
      const s = Math.max(0, Math.floor(top / H) - 12), e = Math.min(ids.length, Math.ceil((top + sc.clientHeight) / H) + 12);
      for (const [i, el] of pool) if (i < s || i >= e) { el.remove(); pool.delete(i); }
      for (let i = s; i < e; i++) {
        if (pool.has(i)) continue;
        tmp.innerHTML = render(i);
        const el = tmp.firstElementChild;
        if (!el) continue;
        el.style.cssText = `position:absolute;left:0;right:0;top:${i * H}px`;
        host.appendChild(el);
        pool.set(i, el);
      }
      hydrate(host);
    };
    host._scrollTo = i => { const off = host.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop; sc.scrollTop = off + i * H - 60; };
    sc.addEventListener('scroll', update, { passive: true });
    update();
  }

  function markPlaying() {
    const cur = P.current();
    $$('.row.playing').forEach(r => r.classList.remove('playing'));
    if (cur) $$(`.row[data-id="${CSS.escape(cur.id)}"]`).forEach(r => r.classList.add('playing'));
  }

  const actionsBar = lid => `<div class="actions"><button class="primary" data-act="play-list" data-ref="${lid}">${icon('play')}Reproducir</button><button class="glass ghost" data-act="shuffle-list" data-ref="${lid}">${icon('shuffle')}Aleatorio</button></div>`;
  const tracksHost = (lid, mode = 'art', sub = 'full', dur = false) => `<div data-mount="${lid}" data-mode="${mode}" data-sub="${sub}" data-dur="${dur ? 1 : 0}"></div>`;
  const totalDur = ids => ids.reduce((s, id) => s + ((L.tracks.get(id) || {}).duration || 0), 0);

  // ---------- Tarjetas ----------
  const albumCard = al => `<button class="card" data-act="album" data-key="${esc(al.key)}">${art(al.art, al.title, '', 'album')}<div class="card-t">${esc(al.title)}</div><div class="card-s">${esc(al.artist)}</div></button>`;
  const artistCard = ar => `<button class="card circle" data-act="artist" data-key="${esc(ar.key)}">${art(ar.art, ar.name, '', 'artist')}<div class="card-t">${esc(ar.name)}</div></button>`;
  const playlistCard = pl => `<button class="card" data-act="playlist" data-id="${esc(pl.id)}">${collage(pl.ids)}<div class="card-t">${esc(pl.name)}</div><div class="card-s">${plural(pl.ids.length, 'canción', 'canciones')}</div></button>`;
  const section = (title, body, more) => `<div class="section"><div class="section-head"><h2>${esc(title)}</h2>${more ? `<button ${more}>Ver todo</button>` : ''}</div>${body}</div>`;
  const emptyHTML = (ic, title, text, extra = '') => `<div class="empty">${icon(ic)}<b>${esc(title)}</b>${text}${extra ? `<div style="margin-top:18px">${extra}</div>` : ''}</div>`;

  // ---------- Páginas y navegación ----------
  const stacks = { home: [], library: [], playlists: [], search: [] };
  let tab = 'home';
  const top = (t = tab) => stacks[t][stacks[t].length - 1];

  function makePage(def) {
    const el = document.createElement('div');
    el.className = 'page';
    const isRoot = !stacks[def.tab].length;
    el.innerHTML = `<header class="nav">${isRoot ? '' : `<button class="nav-btn back" data-act="back" aria-label="Atrás">${icon('chevL')}<span class="back-label">${esc(def.backLabel || '')}</span></button>`}<span class="spacer"></span><div class="nav-actions"></div><div class="nav-title"></div></header><div class="scroller"></div>`;
    const pg = Object.assign({}, def, { el, nav: $('.nav', el), sc: $('.scroller', el), dirty: false });
    pg.sc.addEventListener('scroll', () => { pg.nav.classList.toggle('scrolled', pg.sc.scrollTop > 8); onPageScroll(pg.sc); }, { passive: true });
    return pg;
  }

  function renderPage(pg) {
    const r = pg.render(pg) || {};
    pg.title = r.title || pg.title || '';
    const nt = $('.nav-title', pg.el), na = $('.nav-actions', pg.el);
    if (nt) nt.textContent = pg.title;
    if (na) na.innerHTML = r.actions || '';
    pg.sc.innerHTML = r.html || '';
    $$('[data-mount]', pg.sc).forEach(mountTracks);
    hydrate(pg.sc);
    if (r.after) r.after(pg);
    updateScan();
    pg.dirty = false;
  }

  function push(def, t = tab) {
    const st = stacks[t];
    const prev = st[st.length - 1];
    def.tab = t;
    def.backLabel = prev ? prev.title : '';
    const pg = makePage(def);
    st.push(pg);
    renderPage(pg);
    const view = $(`.tab-view[data-tab="${t}"]`);
    if (!prev) { view.appendChild(pg.el); return pg; }
    pg.el.classList.add('enter');
    view.appendChild(pg.el);
    void pg.el.offsetWidth;
    pg.el.classList.remove('enter');
    prev.el.classList.add('under');
    return pg;
  }

  function pop(t = tab) {
    const st = stacks[t];
    if (st.length < 2) return false;
    const pg = st.pop();
    const prev = st[st.length - 1];
    prev.el.classList.remove('under');
    if (prev.dirty) { const y = prev.sc.scrollTop; renderPage(prev); prev.sc.scrollTop = y; }
    pg.el.classList.add('leave');
    setTimeout(() => pg.el.remove(), 450);
    return true;
  }

  function popToRoot(t) {
    const st = stacks[t];
    while (st.length > 2) { const p = st.splice(1, 1)[0]; p.el.remove(); }
    pop(t);
  }

  function switchTab(t) {
    if (t === tab) {
      if (stacks[t].length > 1) popToRoot(t);
      else top(t).sc.scrollTo({ top: 0, behavior: 'smooth' });
      if (t === 'search') { const i = $('.search-field input'); if (i) i.focus(); }
      return;
    }
    tab = t;
    $$('.tab-view').forEach(v => { v.hidden = v.dataset.tab !== t; });
    $$('#tabbar [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    document.body.classList.remove('compact');
    moveBlob(true);
    const sb = $('.tab-search');
    if (t === 'search' && sb.animate) sb.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: .4 }, { transform: 'scale(.96)', offset: .75 }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' });
    const pg = top(t);
    if (pg && pg.dirty) { const y = pg.sc.scrollTop; renderPage(pg); pg.sc.scrollTop = y; }
  }

  // Indicador "líquido": se estira hacia la pestaña nueva y vuelve a su forma con un rebote
  let blobPos = null;
  function moveBlob(animate) {
    const blob = $('.tab-blob');
    const btn = $(`.tabs .tab[data-tab="${tab}"]`);
    if (!btn) {
      if (animate && blobPos && blob.animate) blob.animate([{ opacity: 1, transform: `translateX(${blobPos.x}px) scale(1)` }, { opacity: 0, transform: `translateX(${blobPos.x}px) scale(.6)` }], { duration: 260, easing: 'ease-in' });
      blob.style.opacity = '0';
      return;
    }
    const x = btn.offsetLeft - 5, w = btn.offsetWidth;
    const from = blobPos && blob.style.opacity !== '0' ? blobPos : null;
    blob.style.opacity = '1';
    blob.style.width = w + 'px';
    blob.style.transform = `translateX(${x}px)`;
    if (animate && blob.animate) {
      if (from) {
        const left = Math.min(from.x, x), span = Math.max(from.x + from.w, x + w) - left;
        blob.animate([
          { transform: `translateX(${from.x}px) scaleY(1)`, width: from.w + 'px' },
          { transform: `translateX(${left}px) scaleY(.82)`, width: span + 'px', offset: 0.42 },
          { transform: `translateX(${x - (x > from.x ? -6 : 6)}px) scaleY(1.06)`, width: w + 'px', offset: 0.75 },
          { transform: `translateX(${x}px) scaleY(1)`, width: w + 'px' }
        ], { duration: 560, easing: 'cubic-bezier(.3,.7,.3,1)' });
      } else {
        blob.animate([{ opacity: 0, transform: `translateX(${x}px) scale(.6)` }, { opacity: 1, transform: `translateX(${x}px) scale(1)` }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      }
      const ti = $('.ti', btn);
      if (ti.animate) ti.animate([
        { transform: 'scale(1)' }, { transform: 'scale(1.3) translateY(-4px) rotate(-6deg)', offset: 0.35 },
        { transform: 'scale(.92) translateY(1px)', offset: 0.7 }, { transform: 'scale(1)' }
      ], { duration: 560, easing: 'ease-out' });
    }
    blobPos = { x, w };
  }
  window.addEventListener('resize', () => moveBlob(false));

  function ripple(btn, e) {
    if (!btn.animate) return;
    const r = btn.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'ripple';
    const size = Math.max(r.width, r.height) * 1.6;
    el.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left}px;top:${e.clientY - r.top}px`;
    btn.appendChild(el);
    el.animate([{ transform: 'translate(-50%,-50%) scale(0)', opacity: 1 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 600, easing: 'ease-out' }).onfinish = () => el.remove();
  }

  // Al bajar en una lista la barra se compacta; al subir vuelve a su tamaño
  let compactY = 0;
  function onPageScroll(sc) {
    const y = sc.scrollTop, d = y - compactY;
    if (Math.abs(d) < 10) return;
    document.body.classList.toggle('compact', d > 0 && y > 120);
    compactY = y;
  }

  function go(def) {
    if (np.open) closePlayer();
    if (sheets.length) sheets.slice().forEach(s => s.close());
    push(def);
  }

  // Deslizar desde el borde para volver
  (function edgeSwipe() {
    let st = null;
    document.addEventListener('pointerdown', e => {
      if (np.open || sheets.length || e.clientX > 24 || stacks[tab].length < 2 || e.pointerType === 'mouse') return;
      const s = stacks[tab];
      st = { x: e.clientX, y: e.clientY, cur: s[s.length - 1], prev: s[s.length - 2], on: false, id: e.pointerId };
    });
    document.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.on) {
        if (Math.abs(dy) > 14) { st = null; return; }
        if (dx < 10) return;
        st.on = true;
        st.cur.el.style.transition = st.prev.el.style.transition = 'none';
      }
      const w = innerWidth, x = Math.max(0, dx);
      st.cur.el.style.transform = `translate3d(${x}px,0,0)`;
      st.prev.el.style.transform = `translate3d(${-28 + 28 * x / w}%,0,0)`;
      st.prev.el.style.opacity = String(x / w);
      st.dx = x;
    });
    const end = () => {
      if (!st) return;
      const s = st; st = null;
      if (!s.on) return;
      [s.cur.el, s.prev.el].forEach(el => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; });
      if (s.dx > innerWidth * 0.3) pop();
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();

  // ---------- Inicio ----------
  function greeting() {
    const h = new Date().getHours();
    return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }
  const settingsBtn = `<button class="nav-btn round chip" data-act="settings" aria-label="Ajustes">${icon('gear')}</button>`;

  function welcomeHTML() {
    return `<div class="welcome"><img src="icons/glyph.png" alt=""><div class="wordmark">VELUM</div><div class="wordmark-sub">MUSIC</div>
      <p>Elige la carpeta donde guardas tu música. Velum la reconoce sola: canciones, álbumes, artistas, carátulas, letras (.lrc) y listas (.m3u).</p>
      <div class="actions"><button class="primary" data-act="add-folder">${icon('folder')}Elegir carpeta de música</button></div>
      <small>${native ? 'Se abrirá el selector de Android. Elige tu carpeta (por ejemplo “Music” o “Download”) y toca “Usar esta carpeta”.' : L.supportsHandles ? 'Tu navegador recordará la carpeta. Todo se queda en tu dispositivo.' : 'Tu música no sale de tu dispositivo.'}</small></div>`;
  }

  function reconnectHTML() {
    const need = L.roots.filter(r => r.needsPermission);
    if (!need.length) return '';
    return `<div class="hero glass" style="margin-top:10px"><div class="hero-t"><small>Carpeta desconectada</small><b>${esc(need.map(r => r.name).join(', '))}</b><span>Toca para volver a dar acceso a tu música</span></div><button class="play-fab" data-act="reconnect" aria-label="Reconectar">${icon('refresh')}</button></div>`;
  }

  function seeded(arr, seed) {
    const a = arr.slice();
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function renderHome() {
    let html = `<h1 class="large-title brand-title"><img src="icons/glyph.png" alt="">Inicio</h1><p class="subtitle">${greeting()}</p><div class="scan-slot"></div>${reconnectHTML()}`;
    if (!L.roots.length && !L.tracks.size) return { title: 'Inicio', actions: settingsBtn, html: html + welcomeHTML() };
    if (!L.sorted.length) {
      if (!L.scanning) html += emptyHTML('note', 'No encontramos canciones', 'Asegúrate de elegir la carpeta donde guardas tu música (MP3, M4A, FLAC, OGG, OPUS o WAV).', `<button class="chip on" data-act="add-folder">Elegir otra carpeta</button>`);
      return { title: 'Inicio', actions: settingsBtn, html };
    }
    const cur = P.current();
    if (cur) {
      html += `<div class="hero glass" data-act="open-player"><div class="hero-art">${art(L.artOf(cur), cur.album)}</div><div class="hero-t"><small>${P.playing ? 'Sonando ahora' : 'Continuar escuchando'}</small><b>${esc(cur.title)}</b><span>${esc(cur.artist)}</span></div><button class="play-fab hero-play" data-act="toggle" aria-label="Reproducir">${icon(P.playing ? 'pause' : 'play')}</button></div>`;
    }
    html += `<div class="section"><div class="quick">
      <button class="glass" data-act="shuffle-all"><span class="qi">${icon('shuffle')}</span><b>Aleatorio</b></button>
      <button class="glass" data-act="smart" data-id="liked"><span class="qi">${icon('heartFill')}</span><b>Me gusta</b></button>
      <button class="glass" data-act="smart" data-id="top"><span class="qi">${icon('flame')}</span><b>Tu top</b></button>
      <button class="glass" data-act="smart" data-id="added"><span class="qi">${icon('sparkles')}</span><b>Agregadas</b></button></div></div>`;

    const recentAlbums = [];
    const seen = new Set();
    for (const h of S.history) {
      const t = L.tracks.get(h.id);
      if (!t || seen.has(t.albumKey)) continue;
      seen.add(t.albumKey);
      const al = L.albums.get(t.albumKey);
      if (al) recentAlbums.push(al);
      if (recentAlbums.length >= 12) break;
    }
    if (recentAlbums.length) html += section('Escuchado recientemente', `<div class="carousel">${recentAlbums.map(albumCard).join('')}</div>`);

    const albums = Array.from(L.albums.values());
    const now = new Date();
    const daily = seeded(albums, now.getFullYear() * 400 + now.getMonth() * 32 + now.getDate()).slice(0, 10);
    if (daily.length > 2) html += section('Para hoy', `<div class="carousel">${daily.map(albumCard).join('')}</div>`);

    const topIds = smartIds('top').slice(0, 5);
    if (topIds.length) html += `<div class="section"><div class="section-head"><h2>Tus favoritas</h2><button data-act="smart" data-id="top">Ver todo</button></div>${tracksHost(regList(topIds, { label: 'Más escuchadas', type: 'smart', id: 'top' }))}</div>`;

    const added = albums.slice().sort((a, b) => b.added - a.added).slice(0, 12);
    html += section('Agregado recientemente', `<div class="carousel">${added.map(albumCard).join('')}</div>`, 'data-act="albums" data-sort="added"');

    const artists = Array.from(L.artists.values()).sort((a, b) => b.ids.length - a.ids.length).slice(0, 14);
    if (artists.length > 1) html += section('Artistas', `<div class="carousel">${artists.map(artistCard).join('')}</div>`, 'data-act="artists"');

    html += section('Tu semana', statsCard());
    return { title: 'Inicio', actions: settingsBtn, html };
  }

  function weekStats() {
    const days = [];
    const names = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      days.push({ label: names[d.getDay()], sec: S.stats[dayKey(d)] || 0 });
    }
    return days;
  }
  function statsCard() {
    const days = weekStats();
    const total = days.reduce((s, d) => s + d.sec, 0);
    const max = Math.max(60, ...days.map(d => d.sec));
    return `<div class="stats-card glass" data-act="stats"><div class="big">${fmtLong(total)}<small>escuchados en 7 días</small></div><div class="bars">${days.map(d => `<div><i style="height:${Math.max(3, d.sec / max * 100)}%"></i><span>${d.label}</span></div>`).join('')}</div></div>`;
  }

  // ---------- Biblioteca ----------
  function renderLibrary() {
    const n = L.sorted.length;
    const rows = [
      ['playlists-tab', 'playlist', 'Listas', S.playlists.length + L.filePlaylists.length],
      ['artists', 'artist', 'Artistas', L.artists.size],
      ['albums', 'album', 'Álbumes', L.albums.size],
      ['songs', 'note', 'Canciones', n],
      ['genres', 'genre', 'Géneros', L.genres.size],
      ['folders', 'folder', 'Carpetas', L.roots.length],
      ['smart:liked', 'heartFill', 'Me gusta', S.likes.size]
    ];
    let html = `<h1 class="large-title">Biblioteca</h1><div class="scan-slot"></div>${reconnectHTML()}`;
    if (!L.roots.length && !L.tracks.size) return { title: 'Biblioteca', actions: settingsBtn, html: html + welcomeHTML() };
    html += `<div class="list glass" style="margin-top:10px">${rows.map(([act, ic, label, count]) => {
      const [a, id] = act.split(':');
      return `<button class="list-row" data-act="${a}"${id ? ` data-id="${id}"` : ''}><span class="li">${icon(ic)}</span><span class="lt">${label}</span><span class="lv">${count ? count.toLocaleString('es') : ''}</span><span class="chev">${icon('chevR')}</span></button>`;
    }).join('')}</div>`;
    const added = Array.from(L.albums.values()).sort((a, b) => b.added - a.added).slice(0, 12);
    if (added.length) html += section('Agregado recientemente', `<div class="grid">${added.map(albumCard).join('')}</div>`, 'data-act="albums" data-sort="added"');
    return { title: 'Biblioteca', actions: settingsBtn, html };
  }

  // ---------- Listas ----------
  function smartIds(id) {
    if (id === 'liked') return Array.from(S.likes).reverse().filter(x => L.tracks.has(x));
    if (id === 'top') return Object.entries(S.plays).filter(([k, v]) => v.n > 0 && L.tracks.has(k)).sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last).slice(0, 100).map(e => e[0]);
    if (id === 'recent') { const seen = new Set(); return S.history.map(h => h.id).filter(x => !seen.has(x) && L.tracks.has(x) && seen.add(x)).slice(0, 100); }
    if (id === 'added') return L.sorted.slice().sort((a, b) => L.tracks.get(b).added - L.tracks.get(a).added).slice(0, 100);
    return [];
  }
  const SMART = {
    liked: { name: 'Me gusta', icon: 'heartFill', empty: 'Toca el corazón en cualquier canción para guardarla aquí.' },
    top: { name: 'Más escuchadas', icon: 'flame', empty: 'Escucha música y aquí aparecerán tus favoritas.' },
    recent: { name: 'Escuchadas recientemente', icon: 'clock', empty: 'Aún no has escuchado nada.' },
    added: { name: 'Agregadas recientemente', icon: 'sparkles', empty: 'No hay canciones nuevas.' }
  };

  function renderPlaylists() {
    const actions = `<button class="nav-btn round chip" data-act="new-playlist" aria-label="Nueva lista">${icon('plus')}</button>`;
    let html = `<h1 class="large-title">Listas</h1>`;
    html += `<div class="list glass" style="margin-top:10px">${Object.entries(SMART).map(([k, s]) => `<button class="list-row" data-act="smart" data-id="${k}"><span class="li">${icon(s.icon)}</span><span class="lt">${s.name}</span><span class="lv">${smartIds(k).length || ''}</span><span class="chev">${icon('chevR')}</span></button>`).join('')}</div>`;
    const newCard = `<button class="card" data-act="new-playlist"><div class="art" style="--h1:265;--h2:40">${icon('plus')}</div><div class="card-t">Nueva lista</div><div class="card-s">Crea tu propia lista</div></button>`;
    html += section('Tus listas', `<div class="grid">${newCard}${S.playlists.map(playlistCard).join('')}</div>`);
    if (L.filePlaylists.length) html += section('De tu carpeta', `<div class="grid">${L.filePlaylists.map(playlistCard).join('')}</div>`);
    return { title: 'Listas', actions, html };
  }

  const findPlaylist = id => S.playlists.find(p => p.id === id) || L.filePlaylists.find(p => p.id === id);

  function renderPlaylist(pg) {
    const pl = findPlaylist(pg.id);
    if (!pl) return { title: 'Lista', html: emptyHTML('playlist', 'Esta lista ya no existe', '') };
    const ids = pl.ids.filter(id => L.tracks.has(id));
    const lid = regList(ids, { label: pl.name, type: 'playlist', id: pl.id }, { playlistId: pl.file ? null : pl.id });
    const actions = pl.file ? '' : `<button class="nav-btn round chip" data-act="pl-more" data-id="${esc(pl.id)}" aria-label="Opciones">${icon('more')}</button>`;
    let html = `<div class="cover-head">${collage(ids)}<h1>${esc(pl.name)}</h1><div class="cm">${plural(ids.length, 'canción', 'canciones')}${ids.length ? ' · ' + fmtLong(totalDur(ids)) : ''}${pl.file ? ' · archivo .m3u' : ''}</div></div>`;
    if (!ids.length) html += emptyHTML('addList', 'Lista vacía', 'Agrega canciones desde el menú ⋯ de cualquier canción.');
    else html += actionsBar(lid) + tracksHost(lid, 'art', 'full', true);
    return { title: pl.name, actions, html };
  }

  function renderSmart(pg) {
    const s = SMART[pg.id];
    const ids = smartIds(pg.id);
    const lid = regList(ids, { label: s.name, type: 'smart', id: pg.id });
    let html = `<div class="cover-head"><div class="art" style="--h1:262;--h2:38">${icon(s.icon)}</div><h1>${s.name}</h1><div class="cm">${plural(ids.length, 'canción', 'canciones')}</div></div>`;
    html += ids.length ? actionsBar(lid) + tracksHost(lid, 'art', 'full', pg.id !== 'top') : emptyHTML(s.icon, 'Nada por aquí', s.empty);
    if (pg.id === 'top' && ids.length) {
      // muestra cuántas veces se escuchó
      return { title: s.name, html, after: p => $$('.row', p.sc).forEach(r => { const n = (S.plays[r.dataset.id] || {}).n; const d = document.createElement('span'); d.className = 'dur'; d.textContent = n ? n + '×' : ''; r.insertBefore(d, $('.more', r)); }) };
    }
    return { title: s.name, html };
  }

  // ---------- Canciones / álbumes / artistas / géneros / carpetas ----------
  const SONG_SORTS = { title: 'Título', artist: 'Artista', album: 'Álbum', added: 'Agregadas recientemente', duration: 'Duración', plays: 'Más reproducidas' };
  function sortedSongs(by) {
    const ids = L.sorted.slice();
    const T = id => L.tracks.get(id);
    const c = L.collator.compare;
    if (by === 'artist') ids.sort((a, b) => c(T(a).artist, T(b).artist) || c(T(a).album, T(b).album) || (T(a).trackNo - T(b).trackNo));
    else if (by === 'album') ids.sort((a, b) => c(T(a).album, T(b).album) || (T(a).discNo - T(b).discNo) || (T(a).trackNo - T(b).trackNo));
    else if (by === 'added') ids.sort((a, b) => T(b).added - T(a).added);
    else if (by === 'duration') ids.sort((a, b) => T(b).duration - T(a).duration);
    else if (by === 'plays') ids.sort((a, b) => ((S.plays[b] || {}).n || 0) - ((S.plays[a] || {}).n || 0));
    return ids;
  }
  const letterOf = s => { const ch = L.norm(s).charAt(0).toUpperCase(); return /[A-ZÑ]/.test(ch) ? ch : '#'; };

  function renderSongs() {
    const by = S.settings.songSort;
    const ids = sortedSongs(by);
    const lid = regList(ids, { label: 'Canciones', type: 'songs' });
    const actions = `<button class="nav-btn chip" data-act="sort-songs">${icon('sort')}</button>`;
    let html = `<h1 class="large-title">Canciones</h1><p class="subtitle">${plural(ids.length, 'canción', 'canciones')} · ${SONG_SORTS[by]}</p>${ids.length ? actionsBar(lid) : ''}${tracksHost(lid, 'art', 'full', by === 'duration')}`;
    if (!ids.length) html += emptyHTML('note', 'Sin canciones', 'Agrega una carpeta de música desde Ajustes.');
    const after = pg => {
      if (!(by === 'title' || by === 'artist') || ids.length < 40) return;
      const first = {};
      ids.forEach((id, i) => { const t = L.tracks.get(id); const l = letterOf(by === 'title' ? t.title : t.artist); if (!(l in first)) first[l] = i; });
      const letters = Object.keys(first);
      const az = document.createElement('div');
      az.className = 'az';
      az.innerHTML = letters.map(l => `<span>${l}</span>`).join('');
      pg.el.appendChild(az);
      const host = $('[data-list]', pg.sc);
      const jump = e => {
        const r = az.getBoundingClientRect();
        const k = Math.max(0, Math.min(letters.length - 1, Math.floor((e.clientY - r.top) / r.height * letters.length)));
        const idx = first[letters[k]];
        if (host._scrollTo) host._scrollTo(idx);
        else { const row = $(`.row[data-i="${idx}"]`, host); if (row) pg.sc.scrollTop += row.getBoundingClientRect().top - pg.sc.getBoundingClientRect().top - 110; }
        if (k !== az._k) { az._k = k; haptic(); }
      };
      az.addEventListener('pointerdown', e => { az.setPointerCapture(e.pointerId); jump(e); });
      az.addEventListener('pointermove', e => { if (az.hasPointerCapture(e.pointerId)) jump(e); });
    };
    return { title: 'Canciones', actions, html, after };
  }

  const ALBUM_SORTS = { title: 'Título', artist: 'Artista', year: 'Año', added: 'Agregados recientemente' };
  function renderAlbums(pg) {
    const by = pg.sort || S.settings.albumSort;
    const c = L.collator.compare;
    const list = Array.from(L.albums.values());
    if (by === 'artist') list.sort((a, b) => c(a.artist, b.artist) || c(a.title, b.title));
    else if (by === 'year') list.sort((a, b) => (b.year || 0) - (a.year || 0));
    else if (by === 'added') list.sort((a, b) => b.added - a.added);
    else list.sort((a, b) => c(a.title, b.title));
    const actions = `<button class="nav-btn chip" data-act="sort-albums">${icon('sort')}</button>`;
    return { title: 'Álbumes', actions, html: `<h1 class="large-title">Álbumes</h1><p class="subtitle">${plural(list.length, 'álbum', 'álbumes')} · ${ALBUM_SORTS[by]}</p><div class="grid">${list.map(albumCard).join('')}</div>` };
  }

  function renderArtists() {
    const list = Array.from(L.artists.values()).sort((a, b) => L.collator.compare(a.name, b.name));
    const rows = list.map(ar => `<button class="list-row" data-act="artist" data-key="${esc(ar.key)}" style="min-height:64px">${art(ar.art, ar.name, 'avatar', 'artist')}<span class="lt">${esc(ar.name)}</span><span class="lv">${ar.ids.length}</span><span class="chev">${icon('chevR')}</span></button>`).join('');
    return { title: 'Artistas', html: `<h1 class="large-title">Artistas</h1><p class="subtitle">${plural(list.length, 'artista', 'artistas')}</p><div class="list glass">${rows}</div>` };
  }

  function renderGenres() {
    const list = Array.from(L.genres.values()).sort((a, b) => b.ids.length - a.ids.length);
    const html = list.length
      ? `<div class="browse">${list.map(g => `<button data-act="genre" data-key="${esc(g.key)}" style="--h:${200 + hue(g.name) % 160}"><b>${esc(g.name)}</b>${art(g.art, g.name)}</button>`).join('')}</div>`
      : emptyHTML('genre', 'Sin géneros', 'Tus canciones no tienen el género en sus etiquetas.');
    return { title: 'Géneros', html: `<h1 class="large-title">Géneros</h1><p class="subtitle">${plural(list.length, 'género', 'géneros')}</p>${html}` };
  }

  function renderFolder(pg) {
    const base = pg.path || '';
    const subs = new Map();
    const direct = [];
    for (const id of L.sorted) {
      const t = L.tracks.get(id);
      if (base && !(t.folder === base || t.folder.startsWith(base + '/'))) continue;
      if (t.folder === base) { direct.push(id); continue; }
      const rest = base ? t.folder.slice(base.length + 1) : t.folder;
      const name = rest.split('/')[0];
      const key = base ? base + '/' + name : name;
      const s = subs.get(key) || { name, count: 0, art: '' };
      s.count++;
      if (!s.art) s.art = L.artOf(t);
      subs.set(key, s);
    }
    direct.sort((a, b) => L.collator.compare(L.tracks.get(a).name, L.tracks.get(b).name));
    const title = base ? L.baseOf(base) : 'Carpetas';
    let html = `<h1 class="large-title">${esc(title)}</h1><p class="subtitle">${base ? esc(base) : 'Explora tu música tal como está guardada'}</p>`;
    const sorted = Array.from(subs.entries()).sort((a, b) => L.collator.compare(a[1].name, b[1].name));
    if (sorted.length) html += `<div class="list glass">${sorted.map(([k, s]) => `<button class="list-row" data-act="folder" data-path="${esc(k)}"><span class="li">${icon('folder')}</span><span class="lt">${esc(s.name)}</span><span class="lv">${s.count}</span><span class="chev">${icon('chevR')}</span></button>`).join('')}</div>`;
    if (direct.length) {
      const lid = regList(direct, { label: title, type: 'folder', id: base });
      html += actionsBar(lid) + tracksHost(lid, 'art', 'full', true);
    }
    if (!sorted.length && !direct.length) html += emptyHTML('folder', 'Carpeta vacía', '');
    return { title, html };
  }

  function renderAlbum(pg) {
    const al = L.albums.get(pg.key);
    if (!al) return { title: 'Álbum', html: emptyHTML('album', 'Álbum no encontrado', '') };
    const lid = regList(al.ids, { label: al.title, type: 'album', id: al.key }, { albumArtist: al.artist });
    const discs = new Set(al.ids.map(id => L.tracks.get(id).discNo || 1));
    const meta = [al.genre, al.year].filter(Boolean).join(' · ');
    let html = `<div class="cover-head">${art(al.art, al.title, '', 'album')}<h1>${esc(al.title)}</h1><button class="ca" data-act="artist" data-key="${esc(L.norm(al.artist))}">${esc(al.artist)}</button>${meta ? `<div class="cm">${esc(meta)}</div>` : ''}</div>${actionsBar(lid)}`;
    if (discs.size > 1) {
      // Un bloque por disco
      const byDisc = {};
      al.ids.forEach(id => { const d = L.tracks.get(id).discNo || 1; (byDisc[d] = byDisc[d] || []).push(id); });
      for (const d of Object.keys(byDisc).sort((a, b) => a - b)) {
        const l2 = regList(al.ids, { label: al.title, type: 'album', id: al.key }, { albumArtist: al.artist });
        html += `<div class="group-label">Disco ${d}</div>` + `<div data-mount="${l2}" data-mode="num" data-sub="artist" data-dur="1" data-disc="${d}"></div>`;
      }
    } else html += tracksHost(lid, 'num', 'artist', true);
    html += `<div class="foot-note">${plural(al.ids.length, 'canción', 'canciones')}, ${fmtLong(totalDur(al.ids))}</div>`;
    const ar = L.artists.get(L.norm(al.artist));
    if (ar) {
      const more = Array.from(ar.albums).filter(k => k !== al.key).map(k => L.albums.get(k)).filter(Boolean);
      if (more.length) html += section('Más de ' + al.artist, `<div class="carousel">${more.map(albumCard).join('')}</div>`);
    }
    const after = p => {
      // en álbumes con varios discos, oculta las filas que no son de ese disco
      $$('[data-disc]', p.sc).forEach(h => $$('.row', h).forEach(r => { if (String(L.tracks.get(r.dataset.id).discNo || 1) !== h.dataset.disc) r.remove(); }));
    };
    return { title: al.title, html, after };
  }

  function renderArtist(pg) {
    const ar = L.artists.get(pg.key);
    if (!ar) return { title: 'Artista', html: emptyHTML('artist', 'Artista no encontrado', '') };
    const ids = ar.ids.slice().sort((a, b) => L.collator.compare(L.tracks.get(a).title, L.tracks.get(b).title));
    const lid = regList(ids, { label: ar.name, type: 'artist', id: ar.key });
    const albums = Array.from(ar.albums).map(k => L.albums.get(k)).filter(Boolean).sort((a, b) => (b.year || 0) - (a.year || 0));
    let html = `<div class="cover-head circle">${art(ar.art, ar.name, '', 'artist')}<h1>${esc(ar.name)}</h1><div class="cm">${plural(albums.length, 'álbum', 'álbumes')} · ${plural(ids.length, 'canción', 'canciones')}</div></div>${actionsBar(lid)}`;
    const popular = ids.filter(id => (S.plays[id] || {}).n).sort((a, b) => S.plays[b].n - S.plays[a].n).slice(0, 5);
    if (popular.length) html += `<div class="section"><div class="section-head"><h2>Populares</h2></div>${tracksHost(regList(popular, { label: ar.name, type: 'artist', id: ar.key }), 'art', 'album')}</div>`;
    if (albums.length) html += section('Álbumes', `<div class="carousel">${albums.map(albumCard).join('')}</div>`);
    html += `<div class="section"><div class="section-head"><h2>Canciones</h2></div>${tracksHost(lid, 'art', 'album', true)}</div>`;
    return { title: ar.name, html };
  }

  function renderGenre(pg) {
    const g = L.genres.get(pg.key);
    if (!g) return { title: 'Género', html: emptyHTML('genre', 'Género no encontrado', '') };
    const lid = regList(g.ids, { label: g.name, type: 'genre', id: g.key });
    const albums = Array.from(new Set(g.ids.map(id => L.tracks.get(id).albumKey))).map(k => L.albums.get(k)).filter(Boolean);
    let html = `<h1 class="large-title">${esc(g.name)}</h1><p class="subtitle">${plural(g.ids.length, 'canción', 'canciones')}</p>${actionsBar(lid)}`;
    if (albums.length > 1) html += section('Álbumes', `<div class="carousel">${albums.map(albumCard).join('')}</div>`);
    html += `<div class="section">${tracksHost(lid)}</div>`;
    return { title: g.name, html };
  }

  function renderTrackList(pg) {
    const lid = regList(pg.ids, pg.from);
    return { title: pg.title, html: `<h1 class="large-title">${esc(pg.title)}</h1>${actionsBar(lid)}${tracksHost(lid)}` };
  }

  // ---------- Búsqueda ----------
  let searchQ = '';
  function renderSearch(pg) {
    const res = L.search(searchQ);
    let html = '';
    if (!res) {
      if (S.recent.length) {
        html += `<div class="section-head" style="margin-top:6px"><h2>Recientes</h2><button data-act="clear-recent">Borrar</button></div>${S.recent.map(q => `<button class="recent-q" data-act="search-recent" data-q="${esc(q)}">${icon('clock')}<span>${esc(q)}</span></button>`).join('')}`;
      }
      const genres = Array.from(L.genres.values()).sort((a, b) => b.ids.length - a.ids.length).slice(0, 10);
      if (genres.length) html += section('Explorar', `<div class="browse">${genres.map(g => `<button data-act="genre" data-key="${esc(g.key)}" style="--h:${200 + hue(g.name) % 160}"><b>${esc(g.name)}</b>${art(g.art, g.name)}</button>`).join('')}</div>`);
      else if (!S.recent.length) html += emptyHTML('search', 'Busca en tu música', 'Canciones, álbumes y artistas.');
      return { html };
    }
    const { songs, albums, artists } = res;
    const pls = S.playlists.concat(L.filePlaylists).filter(p => L.norm(p.name).includes(L.norm(searchQ)));
    if (!songs.length && !albums.length && !artists.length && !pls.length) return { html: emptyHTML('search', 'Sin resultados', `No encontramos “${esc(searchQ)}”.`) };
    const n = L.norm(searchQ);
    let topRes = '';
    if (artists[0] && L.norm(artists[0].name).startsWith(n)) topRes = `<button class="top-result glass circle" data-act="artist" data-key="${esc(artists[0].key)}" data-save="1">${art(artists[0].art, artists[0].name, '', 'artist')}<div><b>${esc(artists[0].name)}</b><span>Artista · ${plural(artists[0].ids.length, 'canción', 'canciones')}</span></div></button>`;
    else if (albums[0] && L.norm(albums[0].title).startsWith(n)) topRes = `<button class="top-result glass" data-act="album" data-key="${esc(albums[0].key)}" data-save="1">${art(albums[0].art, albums[0].title, '', 'album')}<div><b>${esc(albums[0].title)}</b><span>Álbum · ${esc(albums[0].artist)}</span></div></button>`;
    if (topRes) html += `<div class="section" style="margin-top:4px"><div class="section-head"><h2>Mejor resultado</h2></div>${topRes}</div>`;
    if (songs.length) {
      const ids = songs.map(t => t.id);
      const lid = regList(ids.slice(0, 8), { label: 'Búsqueda', type: 'search' });
      const all = ids.length > 8 ? `data-act="see-all" data-ref="${regList(ids, { label: 'Búsqueda: ' + searchQ, type: 'search' })}" data-title="${esc(searchQ)}"` : '';
      html += `<div class="section"><div class="section-head"><h2>Canciones</h2>${all ? `<button ${all}>Ver todo</button>` : ''}</div>${tracksHost(lid)}</div>`;
    }
    if (albums.length) html += section('Álbumes', `<div class="carousel">${albums.slice(0, 20).map(albumCard).join('')}</div>`);
    if (artists.length) html += section('Artistas', `<div class="carousel">${artists.slice(0, 20).map(artistCard).join('')}</div>`);
    if (pls.length) html += section('Listas', `<div class="carousel">${pls.map(playlistCard).join('')}</div>`);
    return { html };
  }

  function buildSearchPage() {
    const pg = push({ render: renderSearch, title: 'Buscar' }, 'search');
    pg.el.classList.add('search-page');
    const bar = document.createElement('div');
    bar.className = 'search-bar';
    bar.innerHTML = `<h1>Buscar</h1><label class="search-field glass">${icon('search')}<input type="search" placeholder="Canciones, artistas, álbumes" autocomplete="off" enterkeyhint="search" spellcheck="false"><button class="clear" hidden aria-label="Borrar">${icon('x')}</button></label>`;
    pg.nav.replaceWith(bar);
    pg.nav = bar;
    const input = $('input', bar), clear = $('.clear', bar);
    let t;
    input.addEventListener('input', () => {
      clear.hidden = !input.value;
      clearTimeout(t);
      t = setTimeout(() => { searchQ = input.value.trim(); renderPage(pg); pg.sc.scrollTop = 0; }, 140);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { saveRecent(); input.blur(); } });
    clear.addEventListener('click', e => { e.preventDefault(); input.value = ''; searchQ = ''; clear.hidden = true; renderPage(pg); input.focus(); });
    pg.sc.addEventListener('scroll', () => { if (document.activeElement === input) input.blur(); }, { passive: true });
    pg.searchInput = input;
  }
  function saveRecent() {
    const q = searchQ.trim();
    if (!q) return;
    S.recent = [q].concat(S.recent.filter(x => x.toLowerCase() !== q.toLowerCase())).slice(0, 8);
    persist.recent();
  }

  // ---------- Ajustes ----------
  function toggleRow(key, label, ic, note) {
    return `<div class="list-row"><span class="li">${icon(ic)}</span><span class="lt">${label}</span><button class="switch ${S.settings[key] ? 'on' : ''}" data-act="toggle-setting" data-key="${key}" aria-label="${esc(label)}"></button></div>${note || ''}`;
  }
  function renderSettings() {
    const folderRows = L.roots.map(r => {
      const count = L.sorted.filter(id => id.startsWith(r.name + '/')).length;
      return `<div class="list-row"${r.needsPermission ? ' data-act="reconnect"' : ''}><span class="li">${icon(r.needsPermission ? 'lock' : 'folder')}</span><span class="lt">${esc(r.name)}</span><span class="lv">${r.needsPermission ? 'Reconectar' : plural(count, 'canción', 'canciones')}</span><button class="icon-btn" style="width:36px;height:36px;color:var(--ink-3)" data-act="remove-folder" data-id="${esc(r.id)}" aria-label="Quitar carpeta">${icon('x')}</button></div>`;
    }).join('');
    const eq = S.settings.eq;
    const eqLabel = eq.on ? (P.EQ_PRESETS[eq.preset] ? P.EQ_PRESETS[eq.preset].name : 'Personalizado') : 'Desactivado';
    let html = `<h1 class="large-title">Ajustes</h1><div class="scan-slot"></div>
      <div class="group-label">Carpetas de música</div>
      <div class="list glass">${folderRows}
        <button class="list-row" data-act="add-folder"><span class="li">${icon('plus')}</span><span class="lt">Agregar carpeta</span></button>
        <button class="list-row" data-act="rescan"><span class="li">${icon('refresh')}</span><span class="lt">Buscar música nueva</span><span class="lv">${plural(L.sorted.length, 'canción', 'canciones')}</span></button>
      </div>
      <div class="group-note">Velum lee MP3, M4A/AAC, FLAC, OGG, OPUS y WAV con sus carátulas. Las letras se toman de archivos .lrc con el mismo nombre de la canción y las listas de archivos .m3u.</div>

      <div class="group-label">Apariencia</div>
      <div class="list glass"><div class="themes">${Object.entries(THEMES).map(([k, t]) => `<button class="theme-sw ${S.settings.theme === k ? 'on' : ''}" data-act="theme" data-id="${k}" style="--sw-dot:${t.dot};--sw-glow:${t.glow}"><i style="background:${t.sw}"></i>${t.name}</button>`).join('')}</div></div>

      <div class="group-label">Reproducción</div>
      <div class="list glass">
        <div class="range-row"><div class="rr-top"><span>Fundido entre canciones</span><span class="cf-val">${S.settings.crossfade ? S.settings.crossfade + ' s' : 'Desactivado'}</span></div><div class="slider cf-slider"><div class="track"><i class="fill"></i></div><i class="knob"></i></div></div>
        ${toggleRow('gapless', 'Sin pausas entre canciones', 'infinity')}
        ${toggleRow('autoplay', 'Reproducción automática', 'sparkles')}
        <button class="list-row" data-act="speed"><span class="li">${icon('speed')}</span><span class="lt">Velocidad</span><span class="lv">${S.settings.speed}×</span><span class="chev">${icon('chevR')}</span></button>
        <button class="list-row" data-act="sleep"><span class="li">${icon('moon')}</span><span class="lt">Temporizador</span><span class="lv">${sleepLabel()}</span><span class="chev">${icon('chevR')}</span></button>
      </div>
      <div class="group-note">La reproducción automática agrega canciones parecidas cuando termina la cola.</div>

      <div class="group-label">Sonido</div>
      <div class="list glass">
        <button class="list-row" data-act="eq"><span class="li">${icon('eq')}</span><span class="lt">Ecualizador</span><span class="lv">${eqLabel}</span><span class="chev">${icon('chevR')}</span></button>
        ${toggleRow('engine', 'Motor de audio avanzado', 'sliders')}
      </div>
      <div class="group-note">El motor avanzado permite el ecualizador y el fundido. Si algún teléfono deja de sonar en segundo plano, desactívalo.</div>

      <div class="group-label">Biblioteca</div>
      <div class="list glass">
        ${toggleRow('hideShort', 'Ocultar audios de menos de 1 min', 'clock')}
        ${toggleRow('haptics', 'Vibración al tocar', 'vibrate')}
        <button class="list-row" data-act="stats"><span class="li">${icon('chart')}</span><span class="lt">Estadísticas</span><span class="chev">${icon('chevR')}</span></button>
      </div>

      <div class="group-label">Datos</div>
      <div class="list glass">
        <button class="list-row" data-act="clear-cache"><span class="li">${icon('refresh')}</span><span class="lt">Volver a leer etiquetas y carátulas</span></button>
        <button class="list-row danger" data-act="reset-stats"><span class="li" style="color:#ff7a8a">${icon('trash')}</span><span class="lt">Borrar historial y estadísticas</span></button>
      </div>
      <div class="welcome" style="min-height:0;padding:34px 20px 10px"><img src="icons/glyph.png" alt="" style="width:64px;height:64px"><div class="wordmark" style="font-size:22px">VELUM</div><div class="wordmark-sub">MUSIC · 1.0</div><small>Tu música se queda en tu dispositivo.</small></div>`;
    const after = pg => {
      const el = $('.cf-slider', pg.sc);
      setSlider(el, S.settings.crossfade / 12);
      slider(el, {
        input: r => { const v = Math.round(r * 12); $('.cf-val', pg.sc).textContent = v ? v + ' s' : 'Desactivado'; setSlider(el, v / 12); },
        commit: r => { S.settings.crossfade = Math.round(r * 12); persist.settings(); P.prepareAudio(); if (S.settings.crossfade && !S.settings.engine) toast('Activa el motor de audio avanzado para el fundido', 'info'); }
      });
    };
    return { title: 'Ajustes', html, after };
  }

  function renderStats() {
    const days = weekStats();
    const week = days.reduce((s, d) => s + d.sec, 0);
    const all = Object.values(S.stats).reduce((s, v) => s + v, 0);
    const topSongs = smartIds('top').slice(0, 10);
    const artistPlays = {};
    for (const [id, v] of Object.entries(S.plays)) { const t = L.tracks.get(id); if (t) artistPlays[t.artistKey] = (artistPlays[t.artistKey] || 0) + v.n; }
    const topArtists = Object.entries(artistPlays).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => ({ ar: L.artists.get(k), n })).filter(x => x.ar);
    const size = Array.from(L.tracks.values()).reduce((s, t) => s + t.size, 0);
    const libDur = Array.from(L.tracks.values()).reduce((s, t) => s + (t.duration || 0), 0);
    let html = `<h1 class="large-title">Estadísticas</h1><div class="section" style="margin-top:12px">${statsCard()}</div>
      <div class="group-label">Resumen</div><div class="list glass">
        <div class="list-row"><span class="li">${icon('clock')}</span><span class="lt">Esta semana</span><span class="lv">${fmtLong(week)}</span></div>
        <div class="list-row"><span class="li">${icon('chart')}</span><span class="lt">En total</span><span class="lv">${fmtLong(all)}</span></div>
        <div class="list-row"><span class="li">${icon('note')}</span><span class="lt">Canciones</span><span class="lv">${L.sorted.length.toLocaleString('es')}</span></div>
        <div class="list-row"><span class="li">${icon('album')}</span><span class="lt">Álbumes</span><span class="lv">${L.albums.size.toLocaleString('es')}</span></div>
        <div class="list-row"><span class="li">${icon('artist')}</span><span class="lt">Artistas</span><span class="lv">${L.artists.size.toLocaleString('es')}</span></div>
        <div class="list-row"><span class="li">${icon('folder')}</span><span class="lt">Tamaño de la biblioteca</span><span class="lv">${(size / 1073741824).toFixed(2)} GB · ${fmtLong(libDur)}</span></div>
      </div>`;
    if (topArtists.length) html += section('Artistas más escuchados', `<div class="carousel">${topArtists.map(x => artistCard(x.ar).replace('</button>', `<div class="card-s">${plural(x.n, 'reproducción', 'reproducciones')}</div></button>`)).join('')}</div>`);
    if (topSongs.length) html += `<div class="section"><div class="section-head"><h2>Canciones más escuchadas</h2></div>${tracksHost(regList(topSongs, { label: 'Más escuchadas', type: 'smart', id: 'top' }))}</div>`;
    return { title: 'Estadísticas', html };
  }

  // ---------- Deslizadores ----------
  function setSlider(el, r) {
    r = Math.max(0, Math.min(1, r || 0));
    $('.fill', el).style.width = r * 100 + '%';
    $('.knob', el).style.left = r * 100 + '%';
  }
  function slider(el, { input, commit }) {
    const ratio = e => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      el._drag = true;
      const r = ratio(e); setSlider(el, r); input && input(r);
    });
    el.addEventListener('pointermove', e => { if (!el._drag) return; const r = ratio(e); setSlider(el, r); input && input(r); });
    const end = e => { if (!el._drag) return; el._drag = false; el.classList.remove('active'); commit && commit(ratio(e)); };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  // ---------- Hojas, menús y diálogos ----------
  const sheets = [];
  function openSheet(inner, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap' + (opts.center ? ' center' : '');
    wrap.innerHTML = `<div class="sheet-dim"></div><div class="sheet-card">${opts.center ? '' : '<div class="sheet-grab"><i></i></div>'}<div class="sheet-body">${inner}</div></div>`;
    $('#sheets').appendChild(wrap);
    const api = { el: wrap, body: $('.sheet-body', wrap), closed: false };
    api.close = v => {
      if (api.closed) return;
      api.closed = true;
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 420);
      const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
      if (opts.onClose) opts.onClose(v);
    };
    $('.sheet-dim', wrap).addEventListener('click', () => api.close());
    // arrastrar hacia abajo para cerrar
    const card = $('.sheet-card', wrap);
    let sy = null;
    card.addEventListener('pointerdown', e => { if (e.target.closest('.sheet-grab, .sheet-title, .sheet-head')) { sy = e.clientY; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; } });
    card.addEventListener('pointermove', e => { if (sy != null) card.style.transform = `translateY(${Math.max(0, e.clientY - sy)}px)`; });
    const end = e => { if (sy == null) return; const dy = e.clientY - sy; sy = null; card.style.transition = ''; card.style.transform = ''; if (dy > 90) api.close(); };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('show')));
    sheets.push(api);
    hydrate(wrap);
    return api;
  }

  function menu(items, head = '') {
    const list = items.filter(Boolean);
    const s = openSheet(head + list.map((it, i) => `<button class="menu-item${it.danger ? ' danger' : ''}${it.checked ? ' checked' : ''}" data-mi="${i}">${icon(it.icon || 'dot')}<span>${esc(it.label)}</span>${it.small ? `<small>${esc(it.small)}</small>` : ''}</button>`).join(''));
    s.body.addEventListener('click', e => {
      const b = e.target.closest('[data-mi]');
      if (!b) return;
      haptic();
      const it = list[+b.dataset.mi];
      s.close();
      setTimeout(() => it.act(), 80);
    });
    return s;
  }

  function promptDialog(title, value = '', placeholder = '', ok = 'Guardar') {
    return new Promise(res => {
      const s = openSheet(`<div class="dialog-body"><h3>${esc(title)}</h3><input class="field" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="80"></div><div class="dialog-btns"><button data-d="0">Cancelar</button><button data-d="1">${esc(ok)}</button></div>`, { center: true, onClose: v => res(v == null ? null : v) });
      const inp = $('input', s.el);
      setTimeout(() => { inp.focus(); inp.select(); }, 280);
      s.el.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) s.close(b.dataset.d === '1' ? (inp.value.trim() || null) : null); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') s.close(inp.value.trim() || null); });
    });
  }
  function confirmDialog(title, text, ok = 'Aceptar', danger = false) {
    return new Promise(res => {
      const s = openSheet(`<div class="dialog-body"><h3>${esc(title)}</h3><p>${esc(text)}</p></div><div class="dialog-btns"><button data-d="0">Cancelar</button><button data-d="1" class="${danger ? 'danger' : ''}">${esc(ok)}</button></div>`, { center: true, onClose: v => res(!!v) });
      s.el.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b) s.close(b.dataset.d === '1'); });
    });
  }

  let toastT = null;
  function toast(msg, ic = 'check') {
    const el = $('#toast');
    el.innerHTML = icon(ic) + `<span>${esc(msg)}</span>`;
    el.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    clearTimeout(toastT);
    toastT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { if (!el.classList.contains('show')) el.hidden = true; }, 450); }, 2300);
  }

  // ---------- Menús de canciones, álbumes y listas ----------
  const trackHead = t => `<div class="sheet-head">${art(L.artOf(t), t.album)}<div><b>${esc(t.title)}</b><span>${esc(t.artist)} · ${esc(t.album)}</span></div></div>`;

  function trackMenu(t, ctx = {}) {
    const liked = S.likes.has(t.id);
    menu([
      { icon: 'playNext', label: 'Reproducir a continuación', act: () => { P.playNext(t.id); toast('Sonará a continuación'); } },
      { icon: 'addQueue', label: 'Agregar a la cola', act: () => { P.addToQueue(t.id); toast('Agregada a la cola'); } },
      { icon: 'addList', label: 'Agregar a una lista…', act: () => addToPlaylist([t.id]) },
      { icon: liked ? 'heartFill' : 'heart', label: liked ? 'Quitar de Me gusta' : 'Me gusta', act: () => toggleLike(t.id) },
      ctx.playlistId ? { icon: 'trash', label: 'Quitar de esta lista', danger: true, act: () => removeFromPlaylist(ctx.playlistId, t.id) } : null,
      ctx.noNav ? null : { icon: 'album', label: 'Ir al álbum', act: () => go({ render: renderAlbum, key: t.albumKey }) },
      ctx.noNav ? null : { icon: 'artist', label: 'Ir al artista', act: () => go({ render: renderArtist, key: t.artistKey }) },
      { icon: 'info', label: 'Información', act: () => infoDialog(t) }
    ], trackHead(t));
  }

  function albumMenu(al) {
    menu([
      { icon: 'play', label: 'Reproducir', act: () => P.playList(al.ids, 0, { label: al.title, type: 'album', id: al.key }, { shuffle: false }) },
      { icon: 'playNext', label: 'Reproducir a continuación', act: () => { P.playNext(al.ids); toast('El álbum sonará a continuación'); } },
      { icon: 'addQueue', label: 'Agregar a la cola', act: () => { P.addToQueue(al.ids); toast('Álbum agregado a la cola'); } },
      { icon: 'addList', label: 'Agregar a una lista…', act: () => addToPlaylist(al.ids) },
      { icon: 'artist', label: 'Ir al artista', act: () => go({ render: renderArtist, key: L.norm(al.artist) }) }
    ], `<div class="sheet-head">${art(al.art, al.title, '', 'album')}<div><b>${esc(al.title)}</b><span>${esc(al.artist)}</span></div></div>`);
  }

  function playlistMenu(pl) {
    menu([
      { icon: 'play', label: 'Reproducir', act: () => P.playList(pl.ids, 0, { label: pl.name, type: 'playlist', id: pl.id }, { shuffle: false }) },
      { icon: 'shuffle', label: 'Aleatorio', act: () => P.playList(pl.ids, 0, { label: pl.name, type: 'playlist', id: pl.id }, { shuffle: true }) },
      { icon: 'addQueue', label: 'Agregar a la cola', act: () => { P.addToQueue(pl.ids); toast('Lista agregada a la cola'); } },
      pl.file ? null : { icon: 'edit', label: 'Renombrar', act: async () => { const n = await promptDialog('Renombrar lista', pl.name); if (n) { pl.name = n; pl.updated = Date.now(); persist.playlists(); refreshAll(); } } },
      pl.file ? null : { icon: 'trash', label: 'Eliminar lista', danger: true, act: async () => { if (await confirmDialog('¿Eliminar lista?', `“${pl.name}” se eliminará. Tus canciones no se borran.`, 'Eliminar', true)) { S.playlists = S.playlists.filter(p => p !== pl); persist.playlists(); if (top().id === pl.id) pop(); refreshAll(); toast('Lista eliminada'); } } }
    ], `<div class="sheet-head">${collage(pl.ids)}<div><b>${esc(pl.name)}</b><span>${plural(pl.ids.length, 'canción', 'canciones')}</span></div></div>`);
  }

  function infoDialog(t) {
    const p = S.plays[t.id] || {};
    const rows = [
      ['Título', t.title], ['Artista', t.artist], ['Álbum', t.album], t.albumArtist ? ['Artista del álbum', t.albumArtist] : null,
      t.genre ? ['Género', t.genre] : null, t.year ? ['Año', t.year] : null, t.trackNo ? ['Pista', t.discNo ? `${t.trackNo} (disco ${t.discNo})` : t.trackNo] : null,
      ['Duración', t.duration ? fmt(t.duration) : '—'], ['Formato', formatBadge(t)[0]], ['Tamaño', (t.size / 1048576).toFixed(1) + ' MB'],
      ['Reproducciones', p.n || 0], p.last ? ['Última vez', new Date(p.last).toLocaleString('es')] : null,
      ['Letra', L.hasLyricsFile(t) ? 'Sí' : 'No'], ['Archivo', t.path]
    ].filter(Boolean);
    openSheet(`${trackHead(t)}<dl class="info-grid">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`);
  }

  function addToPlaylist(ids) {
    const items = S.playlists.map(pl => ({
      icon: 'playlist', label: pl.name, small: String(pl.ids.length), act: () => {
        const add = ids.filter(id => !pl.ids.includes(id));
        if (!add.length) return toast('Ya estaba en la lista', 'info');
        pl.ids.push(...add); pl.updated = Date.now();
        persist.playlists(); refreshAll();
        toast(`Agregada a “${pl.name}”`);
      }
    }));
    items.unshift({
      icon: 'plus', label: 'Nueva lista…', act: async () => {
        const name = await promptDialog('Nueva lista', '', 'Nombre de la lista', 'Crear');
        if (!name) return;
        newPlaylist(name, ids);
        toast(`Lista “${name}” creada`);
      }
    });
    menu(items, `<div class="sheet-title">Agregar a una lista</div>`);
  }

  function newPlaylist(name, ids = []) {
    const pl = { id: 'p' + Date.now().toString(36), name, ids: ids.slice(), created: Date.now(), updated: Date.now() };
    S.playlists.unshift(pl);
    persist.playlists();
    refreshAll();
    return pl;
  }
  function removeFromPlaylist(plId, trackId) {
    const pl = S.playlists.find(p => p.id === plId);
    if (!pl) return;
    pl.ids = pl.ids.filter(id => id !== trackId);
    pl.updated = Date.now();
    persist.playlists(); refreshAll();
    toast('Quitada de la lista');
  }
  function toggleLike(id) {
    if (S.likes.has(id)) { S.likes.delete(id); toast('Quitada de Me gusta', 'heart'); }
    else { S.likes.add(id); toast('Agregada a Me gusta', 'heartFill'); }
    persist.likes();
    updateLike();
    refreshAll();
  }

  function sortMenu(kind) {
    const sorts = kind === 'songs' ? SONG_SORTS : ALBUM_SORTS;
    const key = kind === 'songs' ? 'songSort' : 'albumSort';
    const pg = top();
    const current = kind === 'albums' && pg.sort ? pg.sort : S.settings[key];
    menu(Object.entries(sorts).map(([k, label]) => ({
      icon: 'sort', label, checked: current === k, act: () => { S.settings[key] = k; if (pg.sort) pg.sort = k; persist.settings(); renderPage(pg); pg.sc.scrollTop = 0; }
    })), `<div class="sheet-title">Ordenar por</div>`);
  }

  function sleepLabel() {
    if (!P.sleep) return 'Desactivado';
    if (P.sleep.track) return 'Al terminar la canción';
    return fmt(Math.max(0, (P.sleep.end - Date.now()) / 1000));
  }
  function sleepMenu() {
    const opts = [[0, 'Desactivado'], [5, '5 minutos'], [15, '15 minutos'], [30, '30 minutos'], [45, '45 minutos'], [60, '1 hora'], [90, '1 hora 30 min'], ['track', 'Al terminar la canción']];
    menu(opts.map(([v, label]) => ({
      icon: v === 0 ? 'x' : v === 'track' ? 'note' : 'moon', label,
      checked: v === 0 ? !P.sleep : v === 'track' ? !!(P.sleep && P.sleep.track) : false,
      act: () => { P.setSleep(v); if (v) toast(v === 'track' ? 'Se pausará al terminar la canción' : `Se pausará en ${label}`, 'moon'); }
    })), `<div class="sheet-title">Temporizador${P.sleep ? ` <small style="color:var(--gold);font-size:15px;font-weight:600">· ${sleepLabel()}</small>` : ''}</div>`);
  }
  function speedMenu() {
    menu([0.5, 0.75, 1, 1.25, 1.5, 2].map(v => ({
      icon: 'speed', label: v + '×' + (v === 1 ? ' (normal)' : ''), checked: S.settings.speed === v,
      act: () => { P.setSpeed(v); persist.settings(); refreshAll(); }
    })), `<div class="sheet-title">Velocidad</div>`);
  }

  // ---------- Ecualizador ----------
  function eqPath(gains) {
    const pts = gains.map((g, i) => [i * (300 / (gains.length - 1)), 35 - g * 2.6]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
  }
  function eqSheet() {
    const eq = S.settings.eq;
    const fl = f => (f >= 1000 ? f / 1000 + 'k' : f);
    const s = openSheet(`<div class="sheet-title">Ecualizador</div>
      <div class="eq-top"><span>Activar ecualizador</span><button class="switch ${eq.on ? 'on' : ''}" data-eqt></button></div>
      <div class="eq-wrap ${eq.on ? '' : 'eq-off'}">
        <div class="chips">${Object.entries(P.EQ_PRESETS).map(([k, p]) => `<button class="chip ${eq.preset === k ? 'on' : ''}" data-preset="${k}">${p.name}</button>`).join('')}</div>
        <svg class="eq-graph" viewBox="0 -2 300 74" preserveAspectRatio="none"><defs><linearGradient id="eqg" x1="0" x2="1"><stop offset="0" style="stop-color:rgb(var(--a2))"/><stop offset="1" style="stop-color:rgb(var(--a1))"/></linearGradient><linearGradient id="eqa" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:rgba(var(--a1),.35)"/><stop offset="1" style="stop-color:rgba(var(--a1),0)"/></linearGradient></defs><path class="area"/><path class="line"/></svg>
        <div class="eq-bands">${P.EQ_FREQS.map((f, i) => `<div class="eq-band"><b></b><div class="vslider" data-b="${i}"><i class="vfill"></i><i class="vknob"></i></div><small>${fl(f)}</small></div>`).join('')}</div>
      </div>
      ${S.settings.engine ? '' : `<div class="group-note" style="margin:6px 22px 4px">Activa “Motor de audio avanzado” en Ajustes para usar el ecualizador.</div>`}
      <div style="height:12px"></div>`);
    const draw = () => {
      const d = eqPath(eq.gains);
      $('.eq-graph .line', s.el).setAttribute('d', d);
      $('.eq-graph .area', s.el).setAttribute('d', d + ' L300,72 L0,72 Z');
      $$('.vslider', s.el).forEach(v => {
        const g = eq.gains[+v.dataset.b];
        const y = (0.5 - g / 24) * 100;
        $('.vknob', v).style.top = y + '%';
        const f = $('.vfill', v);
        f.style.top = Math.min(y, 50) + '%';
        f.style.height = Math.abs(y - 50) + '%';
        v.parentNode.querySelector('b').textContent = (g > 0 ? '+' : '') + (Math.round(g * 2) / 2);
      });
      $$('.chip[data-preset]', s.el).forEach(c => c.classList.toggle('on', c.dataset.preset === eq.preset));
    };
    const apply = () => { P.prepareAudio(); P.setEQ(eq); persist.settings(); draw(); };
    draw();
    s.el.addEventListener('click', e => {
      const t = e.target.closest('[data-eqt]');
      if (t) { eq.on = !eq.on; t.classList.toggle('on', eq.on); $('.eq-wrap', s.el).classList.toggle('eq-off', !eq.on); haptic(); apply(); return; }
      const p = e.target.closest('[data-preset]');
      if (p) { eq.preset = p.dataset.preset; eq.gains = P.EQ_PRESETS[eq.preset].g.slice(); haptic(); apply(); }
    });
    $$('.vslider', s.el).forEach(v => {
      const set = e => {
        const r = v.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        eq.gains[+v.dataset.b] = Math.round((0.5 - y) * 24 * 2) / 2;
        eq.preset = 'custom';
        P.prepareAudio(); P.setEQ(eq); draw();
      };
      v.addEventListener('pointerdown', e => { e.stopPropagation(); v.setPointerCapture(e.pointerId); set(e); });
      v.addEventListener('pointermove', e => { if (v.hasPointerCapture(e.pointerId)) set(e); });
      v.addEventListener('pointerup', () => persist.settings());
    });
    s.el.addEventListener('transitionend', () => refreshAll(), { once: true });
  }

  // ---------- Reproductor ----------
  const np = { el: $('#player'), open: false, panel: null, lines: null, lyrIdx: -1, userScroll: 0, seeking: false };
  const seekEl = $('.np-progress .slider');
  const volEl = $('.np-volume .slider');

  function openPlayer() {
    if (!P.current()) return;
    np.el.classList.add('open');
    np.el.setAttribute('aria-hidden', 'false');
    document.body.classList.add('player-open');
    np.open = true;
    fitTitle();
    startLoop();
  }
  function closePlayer() {
    np.el.classList.remove('open');
    np.el.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('player-open');
    np.open = false;
  }

  function formatBadge(t) {
    const e = t.ext;
    if (e === 'flac' || e === 'wav') return [`${e.toUpperCase()} · Sin pérdida`, true];
    const name = { mp3: 'MP3', m4a: 'AAC', aac: 'AAC', mp4: 'AAC', m4b: 'AAC', ogg: 'OGG', oga: 'OGG', opus: 'OPUS', webm: 'WEBM', weba: 'WEBM', '3gp': '3GP' }[e] || e.toUpperCase();
    const kbps = t.duration ? Math.round(t.size * 8 / t.duration / 1000) : 0;
    if (kbps > 600 && e === 'm4a') return ['ALAC · Sin pérdida', true];
    return [kbps ? `${name} · ${kbps} kbps` : name, kbps >= 300];
  }

  function fitTitle() {
    const box = $('.np-title'), span = $('span', box);
    box.classList.remove('marquee');
    box.style.removeProperty('--mx');
    requestAnimationFrame(() => {
      const over = span.scrollWidth - box.clientWidth;
      if (over > 4) {
        box.classList.add('marquee');
        box.style.setProperty('--mx', `-${over + 30}px`);
        box.style.setProperty('--mq', `${Math.max(8, over / 22 + 6)}s`);
      }
    });
  }

  async function updateTrackUI(t) {
    if (!t) return;
    const key = L.artOf(t);
    setArt($('.np-art'), key, t.album);
    setArt($('.mini-art'), key, t.album);
    $('.np-title span').textContent = t.title;
    $('.np-artist').textContent = t.artist;
    $('.np-from b').textContent = P.from.label || 'Biblioteca';
    $('.mini-title').textContent = t.title;
    $('.mini-sub').textContent = t.artist;
    const [b, hq] = formatBadge(t);
    const badge = $('.np-badge');
    badge.textContent = b; badge.classList.toggle('hq', hq);
    const mini = $('#mini');
    if (mini.hidden) { mini.hidden = false; mini.classList.add('pop'); setTimeout(() => mini.classList.remove('pop'), 700); }
    document.body.classList.remove('no-mini');
    updateLike();
    fitTitle();
    markPlaying();
    if (np.panel === 'lyrics') renderLyrics();
    if (np.panel === 'queue') renderQueue();
    $('.np-lyr').classList.toggle('has', L.hasLyricsFile(t));
    const img = $('.np-bg img');
    const url = await L.artUrl(key);
    if (P.current() !== t) return;
    if (url) { img.onload = () => img.classList.add('on'); if (img.src !== url) { img.classList.remove('on'); img.src = url; } else img.classList.add('on'); }
    else { img.classList.remove('on'); img.removeAttribute('src'); }
    const c = L.colorOf(t) || await L.artColor(key) || [124, 88, 200];
    applyColor(c);
    // refresca la tarjeta "Continuar" en Inicio
    if (tab === 'home') refreshAll();
  }

  // Color de la carátula: llena el fondo del reproductor y tiñe el mini reproductor
  function tone(rgb, light, satMin = 0.3, satMax = 0.8) {
    let [r, g, b] = rgb.map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, sat = 0;
    const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    sat = Math.max(satMin, Math.min(satMax, sat));
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat, p = 2 * light - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(v => Math.round(v * 255)).join(',');
  }
  function applyColor(c) {
    np.el.style.setProperty('--c', c.join(','));
    np.el.style.setProperty('--bg1', tone(c, 0.38));
    np.el.style.setProperty('--bg2', tone(c, 0.16));
    const mini = $('#mini');
    mini.style.setProperty('--m1', tone(c, 0.30));
    mini.style.setProperty('--m2', tone(c, 0.17));
    mini.classList.add('tinted');
  }

  function updateStateUI() {
    const ic = icon(P.playing ? 'pause' : 'play');
    $('.np-play').innerHTML = ic;
    $('.mini-play').innerHTML = ic;
    $$('.hero-play').forEach(b => { b.innerHTML = ic; });
    document.body.classList.toggle('paused', !P.playing);
    if (P.playing) startLoop();
  }
  function updateModeUI() {
    $('.np-shuffle').classList.toggle('on', P.shuffle);
    const r = $('.np-repeat');
    r.classList.toggle('on', P.repeat !== 'off');
    r.innerHTML = icon(P.repeat === 'one' ? 'repeat1' : 'repeat');
    if (np.panel === 'queue') renderQueue();
  }
  function updateLike() {
    const t = P.current();
    const on = !!(t && S.likes.has(t.id));
    const b = $('.np-like');
    b.classList.toggle('on', on);
    b.innerHTML = icon(on ? 'heartFill' : 'heart');
  }
  function updateSleepUI() { $('.np-sleep').classList.toggle('timer-on', !!P.sleep); }

  let lastMini = -1;
  function updateTime() {
    const d = P.duration(), ct = P.time();
    const r = d ? ct / d : 0;
    if (Math.abs(r - lastMini) > 0.001) { $('.mini-progress i').style.transform = `scaleX(${r})`; lastMini = r; }
  }

  // Bucle de animación: barra de progreso suave, letra sincronizada y pulso con el bajo
  let raf = 0, pulse = 0, lastCur = '', lastRem = '';
  const fbuf = new Uint8Array(128);
  function startLoop() { if (!raf && np.open) raf = requestAnimationFrame(loop); }
  function loop() {
    raf = 0;
    if (!np.open) return;
    const d = P.duration(), ct = P.time();
    if (!np.seeking) {
      setSlider(seekEl, d ? ct / d : 0);
      const c = fmt(ct), rm = '-' + fmt(Math.max(0, d - ct));
      if (c !== lastCur) { $('.t-cur').textContent = c; lastCur = c; }
      if (rm !== lastRem) { $('.t-rem').textContent = rm; lastRem = rm; }
    }
    if (np.panel === 'lyrics' && np.lines) syncLyrics(ct);
    const an = P.analyser();
    if (an && P.playing) {
      an.getByteFrequencyData(fbuf);
      let s = 0; for (let i = 1; i < 8; i++) s += fbuf[i];
      const v = Math.pow(s / 7 / 255, 2.4);
      pulse = pulse * 0.75 + v * 0.25;
    } else pulse *= 0.9;
    $('.np-art').style.setProperty('--pulse', pulse.toFixed(3));
    if (P.playing || np.seeking || pulse > 0.01) raf = requestAnimationFrame(loop);
  }

  // Letra
  async function renderLyrics() {
    const box = $('.np-lyrics');
    const t = P.current();
    if (!t) return;
    box.dataset.id = t.id;
    box.innerHTML = '';
    np.lines = null; np.lyrIdx = -1;
    const ly = await L.lyrics(t);
    if (box.dataset.id !== t.id) return;
    if (!ly) {
      box.innerHTML = `<div class="empty-panel">${icon('lyrics')}<b>Sin letra</b><span>Coloca un archivo <b>.lrc</b> con el mismo nombre de la canción en su carpeta (por ejemplo “${esc(t.name.replace(/\.[^.]+$/, ''))}.lrc”) o agrega la letra en las etiquetas del archivo.</span></div>`;
      return;
    }
    box.innerHTML = `<div class="lyrics ${ly.synced ? 'synced' : 'plain'}">${ly.lines.map((l, i) => `<p data-i="${i}">${esc(l.text || '♪')}</p>`).join('')}</div>`;
    box.scrollTop = 0;
    if (ly.synced) { np.lines = ly.lines; startLoop(); syncLyrics(P.time(), true); }
  }
  function syncLyrics(ct, force) {
    const lines = np.lines;
    let lo = 0, hi = lines.length - 1, idx = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (lines[m].t <= ct + 0.2) { idx = m; lo = m + 1; } else hi = m - 1; }
    if (idx === np.lyrIdx && !force) return;
    np.lyrIdx = idx;
    const box = $('.np-lyrics');
    $$('p', box).forEach((p, i) => { p.classList.toggle('on', i === idx); p.classList.toggle('past', i < idx); });
    if (Date.now() - np.userScroll > 3500) {
      const p = $(`p[data-i="${Math.max(0, idx)}"]`, box);
      if (p) box.scrollTo({ top: p.offsetTop - box.clientHeight * 0.3, behavior: force ? 'auto' : 'smooth' });
    }
  }

  // Cola
  function renderQueue() {
    const box = $('.np-queue');
    const up = P.queue.slice(P.index + 1, P.index + 301);
    let html = `<div class="q-head"><div><b>Siguiente</b><small>Reproduciendo de ${esc(P.from.label || 'Biblioteca')}</small></div><div class="q-toggles">
      <button data-q="shuffle" class="${P.shuffle ? 'on' : ''}" aria-label="Aleatorio">${icon('shuffle')}</button>
      <button data-q="repeat" class="${P.repeat !== 'off' ? 'on' : ''}" aria-label="Repetir">${icon(P.repeat === 'one' ? 'repeat1' : 'repeat')}</button>
      <button data-q="auto" class="${S.settings.autoplay ? 'on' : ''}" aria-label="Reproducción automática">${icon('infinity')}</button></div></div>`;
    if (up.length) html += `<div style="display:flex;justify-content:space-between;align-items:center"><div class="q-sub">${plural(P.queue.length - P.index - 1, 'canción', 'canciones')}</div><button class="q-clear" data-q="clear">Borrar cola</button></div>`;
    html += `<div class="q-list">${up.map((id, k) => {
      const t = L.tracks.get(id);
      if (!t) return '';
      const qi = P.index + 1 + k;
      return `<div class="q-row" data-qi="${qi}">${art(L.artOf(t), t.album)}<div class="rt"><div class="r1">${esc(t.title)}</div><div class="r2">${esc(t.artist)}</div></div><button class="qx" data-qx="${qi}" aria-label="Quitar">${icon('x')}</button><span class="qh" aria-label="Mover">${icon('grip')}</span></div>`;
    }).join('')}</div>`;
    if (!up.length) html += `<div class="empty-panel" style="height:auto;padding:40px 10px">${icon('queue')}<span>${S.settings.autoplay ? 'Al terminar, la reproducción automática seguirá con canciones parecidas.' : 'No hay más canciones en la cola.'}</span></div>`;
    const y = box.scrollTop;
    box.innerHTML = html;
    box.scrollTop = y;
    hydrate(box);
  }

  function initQueueInteractions() {
    const box = $('.np-queue');
    box.addEventListener('click', e => {
      const q = e.target.closest('[data-q]');
      if (q) {
        haptic();
        if (q.dataset.q === 'shuffle') P.toggleShuffle();
        else if (q.dataset.q === 'repeat') P.cycleRepeat();
        else if (q.dataset.q === 'auto') { S.settings.autoplay = !S.settings.autoplay; persist.settings(); renderQueue(); }
        else if (q.dataset.q === 'clear') P.clearUpNext();
        return;
      }
      const x = e.target.closest('[data-qx]');
      if (x) { haptic(); P.removeAt(+x.dataset.qx); return; }
      const row = e.target.closest('.q-row');
      if (row && !e.target.closest('.qh')) { haptic(); P.jump(+row.dataset.qi); }
    });
    // Arrastrar para reordenar
    let d = null;
    box.addEventListener('pointerdown', e => {
      const h = e.target.closest('.qh');
      if (!h) return;
      e.preventDefault();
      const row = h.closest('.q-row');
      const rows = $$('.q-row', box);
      d = { row, rows, idx: rows.indexOf(row), to: rows.indexOf(row), y: e.clientY, sy: box.scrollTop, H: row.offsetHeight, id: e.pointerId };
      h.setPointerCapture(e.pointerId);
      row.classList.add('drag');
      rows.forEach(r => { if (r !== row) r.classList.add('shift'); });
      haptic();
    });
    box.addEventListener('pointermove', e => {
      if (!d || e.pointerId !== d.id) return;
      const br = box.getBoundingClientRect();
      if (e.clientY < br.top + 50) box.scrollTop -= 8;
      else if (e.clientY > br.bottom - 50) box.scrollTop += 8;
      const dy = e.clientY - d.y + (box.scrollTop - d.sy);
      d.row.style.transform = `translateY(${dy}px)`;
      const to = Math.max(0, Math.min(d.rows.length - 1, d.idx + Math.round(dy / d.H)));
      if (to !== d.to) { d.to = to; haptic(); }
      d.rows.forEach((r, j) => {
        if (r === d.row) return;
        let s = 0;
        if (d.idx < j && j <= to) s = -d.H;
        else if (to <= j && j < d.idx) s = d.H;
        r.style.transform = s ? `translateY(${s}px)` : '';
      });
    });
    const end = () => {
      if (!d) return;
      const { idx, to, rows } = d;
      d = null;
      rows.forEach(r => { r.style.transform = ''; r.classList.remove('drag', 'shift'); });
      if (to !== idx) P.move(+rows[idx].dataset.qi, +rows[to].dataset.qi);
    };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
  }

  function setPanel(p) {
    np.panel = np.panel === p ? null : p;
    np.el.classList.toggle('panel', !!np.panel);
    $('.np-lyrics').hidden = np.panel !== 'lyrics';
    $('.np-queue').hidden = np.panel !== 'queue';
    $('.np-lyr').classList.toggle('on', np.panel === 'lyrics');
    $('.np-q').classList.toggle('on', np.panel === 'queue');
    if (np.panel === 'lyrics') renderLyrics();
    if (np.panel === 'queue') renderQueue();
    try { localStorage.setItem('velum.panel', np.panel || ''); } catch (e) { }
  }

  function initPlayer() {
    $('.np-close').innerHTML = icon('chevD');
    $('.np-more').innerHTML = icon('more');
    $('.np-prev').innerHTML = icon('prev');
    $('.np-next').innerHTML = icon('next');
    $('.mini-next').innerHTML = icon('next');
    $('.np-shuffle').innerHTML = icon('shuffle');
    $('.np-lyr').innerHTML = icon('lyrics');
    $('.np-sleep').innerHTML = icon('moon');
    $('.np-eq').innerHTML = icon('eq');
    $('.np-q').innerHTML = icon('queue');
    $('.vi-low').innerHTML = icon('volLow');
    $('.vi-high').innerHTML = icon('volHigh');
    updateStateUI(); updateModeUI(); updateLike();

    const on = (sel, f) => $(sel).addEventListener('click', e => { e.stopPropagation(); haptic(); f(e); });
    on('.np-close', closePlayer);
    on('.np-play', () => tryPlay(P.toggle));
    on('.np-next', P.next);
    on('.np-prev', P.prev);
    on('.np-shuffle', () => { P.toggleShuffle(); toast(P.shuffle ? 'Aleatorio activado' : 'Aleatorio desactivado', 'shuffle'); });
    on('.np-repeat', () => { P.cycleRepeat(); toast({ off: 'Repetir desactivado', all: 'Repetir todo', one: 'Repetir esta canción' }[P.repeat], P.repeat === 'one' ? 'repeat1' : 'repeat'); });
    on('.np-like', () => { const t = P.current(); if (t) toggleLike(t.id); });
    on('.np-artist', () => { const t = P.current(); if (t) go({ render: renderArtist, key: t.artistKey }); });
    on('.np-more', () => { const t = P.current(); if (t) trackMenu(t); });
    on('.np-lyr', () => setPanel('lyrics'));
    on('.np-q', () => setPanel('queue'));
    on('.np-sleep', sleepMenu);
    on('.np-eq', eqSheet);
    on('.mini-play', () => tryPlay(P.toggle));
    on('.mini-next', P.next);

    slider(seekEl, {
      input: r => { np.seeking = true; const d = P.duration(); $('.t-cur').textContent = fmt(r * d); $('.t-rem').textContent = '-' + fmt(d - r * d); startLoop(); },
      commit: r => { P.seek(r * P.duration()); np.seeking = false; }
    });
    setSlider(volEl, S.settings.volume);
    slider(volEl, { input: r => P.setVolume(r), commit: () => persist.settings() });

    const lyr = $('.np-lyrics');
    ['touchstart', 'wheel'].forEach(ev => lyr.addEventListener(ev, () => { np.userScroll = Date.now(); }, { passive: true }));
    lyr.addEventListener('click', e => {
      const p = e.target.closest('p[data-i]');
      if (p && np.lines) { const l = np.lines[+p.dataset.i]; if (l) { P.seek(l.t); np.userScroll = 0; haptic(); if (!P.playing) P.play(); } }
    });
    initQueueInteractions();

    // Arrastrar hacia abajo para cerrar
    let drag = null;
    np.el.addEventListener('pointerdown', e => {
      if (!e.target.closest('.np-grab, .np-head, .np-art-wrap') || e.target.closest('button')) return;
      drag = { y: e.clientY, x: e.clientX, id: e.pointerId, on: false };
    });
    np.el.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      const dy = e.clientY - drag.y;
      if (!drag.on) { if (dy > 8 && Math.abs(dy) > Math.abs(e.clientX - drag.x)) { drag.on = true; np.el.classList.add('dragging'); try { np.el.setPointerCapture(e.pointerId); } catch (er) { } } else return; }
      np.el.style.transform = `translate3d(0,${Math.max(0, dy)}px,0)`;
      drag.dy = dy;
    });
    const end = () => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.on) return;
      np.el.classList.remove('dragging');
      np.el.style.transform = '';
      if (d.dy > 120) closePlayer();
    };
    np.el.addEventListener('pointerup', end);
    np.el.addEventListener('pointercancel', end);

    // Mini reproductor: tocar abre, deslizar cambia de canción
    const mini = $('#mini');
    let ms = null;
    mini.addEventListener('pointerdown', e => { if (!e.target.closest('button')) ms = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    mini.addEventListener('pointerup', e => {
      if (!ms) return;
      const dx = e.clientX - ms.x, dy = e.clientY - ms.y;
      ms = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { haptic(); dx < 0 ? P.next() : P.prev(); }
      else if (dy < -40) openPlayer();
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) openPlayer();
    });
    mini.addEventListener('pointercancel', () => { ms = null; });

    try { const p = localStorage.getItem('velum.panel'); if (p) setPanel(p); } catch (e) { }
  }

  // Si la carpeta perdió el permiso (navegador), lo pide antes de reproducir
  async function tryPlay(fn) {
    const t = P.current();
    if (t && !L.canPlay(t) && L.roots.some(r => r.needsPermission)) {
      const ok = await L.reconnect();
      if (!ok) return toast('Vuelve a elegir tu carpeta de música', 'lock');
      await P.restore();
    }
    fn();
  }
  async function playFrom(list, i, opts = {}) {
    const t = L.tracks.get(list.ids[i]);
    if (t && !L.canPlay(t) && L.roots.some(r => r.needsPermission)) {
      const ok = await L.reconnect();
      if (!ok) return toast('Vuelve a elegir tu carpeta de música', 'lock');
    }
    P.playList(list.ids, i, list.from, opts);
  }

  // ---------- Estadísticas de escucha ----------
  P.on('played', t => {
    const p = S.plays[t.id] || (S.plays[t.id] = { n: 0, last: 0 });
    p.n++; p.last = Date.now();
    S.history.unshift({ id: t.id, t: Date.now() });
    if (S.history.length > 300) S.history.length = 300;
    persist.plays();
  });
  P.on('listen', d => {
    const k = dayKey();
    S.stats[k] = (S.stats[k] || 0) + d;
    persist.stats();
  });

  // ---------- Acciones ----------
  const ACT = {
    back: () => pop(),
    settings: () => go({ render: renderSettings, title: 'Ajustes' }),
    stats: () => go({ render: renderStats, title: 'Estadísticas' }),
    album: el => go({ render: renderAlbum, key: el.dataset.key }),
    artist: el => go({ render: renderArtist, key: el.dataset.key }),
    genre: el => go({ render: renderGenre, key: el.dataset.key }),
    playlist: el => go({ render: renderPlaylist, id: el.dataset.id }),
    smart: el => go({ render: renderSmart, id: el.dataset.id }),
    songs: () => go({ render: renderSongs }),
    albums: el => go({ render: renderAlbums, sort: el.dataset.sort || '' }),
    artists: () => go({ render: renderArtists }),
    genres: () => go({ render: renderGenres }),
    folders: () => go({ render: renderFolder, path: '' }),
    folder: el => go({ render: renderFolder, path: el.dataset.path }),
    'playlists-tab': () => switchTab('playlists'),
    'see-all': el => { const l = LISTS.get(el.dataset.ref); if (l) go({ render: renderTrackList, ids: l.ids, from: l.from, title: el.dataset.title || l.from.label }); },
    'open-player': (el, e) => { if (!e.target.closest('[data-act="toggle"]')) openPlayer(); },
    toggle: (el, e) => { e.stopPropagation(); tryPlay(P.toggle); },
    'play-list': el => { const l = LISTS.get(el.dataset.ref); if (l) playFrom(l, 0, { shuffle: false }); },
    'shuffle-list': el => { const l = LISTS.get(el.dataset.ref); if (l) playFrom(l, 0, { shuffle: true }); },
    'shuffle-all': () => { if (L.sorted.length) playFrom({ ids: L.sorted, from: { label: 'Toda tu música', type: 'all' } }, 0, { shuffle: true }); },
    'add-folder': async () => {
      const before = L.sorted.length;
      const ok = await L.addFolder();
      if (ok) toast(`Biblioteca lista: ${plural(L.sorted.length, 'canción', 'canciones')}${L.sorted.length > before && before ? ` (+${L.sorted.length - before})` : ''}`);
      refreshAll();
    },
    reconnect: async () => { const ok = await L.reconnect(); if (ok) { toast('Carpeta conectada'); await P.restore(); } refreshAll(); },
    'remove-folder': async (el, e) => {
      e.stopPropagation();
      const r = L.roots.find(x => x.id === el.dataset.id);
      if (r && await confirmDialog('¿Quitar carpeta?', `“${r.name}” dejará de aparecer en Velum. Tus archivos no se borran.`, 'Quitar', true)) { await L.removeFolder(r.id); refreshAll(); }
    },
    rescan: async () => { toast('Buscando música nueva…', 'refresh'); const n = L.sorted.length; await L.scan(); toast(L.sorted.length > n ? `${plural(L.sorted.length - n, 'canción nueva', 'canciones nuevas')}` : 'Tu biblioteca está al día'); },
    'new-playlist': async () => { const name = await promptDialog('Nueva lista', '', 'Nombre de la lista', 'Crear'); if (name) { const pl = newPlaylist(name); go({ render: renderPlaylist, id: pl.id }); } },
    'pl-more': el => { const pl = findPlaylist(el.dataset.id); if (pl) playlistMenu(pl); },
    'sort-songs': () => sortMenu('songs'),
    'sort-albums': () => sortMenu('albums'),
    eq: () => eqSheet(),
    theme: el => {
      S.settings.theme = el.dataset.id;
      persist.settings();
      applyTheme(S.settings.theme);
      $$('.theme-sw').forEach(b => b.classList.toggle('on', b === el));
      const t = THEMES[S.settings.theme];
      toast(`Tema ${t.name}`, 'sparkles');
    },
    sleep: () => sleepMenu(),
    speed: () => speedMenu(),
    'toggle-setting': (el, e) => {
      e.stopPropagation();
      const k = el.dataset.key;
      S.settings[k] = !S.settings[k];
      el.classList.toggle('on', S.settings[k]);
      persist.settings();
      if (k === 'hideShort') { L.settings.hideShort = S.settings.hideShort; L.rebuild(); }
      if (k === 'engine') toast('Se aplicará al volver a abrir la app', 'info');
    },
    'clear-cache': async () => { if (await confirmDialog('¿Volver a leer tu música?', 'Se leerán de nuevo las etiquetas y carátulas de todas tus canciones. Tus listas y favoritos no cambian.', 'Continuar')) L.clearCache(); },
    'reset-stats': async () => {
      if (!await confirmDialog('¿Borrar historial?', 'Se borrarán tus estadísticas, reproducciones e historial. Tus listas y favoritos no cambian.', 'Borrar', true)) return;
      S.plays = {}; S.history = []; S.stats = {}; persist.plays(); persist.stats(); refreshAll(); toast('Historial borrado');
    },
    'search-recent': el => { const pg = stacks.search[0]; pg.searchInput.value = el.dataset.q; searchQ = el.dataset.q; $('.clear', pg.nav).hidden = false; renderPage(pg); },
    'clear-recent': () => { S.recent = []; persist.recent(); renderPage(stacks.search[0]); }
  };

  // Clics: filas de canciones y acciones
  let suppressClick = false;
  document.addEventListener('click', e => {
    if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; }
    const row = e.target.closest('.row[data-i]');
    if (row) {
      const host = row.closest('[data-list]');
      const list = host && LISTS.get(host.dataset.list);
      if (!list) return;
      const i = +row.dataset.i;
      const t = L.tracks.get(list.ids[i]);
      if (!t) return;
      haptic();
      if (e.target.closest('.more')) return trackMenu(t, { playlistId: list.playlistId });
      if (tab === 'search') saveRecent();
      return playFrom(list, i);
    }
    const a = e.target.closest('[data-act]');
    if (a && ACT[a.dataset.act]) {
      if (a.dataset.save) saveRecent();
      haptic();
      ACT[a.dataset.act](a, e);
    }
  }, true);

  // Mantener presionado: menú contextual
  let lp = null;
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.row[data-i], .card[data-act="album"], .card[data-act="playlist"]');
    if (!el || e.target.closest('.more')) return;
    lp = { x: e.clientX, y: e.clientY, t: setTimeout(() => { lp = null; suppressClick = true; setTimeout(() => { suppressClick = false; }, 700); haptic(); longPress(el); }, 480) };
  });
  document.addEventListener('pointermove', e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; } });
  ['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { if (lp) { clearTimeout(lp.t); lp = null; } }));
  document.addEventListener('contextmenu', e => e.preventDefault());
  function longPress(el) {
    if (el.classList.contains('row')) {
      const host = el.closest('[data-list]');
      const list = host && LISTS.get(host.dataset.list);
      const t = list && L.tracks.get(list.ids[+el.dataset.i]);
      if (t) trackMenu(t, { playlistId: list.playlistId });
    } else if (el.dataset.act === 'album') { const al = L.albums.get(el.dataset.key); if (al) albumMenu(al); }
    else if (el.dataset.act === 'playlist') { const pl = findPlaylist(el.dataset.id); if (pl) playlistMenu(pl); }
  }

  // ---------- Actualizar pantallas ----------
  let refreshT = null;
  function refreshAll() {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => {
      for (const t of Object.keys(stacks)) {
        stacks[t].forEach((pg, i) => {
          const visible = t === tab && i === stacks[t].length - 1;
          if (visible) { const y = pg.sc.scrollTop; renderPage(pg); pg.sc.scrollTop = y; }
          else pg.dirty = true;
        });
      }
    }, L.scanning ? 1500 : 120);
  }

  function updateScan() {
    const p = L.progress;
    const html = !p.phase ? '' : `<div class="scan-pill glass"><i class="spin"></i><span>${p.phase === 'scan' ? 'Buscando música en tu carpeta…' : `Leyendo tus canciones · ${p.done.toLocaleString('es')} de ${p.total.toLocaleString('es')}`}</span>${p.total ? `<div class="bar"><i style="transform:scaleX(${p.done / p.total})"></i></div>` : ''}</div>`;
    $$('.scan-slot').forEach(s => { if (s.innerHTML !== html) s.innerHTML = html; });
  }

  // ---------- Atrás (Android) y teclado ----------
  window.VelumNative = window.VelumNative || {};
  window.VelumNative.onBack = function () {
    if (sheets.length) { sheets[sheets.length - 1].close(); return true; }
    if (np.open) { if (np.panel) setPanel(np.panel); else closePlayer(); return true; }
    const s = document.activeElement;
    if (s && s.tagName === 'INPUT') { s.blur(); return true; }
    if (pop()) return true;
    if (tab !== 'home') { switchTab('home'); return true; }
    return false;
  };
  // Al volver a la app busca canciones nuevas en la carpeta (como mucho cada 3 minutos)
  let lastScan = Date.now();
  window.VelumNative.onResume = () => {
    if (!native || !L.roots.length || L.scanning || Date.now() - lastScan < 180000) return;
    lastScan = Date.now();
    L.scan();
  };
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.key === ' ') { e.preventDefault(); tryPlay(P.toggle); }
    else if (e.key === 'Escape') window.VelumNative.onBack();
    else if (e.key === 'ArrowRight' && e.shiftKey) P.next();
    else if (e.key === 'ArrowLeft' && e.shiftKey) P.prev();
    else if (e.key === 'ArrowRight') P.seek(P.time() + 10);
    else if (e.key === 'ArrowLeft') P.seek(P.time() - 10);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { P.save(); DB.flush(); } else startLoop(); });
  window.addEventListener('pagehide', () => { P.save(); DB.flush(); });

  // ---------- Arranque ----------
  async function start() {
    await loadState();
    applyTheme(S.settings.theme);
    L.settings.hideShort = S.settings.hideShort;
    P.setSpeed(S.settings.speed);
    P.setVolume(S.settings.volume);
    P.setEQ(S.settings.eq);

    $('.tab[data-tab="home"] .ti').innerHTML = icon('home');
    $('.tab[data-tab="library"] .ti').innerHTML = icon('library');
    $('.tab[data-tab="playlists"] .ti').innerHTML = icon('playlist');
    $('.tab-search').innerHTML = icon('search');
    $$('#tabbar [data-tab]').forEach(b => {
      b.addEventListener('pointerdown', e => ripple(b, e));
      b.addEventListener('click', () => { haptic(); switchTab(b.dataset.tab); });
    });
    initPlayer();

    push({ render: renderHome, title: 'Inicio' }, 'home');
    push({ render: renderLibrary, title: 'Biblioteca' }, 'library');
    push({ render: renderPlaylists, title: 'Listas' }, 'playlists');
    buildSearchPage();
    $$('#tabbar [data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    moveBlob(false);
    document.body.classList.add('no-mini', 'paused');

    L.on('change', refreshAll);
    L.on('roots', refreshAll);
    L.on('progress', p => { updateScan(); if (!p.phase) refreshAll(); });
    L.on('error', () => toast('No se pudo leer la carpeta', 'info'));
    P.on('track', updateTrackUI);
    P.on('state', updateStateUI);
    P.on('mode', updateModeUI);
    P.on('time', updateTime);
    P.on('queue', () => { if (np.panel === 'queue') renderQueue(); });
    P.on('volume', v => { if (!volEl._drag) setSlider(volEl, v); S.settings.volume = v; });
    P.on('sleep', updateSleepUI);
    P.on('error', ({ track }) => toast(track ? `No se pudo reproducir “${track.title}”` : 'No se pudo reproducir', 'info'));

    await L.init({ hideShort: S.settings.hideShort });
    await P.restore();
    refreshAll();

    if (!native && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
  }

  start().catch(e => { console.error(e); toast('Error al iniciar: ' + e.message, 'info'); });
})();
