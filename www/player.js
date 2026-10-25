/* Velum · motor de reproducción: cola, aleatorio, repetir, crossfade, sin pausas, ecualizador, temporizador */
(function (global) {
  'use strict';

  const EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const EQ_PRESETS = {
    flat: { name: 'Plano', g: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    bass: { name: 'Más graves', g: [6, 5, 4, 2, .5, 0, 0, 0, 0, 0] },
    treble: { name: 'Más agudos', g: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
    vocal: { name: 'Voces', g: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
    pop: { name: 'Pop', g: [-1, 1, 3, 4, 3, 0, -1, -1, 0, 1] },
    rock: { name: 'Rock', g: [5, 4, 2, 0, -1, -1, 1, 3, 4, 5] },
    hiphop: { name: 'Hip-Hop', g: [5, 4, 2, 3, -1, -1, 1, 0, 2, 3] },
    latin: { name: 'Reggaetón / Latina', g: [5, 4, 2, 0, -1, 0, 1, 2, 3, 3] },
    electronic: { name: 'Electrónica', g: [5, 4, 1, 0, -2, 1, 0, 2, 4, 5] },
    acoustic: { name: 'Acústica', g: [3, 3, 2, 1, 2, 2, 3, 3, 2, 1] },
    classical: { name: 'Clásica', g: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4] },
    night: { name: 'Volumen bajo', g: [5, 3, 1, 0, 0, 0, 0, 1, 3, 4] }
  };

  const native = global.AndroidBridge || null;
  const listeners = {};
  const emit = (ev, d) => (listeners[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error(e); } });

  const P = {
    EQ_FREQS, EQ_PRESETS,
    queue: [], original: null, index: -1,
    shuffle: false, repeat: 'off', // off | all | one
    from: { label: '', type: '', id: '' },
    playing: false,
    settings: { crossfade: 0, gapless: true, autoplay: true, speed: 1, volume: 1, eq: { on: false, preset: 'flat', gains: EQ_PRESETS.flat.g.slice(), preamp: 0 }, engine: true },
    sleep: null, // { end: ms } | { track: true }
    on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); }
  };

  const els = [new Audio(), new Audio()];
  els.forEach(a => { a.preload = 'auto'; a.crossOrigin = 'anonymous'; a.preservesPitch = true; });
  let cur = 0;
  let preloaded = null;    // id preparado en el otro reproductor
  let fading = false;
  let errors = 0;
  let listened = 0, lastT = 0, counted = false;
  let duckFactor = 1, sleepFade = 1;

  const A = () => els[cur];
  const B = () => els[1 - cur];
  P.audio = A;

  // ---------- Web Audio (ecualizador, crossfade, visualizador) ----------
  let ctx = null, gains = [], bands = [], preamp, master, analyser;
  // Solo se crea cuando hace falta (ecualizador o fundido) y siempre desde un toque del usuario
  function graph() {
    if (ctx || !P.settings.engine || !(P.settings.eq.on || P.settings.crossfade > 0)) return ctx;
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC({ latencyHint: 'playback' });
      preamp = ctx.createGain();
      let node = preamp;
      bands = EQ_FREQS.map((f, i) => {
        const b = ctx.createBiquadFilter();
        b.type = i === 0 ? 'lowshelf' : i === EQ_FREQS.length - 1 ? 'highshelf' : 'peaking';
        b.frequency.value = f; b.Q.value = 1.1;
        node.connect(b); node = b;
        return b;
      });
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
      master = ctx.createGain();
      node.connect(analyser); analyser.connect(master); master.connect(ctx.destination);
      gains = els.map(a => {
        const src = ctx.createMediaElementSource(a);
        const g = ctx.createGain();
        src.connect(g); g.connect(preamp);
        return g;
      });
      gains[1 - cur].gain.value = 0;
      applyEQ(); applyVolume();
    } catch (e) {
      console.warn('Web Audio no disponible', e);
      ctx = null;
    }
    return ctx;
  }
  P.analyser = () => analyser;
  P.resume = () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => { }); };
  P.prepareAudio = () => { graph(); P.resume(); };
  const userGesture = () => !navigator.userActivation || navigator.userActivation.isActive;

  function applyEQ() {
    if (!ctx) return;
    const eq = P.settings.eq;
    const t = ctx.currentTime;
    bands.forEach((b, i) => b.gain.setTargetAtTime(eq.on ? eq.gains[i] : 0, t, 0.05));
    // Reduce un poco la ganancia previa para evitar saturación cuando hay realce
    const peak = eq.on ? Math.max(0, ...eq.gains) : 0;
    preamp.gain.setTargetAtTime(Math.pow(10, ((eq.on ? eq.preamp : 0) - peak * 0.6) / 20), t, 0.05);
  }
  P.setEQ = function (eq) { P.settings.eq = eq; applyEQ(); emit('settings'); };

  function applyVolume() {
    const v = P.settings.volume * duckFactor * sleepFade;
    if (ctx) { master.gain.setTargetAtTime(v, ctx.currentTime, 0.03); els.forEach(a => { a.volume = 1; }); }
    else { A().volume = v; }
  }
  P.setVolume = v => { P.settings.volume = Math.max(0, Math.min(1, v)); applyVolume(); emit('volume', P.settings.volume); };
  P.setSpeed = s => { P.settings.speed = s; els.forEach(a => { a.playbackRate = s; a.defaultPlaybackRate = s; }); emit('settings'); };
  P.duck = on => { duckFactor = on ? 0.25 : 1; applyVolume(); };

  function setGain(i, v, ramp) {
    if (!ctx) { els[i].volume = v * P.settings.volume; return; }
    const g = gains[i].gain, t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (ramp) g.linearRampToValueAtTime(v, t + ramp); else g.setValueAtTime(v, t);
  }

  // ---------- Cola ----------
  P.current = () => (P.index >= 0 ? Lib.tracks.get(P.queue[P.index]) : null);
  P.upNext = () => P.queue.slice(P.index + 1).map(id => Lib.tracks.get(id)).filter(Boolean);

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  P.playList = function (ids, start = 0, from = {}, opts = {}) {
    ids = ids.filter(id => Lib.tracks.has(id));
    if (!ids.length) return;
    P.from = { label: from.label || 'Biblioteca', type: from.type || '', id: from.id || '' };
    if (opts.shuffle) {
      P.shuffle = true;
      P.original = ids.slice();
      const first = opts.startRandom === false ? ids[start] : ids[Math.floor(Math.random() * ids.length)];
      P.queue = [first, ...shuffled(ids.filter(x => x !== first))];
      P.index = 0;
    } else if (P.shuffle && opts.keepShuffle !== false && opts.shuffle !== false) {
      P.original = ids.slice();
      const first = ids[start];
      P.queue = [first, ...shuffled(ids.filter(x => x !== first))];
      P.index = 0;
    } else {
      P.shuffle = false; P.original = null;
      P.queue = ids.slice(); P.index = Math.max(0, Math.min(start, ids.length - 1));
    }
    emit('queue');
    load(true);
  };

  P.toggleShuffle = function () {
    const curId = P.queue[P.index];
    if (!P.shuffle) {
      P.original = P.queue.slice();
      const rest = P.queue.filter((x, i) => i > P.index);
      P.queue = P.queue.slice(0, P.index + 1).concat(shuffled(rest));
      P.shuffle = true;
    } else {
      P.shuffle = false;
      if (P.original) {
        P.queue = P.original.slice();
        P.index = Math.max(0, P.queue.indexOf(curId));
      }
      P.original = null;
    }
    dropPreload();
    emit('queue'); emit('mode'); save();
  };

  P.cycleRepeat = function () {
    P.repeat = P.repeat === 'off' ? 'all' : P.repeat === 'all' ? 'one' : 'off';
    dropPreload();
    emit('mode'); save();
  };

  P.playNext = function (ids) {
    ids = [].concat(ids).filter(id => Lib.tracks.has(id));
    if (!ids.length) return;
    if (P.index < 0) return P.playList(ids, 0, { label: 'Cola' });
    P.queue.splice(P.index + 1, 0, ...ids);
    if (P.original) P.original.push(...ids);
    dropPreload(); emit('queue'); save();
  };
  P.addToQueue = function (ids) {
    ids = [].concat(ids).filter(id => Lib.tracks.has(id));
    if (!ids.length) return;
    if (P.index < 0) return P.playList(ids, 0, { label: 'Cola' });
    P.queue.push(...ids);
    if (P.original) P.original.push(...ids);
    dropPreload(); emit('queue'); save();
  };
  P.removeAt = function (qi) {
    if (qi <= P.index || qi >= P.queue.length) return;
    P.queue.splice(qi, 1);
    dropPreload(); emit('queue'); save();
  };
  P.move = function (from, to) {
    if (from <= P.index || to <= P.index) return;
    const [id] = P.queue.splice(from, 1);
    P.queue.splice(to, 0, id);
    dropPreload(); emit('queue'); save();
  };
  P.clearUpNext = function () { P.queue = P.queue.slice(0, P.index + 1); dropPreload(); emit('queue'); save(); };
  P.jump = function (qi) { if (qi >= 0 && qi < P.queue.length) { P.index = qi; load(true); } };

  // Al terminar la cola, agrega canciones parecidas (mismo artista / género)
  function autoExtend() {
    if (!P.settings.autoplay || !Lib.sorted.length) return false;
    const t = P.current();
    const recent = new Set(P.queue.slice(-60));
    let pool = Lib.sorted.filter(id => !recent.has(id));
    if (t) {
      const same = pool.filter(id => { const x = Lib.tracks.get(id); return x.artistKey === t.artistKey || (t.genre && x.genre === t.genre); });
      if (same.length >= 5) pool = same;
    }
    if (!pool.length) return false;
    const add = shuffled(pool).slice(0, 25);
    P.queue.push(...add);
    if (P.original) P.original.push(...add);
    if (P.from.type !== 'auto') P.from = { label: 'Reproducción automática', type: 'auto', id: '' };
    emit('queue');
    return true;
  }

  function nextIndex(manual) {
    if (P.repeat === 'one' && !manual) return P.index;
    if (P.index + 1 < P.queue.length) return P.index + 1;
    if (P.repeat === 'all' && P.queue.length) return 0;
    if (autoExtend()) return P.index + 1;
    return -1;
  }

  // ---------- Carga y reproducción ----------
  async function setSrc(a, track) {
    const url = await Lib.playUrl(track);
    if (!url) throw new Error('Sin acceso al archivo');
    if (a.dataset.id !== track.id || a.src !== new URL(url, location.href).href) {
      a.dataset.id = track.id;
      a.src = url;
    }
    a.playbackRate = a.defaultPlaybackRate = P.settings.speed;
  }

  function dropPreload() {
    if (preloaded && !fading) {
      const b = B();
      b.pause(); b.removeAttribute('src'); b.dataset.id = ''; b.load();
      preloaded = null;
    }
  }

  async function load(autoplay, startAt = 0) {
    const t = P.current();
    if (!t) return;
    fading = false;
    resetCounters();
    // Si ya estaba preparada en el otro reproductor, cambia sin pausa
    const useB = preloaded === t.id && B().dataset.id === t.id;
    const old = A();
    if (useB) {
      old.pause();
      cur = 1 - cur;
      setGain(cur, 1); setGain(1 - cur, 0);
    } else {
      old.pause();
      try { await setSrc(old, t); }
      catch (e) { emit('error', { track: t, error: e }); return skipOnError(); }
      setGain(cur, 1); setGain(1 - cur, 0);
      if (startAt) {
        const seek = () => { try { old.currentTime = startAt; } catch (e) { } };
        if (old.readyState >= 1) seek(); else old.addEventListener('loadedmetadata', seek, { once: true });
      }
    }
    preloaded = null;
    const other = B();
    other.pause();
    applyVolume();
    emit('track', t);
    if (autoplay) play(); else { P.playing = false; emit('state'); }
    save();
  }

  // Si la lectura del archivo falla o se corta a mitad de la canción, la retoma en el mismo punto
  // en lugar de saltar a la siguiente.
  let rec = { id: '', n: 0, at: 0 }, resumeAt = 0;
  function recover(a, reason) {
    const t = P.current();
    if (!t) return false;
    const pos = Math.max(lastT, a.currentTime || 0, resumeAt);
    const known = Math.max(t.duration || 0, isFinite(a.duration) ? a.duration : 0);
    if (reason === 'ended' && !(known && pos > 1 && pos < known - 4)) return false;
    if (reason === 'error' && pos < 1) return false;
    if (rec.id !== t.id || Math.abs(rec.at - pos) > 5) rec = { id: t.id, n: 0, at: pos };
    if (rec.n >= (reason === 'ended' ? 1 : 3)) return false;
    rec.n++;
    resumeAt = pos;
    const base = a.src.split('#')[0];
    a.addEventListener('loadedmetadata', () => { try { a.currentTime = pos; } catch (e) { } }, { once: true });
    a.src = base + '#t=' + pos.toFixed(2);
    const pr = a.play();
    if (pr && pr.catch) pr.catch(() => { });
    return true;
  }

  function skipOnError() {
    errors++;
    if (errors >= Math.min(P.queue.length, 8)) { errors = 0; P.playing = false; emit('state'); return; }
    const n = nextIndex(true);
    if (n >= 0 && n !== P.index) { P.index = n; load(true); }
    else { P.playing = false; emit('state'); }
  }

  function play() {
    if (userGesture()) graph();
    P.resume();
    const a = A();
    if (!a.src) { const t = P.current(); if (t) return load(true); return; }
    sleepFade = 1; applyVolume();
    const pr = a.play();
    if (pr && pr.catch) pr.catch(err => { if (err.name !== 'AbortError') { P.playing = false; emit('state'); } });
  }
  P.play = play;
  P.pause = function () { A().pause(); if (fading) { B().pause(); } };
  P.toggle = () => (P.playing ? P.pause() : play());

  P.next = function () {
    if (!P.queue.length) return;
    const n = nextIndex(true);
    if (n < 0) { P.pause(); A().currentTime = 0; return; }
    if (fading) finishFade();
    P.index = n; load(true);
  };
  P.prev = function () {
    if (!P.queue.length) return;
    const a = A();
    if (a.currentTime > 3 || P.index === 0) { a.currentTime = 0; if (!P.playing) play(); emit('time'); return; }
    if (fading) finishFade();
    P.index = P.index - 1; load(true);
  };
  P.seek = function (sec) {
    const a = A();
    if (!isFinite(sec)) return;
    if (fading) finishFade();
    try { a.currentTime = Math.max(0, Math.min(sec, (a.duration || sec))); } catch (e) { }
    lastT = a.currentTime;
    emit('time');
  };
  P.time = () => A().currentTime || 0;
  P.duration = () => { const a = A(); return isFinite(a.duration) && a.duration ? a.duration : (P.current() || {}).duration || 0; };

  // ---------- Crossfade y precarga ----------
  async function preloadNext() {
    const n = nextIndex(false);
    if (n < 0 || n === P.index) return;
    const t = Lib.tracks.get(P.queue[n]);
    if (!t || preloaded === t.id) return;
    preloaded = t.id;
    try { await setSrc(B(), t); setGain(1 - cur, 0); B().load(); }
    catch (e) { preloaded = null; }
  }

  function startFade() {
    const n = nextIndex(false);
    if (n < 0 || n === P.index || !ctx) return;
    const t = Lib.tracks.get(P.queue[n]);
    if (preloaded !== t.id) return;
    fading = true;
    const cf = P.settings.crossfade;
    const oldIdx = cur;
    const nb = B();
    setGain(1 - cur, 0); setGain(1 - cur, 1, cf);
    setGain(cur, 0, cf);
    nb.currentTime = 0;
    nb.play().catch(() => { });
    countPlay();
    cur = 1 - cur;
    P.index = n;
    preloaded = null;
    resetCounters();
    emit('track', t);
    save();
    fadeTimer = setTimeout(() => { if (fading && cur !== oldIdx) { els[oldIdx].pause(); fading = false; } }, cf * 1000 + 300);
  }
  let fadeTimer = null;
  function finishFade() {
    clearTimeout(fadeTimer);
    B().pause();
    setGain(1 - cur, 0); setGain(cur, 1);
    fading = false;
  }

  // ---------- Conteo de reproducciones ----------
  function resetCounters() { listened = 0; lastT = 0; counted = false; resumeAt = 0; }
  function countPlay() {
    if (counted) return;
    counted = true;
    const t = P.current();
    if (t) emit('played', t);
  }

  // ---------- Eventos de los reproductores ----------
  els.forEach((a, i) => {
    a.addEventListener('play', () => { if (i === cur) { P.playing = true; emit('state'); } });
    a.addEventListener('playing', () => { if (i === cur) { errors = 0; P.playing = true; emit('state'); } });
    a.addEventListener('pause', () => { if (i === cur && !a.ended) { P.playing = false; emit('state'); save(); } });
    a.addEventListener('loadedmetadata', () => {
      if (a.dataset.id && isFinite(a.duration)) Lib.setDuration(a.dataset.id, a.duration);
      if (i === cur) emit('time');
    });
    a.addEventListener('timeupdate', () => {
      if (i !== cur) return;
      const ct = a.currentTime, d = a.duration;
      if (resumeAt) { if (ct < resumeAt - 1.5) return; resumeAt = 0; lastT = ct; }
      const delta = ct - lastT;
      if (delta > 0 && delta < 2 && P.playing) {
        listened += delta;
        emit('listen', delta);
      }
      lastT = ct;
      if (!counted && (listened >= 30 || (d && listened >= d * 0.5))) countPlay();
      emit('time');
      checkSleep();
      if (d && isFinite(d) && P.repeat !== 'one') {
        const rem = d - ct;
        const cf = P.settings.crossfade;
        if (!fading && rem < Math.max(cf + 6, 12)) preloadNext();
        if (cf > 0 && ctx && !fading && rem <= cf && rem > 0.2 && !(P.sleep && P.sleep.track) && d > cf * 2.5) startFade();
      }
    });
    a.addEventListener('ended', () => {
      if (i !== cur) return;
      if (recover(a, 'ended')) return;
      countPlay();
      if (P.sleep && P.sleep.track) { P.sleep = null; emit('sleep'); P.playing = false; emit('state'); return; }
      if (P.repeat === 'one') { a.currentTime = 0; resetCounters(); play(); return; }
      const n = nextIndex(false);
      if (n < 0) { P.playing = false; emit('state'); emit('ended'); return; }
      P.index = n;
      load(true);
    });
    a.addEventListener('error', () => {
      if (i !== cur || !a.getAttribute('src')) return;
      if (recover(a, 'error')) return;
      emit('error', { track: P.current() });
      skipOnError();
    });
  });

  // ---------- Temporizador para dormir ----------
  let sleepTick = null;
  P.setSleep = function (minutes) {
    clearInterval(sleepTick);
    sleepFade = 1; applyVolume();
    if (minutes === 'track') P.sleep = { track: true };
    else if (minutes > 0) { P.sleep = { end: Date.now() + minutes * 60000 }; sleepTick = setInterval(checkSleep, 1000); }
    else P.sleep = null;
    emit('sleep');
  };
  function checkSleep() {
    if (!P.sleep || !P.sleep.end) return;
    const left = P.sleep.end - Date.now();
    if (left <= 0) {
      clearInterval(sleepTick);
      P.sleep = null;
      P.pause();
      sleepFade = 1; setTimeout(applyVolume, 300);
      emit('sleep');
    } else if (left < 10000) { sleepFade = left / 10000; applyVolume(); }
  }

  // ---------- Sesión ----------
  function save() {
    if (P.index < 0) return;
    DB.later('session', {
      queue: P.queue, original: P.original, index: P.index, pos: A().currentTime || 0,
      shuffle: P.shuffle, repeat: P.repeat, from: P.from
    }, 400);
  }
  P.save = save;
  setInterval(() => { if (P.playing) save(); }, 5000);

  P.restore = async function () {
    const s = await DB.get('kv', 'session');
    if (!s || !s.queue || !s.queue.length) return;
    P.queue = s.queue.filter(id => Lib.tracks.has(id));
    if (!P.queue.length) return;
    const curId = s.queue[s.index];
    P.index = Math.max(0, P.queue.indexOf(curId));
    P.original = s.original ? s.original.filter(id => Lib.tracks.has(id)) : null;
    P.shuffle = !!s.shuffle; P.repeat = s.repeat || 'off'; P.from = s.from || P.from;
    emit('queue'); emit('mode');
    const t = P.current();
    if (t && Lib.canPlay(t)) await load(false, P.queue[P.index] === curId ? s.pos || 0 : 0);
    else if (t) { emit('track', t); emit('state'); }
  };

  // ---------- Controles del sistema (pantalla bloqueada / notificación) ----------
  const ms = navigator.mediaSession;
  if (ms && !native) {
    const h = (a, f) => { try { ms.setActionHandler(a, f); } catch (e) { } };
    h('play', play); h('pause', P.pause); h('nexttrack', P.next); h('previoustrack', P.prev);
    h('seekto', d => P.seek(d.seekTime));
    h('seekbackward', d => P.seek(P.time() - (d.seekOffset || 10)));
    h('seekforward', d => P.seek(P.time() + (d.seekOffset || 10)));
  }
  P.on('track', async t => {
    if (native) {
      const art = await Lib.artDataUrl(Lib.artOf(t), 384);
      try { native.setMeta(JSON.stringify({ title: t.title, artist: t.artist, album: t.album, duration: Math.round((t.duration || 0) * 1000), art })); } catch (e) { }
    } else if (ms && global.MediaMetadata) {
      const url = await Lib.artUrl(Lib.artOf(t));
      ms.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: t.album, artwork: url ? [{ src: url, sizes: '640x640', type: 'image/jpeg' }] : [] });
    }
  });
  let lastNative = 0;
  function pushState(force) {
    const now = Date.now();
    if (!force && now - lastNative < 2000) return;
    lastNative = now;
    if (native) {
      try { native.setState(P.playing, Math.round(P.time() * 1000), Math.round(P.duration() * 1000), P.settings.speed); } catch (e) { }
    } else if (ms) {
      ms.playbackState = P.playing ? 'playing' : 'paused';
      try { if (P.duration()) ms.setPositionState({ duration: P.duration(), position: Math.min(P.time(), P.duration()), playbackRate: P.settings.speed }); } catch (e) { }
    }
  }
  P.on('state', () => pushState(true));
  P.on('time', () => pushState(false));

  // Comandos desde Android (notificación, auriculares, pantalla bloqueada)
  global.VelumNative = global.VelumNative || {};
  global.VelumNative.onCommand = function (cmd, arg) {
    switch (cmd) {
      case 'play': play(); break;
      case 'pause': P.pause(); break;
      case 'toggle': P.toggle(); break;
      case 'next': P.next(); break;
      case 'prev': P.prev(); break;
      case 'seek': P.seek((+arg || 0) / 1000); break;
      case 'duck': P.duck(true); break;
      case 'unduck': P.duck(false); break;
      case 'stop': P.pause(); break;
    }
  };

  global.Player = P;
})(window);
