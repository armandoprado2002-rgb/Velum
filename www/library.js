/* Velum · biblioteca: carpetas, escaneo, etiquetas, carátulas e índices */
(function (global) {
  'use strict';

  const META_VERSION = 3;
  const AUDIO = new Set(['mp3', 'm4a', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wav', 'webm', 'weba', 'mp4', '3gp', 'm4b']);
  const IMAGES = /\.(jpe?g|png|webp)$/i;
  const COVER_NAMES = ['cover', 'folder', 'front', 'album', 'albumart', 'albumartsmall', 'artwork'];
  const native = global.AndroidBridge || null;
  const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const extOf = n => { const i = n.lastIndexOf('.'); return i < 0 ? '' : n.slice(i + 1).toLowerCase(); };
  const dirOf = p => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); };
  const baseOf = p => p.slice(p.lastIndexOf('/') + 1);
  const noExt = p => p.replace(/\.[^./]+$/, '');

  const listeners = {};
  const emit = (ev, data) => (listeners[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } });

  const Lib = {
    native: !!native,
    tracks: new Map(),       // id → canción
    refs: new Map(),         // ruta (minúsculas) → referencia a archivo (para .lrc, imágenes, m3u)
    lrc: new Map(),          // ruta sin extensión (minúsculas) → ruta real
    covers: new Map(),       // carpeta (minúsculas) → ruta de imagen
    m3u: [],
    filePlaylists: [],
    roots: [],               // carpetas elegidas [{id, name, needsPermission}]
    albums: new Map(), artists: new Map(), genres: new Map(),
    sorted: [],              // canciones visibles ordenadas por título
    scanning: false,
    progress: { done: 0, total: 0, phase: '' },
    settings: { hideShort: false },
    on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); },
    norm, collator, extOf, dirOf, baseOf
  };

  // ---------- Acceso a archivos ----------
  const fileRefs = new Map(); // ruta real → File | FileSystemFileHandle | uri (Android)

  function mediaUrl(u) { return '/__velum/media?u=' + encodeURIComponent(u); }

  async function getFile(path) {
    const r = fileRefs.get(path);
    if (!r) return null;
    if (r instanceof File) return r;
    if (r.getFile) return r.getFile();
    return null;
  }

  async function readBytes(path, start, len) {
    if (len <= 0) return new Uint8Array(0);
    const r = fileRefs.get(path);
    if (typeof r === 'string') {
      const res = await fetch(mediaUrl(r), { headers: { Range: `bytes=${start}-${start + len - 1}` } });
      if (!res.ok) throw new Error('read ' + res.status);
      const b = new Uint8Array(await res.arrayBuffer());
      return b.length > len ? b.subarray(0, len) : b;
    }
    const f = await getFile(path);
    if (!f) throw new Error('sin acceso');
    return new Uint8Array(await f.slice(start, start + len).arrayBuffer());
  }

  async function readText(path) {
    const r = fileRefs.get(path);
    if (typeof r === 'string') return (await fetch(mediaUrl(r))).text();
    const f = await getFile(path);
    return f ? f.text() : '';
  }

  async function readBlob(path) {
    const r = fileRefs.get(path);
    if (typeof r === 'string') return (await fetch(mediaUrl(r))).blob();
    return getFile(path);
  }

  const objectUrls = new Map();
  Lib.playUrl = async function (track) {
    const r = fileRefs.get(track.path);
    if (typeof r === 'string') return mediaUrl(r);
    if (objectUrls.has(track.path)) return objectUrls.get(track.path);
    const f = await getFile(track.path);
    if (!f) return null;
    const url = URL.createObjectURL(f);
    objectUrls.set(track.path, url);
    if (objectUrls.size > 6) { // libera las más viejas
      const [k, v] = objectUrls.entries().next().value;
      URL.revokeObjectURL(v); objectUrls.delete(k);
    }
    return url;
  };
  Lib.canPlay = track => fileRefs.has(track.path);

  // ---------- Carpetas ----------
  let pickResolve = null;
  global.VelumNative = global.VelumNative || {};
  global.VelumNative.onFolderPicked = ok => { if (pickResolve) { pickResolve(!!ok); pickResolve = null; } };

  async function loadRoots() {
    if (native) {
      try { Lib.roots = await (await fetch('/__velum/folders')).json(); } catch (e) { Lib.roots = []; }
    } else {
      const saved = (await DB.get('kv', 'roots')) || [];
      Lib.roots = [];
      for (const r of saved) {
        let needs = false;
        if (r.handle && r.handle.queryPermission) {
          try { needs = (await r.handle.queryPermission({ mode: 'read' })) !== 'granted'; } catch (e) { needs = true; }
        }
        Lib.roots.push({ id: r.id, name: r.name, handle: r.handle, kind: r.handle ? 'handle' : 'files', needsPermission: needs || !r.handle });
      }
    }
    emit('roots', Lib.roots);
  }

  async function saveRoots() {
    if (native) return;
    await DB.set('kv', 'roots', Lib.roots.map(r => ({ id: r.id, name: r.name, handle: r.handle || null })));
  }

  Lib.supportsHandles = !native && typeof global.showDirectoryPicker === 'function';

  Lib.addFolder = async function () {
    if (native) {
      const ok = await new Promise(res => { pickResolve = res; native.pickFolder(); });
      if (!ok) return false;
      await loadRoots();
      await Lib.scan();
      return true;
    }
    if (Lib.supportsHandles) {
      let handle;
      try { handle = await global.showDirectoryPicker({ id: 'velum-music', mode: 'read', startIn: 'music' }); }
      catch (e) { return false; }
      for (const r of Lib.roots) if (r.handle && await r.handle.isSameEntry(handle)) { r.needsPermission = false; await Lib.scan(); return true; }
      Lib.roots.push({ id: 'h' + Date.now(), name: handle.name, handle, kind: 'handle', needsPermission: false });
      await saveRoots();
      await Lib.scan();
      return true;
    }
    // Navegadores sin acceso a carpetas: selector clásico (hay que volver a elegirla en cada sesión)
    const input = document.getElementById('dir-input');
    const files = await new Promise(res => {
      input.value = '';
      input.onchange = () => res(Array.from(input.files || []));
      input.click();
    });
    if (!files.length) return false;
    const name = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'Música';
    let root = Lib.roots.find(r => r.name === name);
    if (!root) { root = { id: 'f' + Date.now(), name, kind: 'files' }; Lib.roots.push(root); }
    root.needsPermission = false;
    root.files = files;
    await saveRoots();
    await Lib.scan();
    return true;
  };

  Lib.reconnect = async function () {
    let any = false;
    for (const r of Lib.roots) {
      if (!r.needsPermission) continue;
      if (r.handle) {
        try { if ((await r.handle.requestPermission({ mode: 'read' })) === 'granted') { r.needsPermission = false; any = true; } } catch (e) { }
      }
    }
    if (!any && Lib.roots.some(r => r.kind === 'files' && r.needsPermission)) return Lib.addFolder();
    if (any) await Lib.scan();
    emit('roots', Lib.roots);
    return any;
  };

  Lib.removeFolder = async function (id) {
    const r = Lib.roots.find(x => x.id === id);
    if (!r) return;
    if (native) native.removeFolder(id);
    Lib.roots = Lib.roots.filter(x => x !== r);
    await saveRoots();
    const prefix = r.name + '/';
    const files = ((await DB.get('kv', 'files')) || []).filter(f => !f.p.startsWith(prefix) || Lib.roots.some(o => f.p.startsWith(o.name + '/')));
    await DB.set('kv', 'files', files);
    ingest(files, false);
    emit('roots', Lib.roots);
  };

  // ---------- Escaneo ----------
  async function walk(dir, prefix, out) {
    for await (const [name, h] of dir.entries()) {
      if (name.startsWith('.')) continue;
      const p = prefix + '/' + name;
      if (h.kind === 'directory') await walk(h, p, out);
      else {
        const ext = extOf(name);
        if (AUDIO.has(ext) || ext === 'lrc' || ext === 'm3u' || ext === 'm3u8' || IMAGES.test(name)) {
          try {
            const f = await h.getFile();
            out.push({ p, s: f.size, m: f.lastModified, ref: AUDIO.has(ext) ? h : f });
          } catch (e) { }
        }
      }
    }
  }

  Lib.scan = async function () {
    if (Lib.scanning) return;
    Lib.scanning = true;
    Lib.progress = { done: 0, total: 0, phase: 'scan' };
    emit('progress', Lib.progress);
    try {
      let list = [];
      if (native) {
        const res = await fetch('/__velum/scan');
        list = (await res.json()).map(f => ({ p: f.p, s: f.s, m: f.m, ref: f.u }));
      } else {
        for (const r of Lib.roots) {
          if (r.needsPermission) {
            // conserva lo que ya conocíamos de esa carpeta
            const old = ((await DB.get('kv', 'files')) || []).filter(f => f.p.startsWith(r.name + '/'));
            old.forEach(f => list.push({ p: f.p, s: f.s, m: f.m }));
            continue;
          }
          if (r.handle) await walk(r.handle, r.name, list);
          else if (r.files) for (const f of r.files) {
            const ext = extOf(f.name);
            if (AUDIO.has(ext) || ext === 'lrc' || ext === 'm3u' || ext === 'm3u8' || IMAGES.test(f.name))
              list.push({ p: f.webkitRelativePath || (r.name + '/' + f.name), s: f.size, m: f.lastModified, ref: f });
          }
        }
      }
      for (const f of list) if (f.ref) fileRefs.set(f.p, f.ref);
      const compact = list.map(f => (typeof f.ref === 'string' ? { p: f.p, s: f.s, m: f.m, u: f.ref } : { p: f.p, s: f.s, m: f.m }));
      await DB.set('kv', 'files', compact);
      ingest(compact, true);
      await analyze();
    } catch (e) {
      console.error(e);
      emit('error', e);
    } finally {
      Lib.scanning = false;
      Lib.progress = { done: 0, total: 0, phase: '' };
      emit('progress', Lib.progress);
    }
  };

  // ---------- Construcción de la biblioteca ----------
  let metaCache = new Map();

  function fromName(name) {
    let base = noExt(name).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
    base = base.replace(/^\d{1,3}\s*[-.)]\s*/, '').replace(/^\d{2}\s+(?=\D)/, '');
    const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(base);
    return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: base || name };
  }

  // En Android las carátulas las saca el propio teléfono (con su lector y una caché en disco)
  // y se muestran directamente; en el navegador se guardan en la base local.
  function artKeyFor(path, folder, stored) {
    const cover = Lib.covers.get(folder.toLowerCase());
    if (native) {
      if (stored && stored.startsWith('p')) return 'n:' + path;
      if (cover) return 'f:' + cover.p;
      return 'n:' + path;
    }
    if (stored) return stored;
    return cover ? 'f:' + cover.p : '';
  }

  function makeTrack(f) {
    const name = baseOf(f.p);
    const folder = dirOf(f.p);
    const rec = metaCache.get(f.p);
    const valid = rec && rec.v === META_VERSION && rec.s === f.s && rec.m === f.m;
    const t = valid ? rec.t : {};
    const guess = fromName(name);
    const folderName = baseOf(folder);
    return {
      id: f.p, path: f.p, name, folder, ext: extOf(name), size: f.s, mtime: f.m, added: f.m || 0,
      title: t.title || guess.title,
      artist: t.artist || guess.artist || 'Artista desconocido',
      album: t.album || folderName || 'Sin álbum',
      albumArtist: t.albumArtist || '',
      genre: t.genre || '', year: t.year || '', trackNo: t.trackNo || 0, discNo: t.discNo || 0,
      duration: t.duration || (rec && rec.dur) || 0,
      art: artKeyFor(f.p, folder, valid ? rec.art || '' : ''), color: valid ? rec.color || null : null,
      lyricsText: t.lyrics || '',
      tagged: !!valid, noTags: valid && !t.title
    };
  }

  function ingest(files, keepRefs) {
    Lib.tracks = new Map();
    Lib.lrc = new Map();
    Lib.covers = new Map();
    Lib.m3u = [];
    for (const f of files) if (f.u) fileRefs.set(f.p, f.u);
    for (const f of files) {
      const ext = extOf(f.p);
      if (AUDIO.has(ext)) continue;
      if (ext === 'lrc') Lib.lrc.set(noExt(f.p).toLowerCase(), f.p);
      else if (ext === 'm3u' || ext === 'm3u8') Lib.m3u.push(f.p);
      else if (IMAGES.test(f.p)) {
        const dir = dirOf(f.p).toLowerCase();
        const b = noExt(baseOf(f.p)).toLowerCase();
        const rank = COVER_NAMES.indexOf(b);
        const cur = Lib.covers.get(dir);
        const score = rank >= 0 ? rank : 50;
        if (!cur || score < cur.score) Lib.covers.set(dir, { p: f.p, score });
      }
    }
    for (const f of files) if (AUDIO.has(extOf(f.p))) Lib.tracks.set(f.p, makeTrack(f));
    if (!keepRefs) {
      const keep = new Set(files.map(f => f.p));
      for (const k of Array.from(fileRefs.keys())) if (!keep.has(k)) fileRefs.delete(k);
    }
    buildIndex();
    loadM3U();
  }

  function sortAlbumIds(ids) {
    return ids.sort((a, b) => {
      const x = Lib.tracks.get(a), y = Lib.tracks.get(b);
      return (x.discNo || 1) - (y.discNo || 1) || (x.trackNo || 999) - (y.trackNo || 999) || collator.compare(x.name, y.name);
    });
  }

  const primaryArtist = a => (a || '').split(/\s+(?:feat\.?|ft\.?|featuring|con)\s+/i)[0].trim() || 'Artista desconocido';

  function buildIndex() {
    const albums = new Map(), artists = new Map(), genres = new Map();
    const visible = [];
    // Si alguna canción del mismo álbum (en la misma carpeta) trae "artista del álbum", lo usan todas
    const folderAA = new Map();
    for (const t of Lib.tracks.values()) {
      const fk = t.folder.toLowerCase() + '|' + norm(t.album);
      if (t.albumArtist && !folderAA.has(fk)) folderAA.set(fk, t.albumArtist);
    }
    for (const t of Lib.tracks.values()) {
      if (Lib.settings.hideShort && t.duration && t.duration < 60) continue;
      visible.push(t);
      const aa = t.albumArtist || folderAA.get(t.folder.toLowerCase() + '|' + norm(t.album)) || '';
      const key = aa ? norm(aa) + '|' + norm(t.album) : norm(t.album) + '|' + t.folder.toLowerCase();
      t.albumKey = key;
      let al = albums.get(key);
      if (!al) {
        al = { key, title: t.album, artist: aa || t.artist, hasAA: !!aa, artists: new Set(), year: t.year, genre: t.genre, ids: [], art: '', color: null, added: 0, folder: t.folder };
        albums.set(key, al);
      }
      al.ids.push(t.id);
      al.artists.add(primaryArtist(t.artist));
      // Prefiere una carátula segura: imagen de la carpeta o una incrustada que ya se encontró
      const rank = !t.art ? 0 : !t.art.startsWith('n:') ? 3 : t.color ? 2 : 1;
      if (rank > (al.artRank || 0)) { al.art = t.art; al.color = t.color; al.artRank = rank; }
      if (!al.year && t.year) al.year = t.year;
      if (!al.genre && t.genre) al.genre = t.genre;
      al.added = Math.max(al.added, t.added);

      const an = primaryArtist(t.albumArtist && t.albumArtist !== 'Various Artists' && t.albumArtist !== 'Varios artistas' ? t.albumArtist : t.artist);
      const ak = norm(an);
      let ar = artists.get(ak);
      if (!ar) { ar = { key: ak, name: an, ids: [], albums: new Set(), art: '' }; artists.set(ak, ar); }
      ar.ids.push(t.id);
      ar.albums.add(key);
      if (!ar.art && t.art) ar.art = t.art;
      t.artistKey = ak;

      if (t.genre) {
        const gk = norm(t.genre);
        let g = genres.get(gk);
        if (!g) { g = { key: gk, name: t.genre, ids: [], art: '' }; genres.set(gk, g); }
        g.ids.push(t.id);
        if (!g.art && t.art) g.art = t.art;
      }
    }
    for (const al of albums.values()) {
      sortAlbumIds(al.ids);
      if (!al.hasAA) al.artist = al.artists.size > 1 ? 'Varios artistas' : Array.from(al.artists)[0];
      if (!al.art) {
        const c = Lib.covers.get(al.folder.toLowerCase());
        if (c) al.art = 'f:' + c.p;
      }
    }
    visible.sort((a, b) => collator.compare(a.title, b.title));
    Lib.sorted = visible.map(t => t.id);
    Lib.albums = albums; Lib.artists = artists; Lib.genres = genres;
    emit('change');
  }
  Lib.rebuild = buildIndex;

  Lib.artOf = t => t.art || (Lib.albums.get(t.albumKey) || {}).art || '';
  Lib.colorOf = t => t.color || (Lib.albums.get(t.albumKey) || {}).color || null;

  // ---------- Análisis de etiquetas ----------
  let changeTimer = null;
  const changed = () => { if (!changeTimer) changeTimer = setTimeout(() => { changeTimer = null; buildIndex(); }, 700); };

  function hashBytes(b) {
    let h = 0x811c9dc5;
    const step = Math.max(1, Math.floor(b.length / 4096));
    for (let i = 0; i < b.length; i += step) { h ^= b[i]; h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + b.length.toString(36);
  }

  async function decodeImage(blob) {
    try { return await createImageBitmap(blob); }
    catch (e) {
      // Respaldo: algunos archivos dicen "image/jpg" u otro tipo raro
      const url = URL.createObjectURL(new Blob([blob], { type: 'image/jpeg' }));
      try { const img = new Image(); img.src = url; await img.decode(); return img; }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
  }

  async function makeThumb(blob) {
    const bmp = await decodeImage(blob);
    const bw = bmp.naturalWidth || bmp.width, bh = bmp.naturalHeight || bmp.height;
    const s = Math.min(1, 640 / Math.max(bw, bh));
    const w = Math.max(1, Math.round(bw * s)), h = Math.max(1, Math.round(bh * s));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.drawImage(bmp, 0, 0, w, h);
    const color = pickColor(bmp);
    if (bmp.close) bmp.close();
    const out = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.88));
    return { blob: out, color };
  }

  // Color principal (vivo) para teñir el reproductor
  function pickColor(src) {
    const sc = document.createElement('canvas'); sc.width = sc.height = 24;
    const sg = sc.getContext('2d', { willReadFrequently: true });
    sg.drawImage(src, 0, 0, 24, 24);
    const px = sg.getImageData(0, 0, 24, 24).data;
    let R = 0, G = 0, B = 0, W = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      const sat = mx ? (mx - mn) / mx : 0;
      const lum = mx / 255;
      const w8 = 0.05 + sat * sat * (lum > 0.15 && lum < 0.95 ? 1 : 0.2);
      R += r * w8; G += gg * w8; B += b * w8; W += w8;
    }
    let color = [Math.round(R / W), Math.round(G / W), Math.round(B / W)];
    const mx = Math.max(...color);
    if (mx < 110) color = color.map(v => Math.round(v * 110 / Math.max(mx, 1)));
    return color;
  }

  async function storeArt(key, srcBlob) {
    const existing = await DB.get('art', key);
    if (existing) return existing.color;
    try {
      const { blob, color } = await makeThumb(srcBlob);
      await DB.set('art', key, { blob, color });
      return color;
    } catch (e) { return null; }
  }

  async function analyzeOne(t) {
    let tags = {};
    try { tags = await VelumTags.readTags((s, l) => readBytes(t.path, s, Math.min(l, t.size - s)), t.size); }
    catch (e) { tags = {}; }
    // En Android, si nuestro lector no encontró algo, pregunta al lector del sistema
    const uri = fileRefs.get(t.path);
    if (native && typeof uri === 'string' && (!tags.title || !tags.picture)) {
      try {
        const m = await (await fetch('/__velum/meta?u=' + encodeURIComponent(uri))).json();
        for (const k of ['title', 'artist', 'album', 'albumArtist', 'genre']) if (!tags[k] && m[k]) tags[k] = m[k];
        if (!tags.year && m.year) tags.year = (String(m.year).match(/\d{4}/) || [''])[0];
        if (!tags.trackNo && m.track) tags.trackNo = parseInt(m.track, 10) || 0;
        if (!tags.discNo && m.disc) tags.discNo = parseInt(m.disc, 10) || 0;
        if (!tags.duration && m.durationMs) tags.duration = +m.durationMs / 1000;
        if (!tags.picture && m.hasArt) {
          const r = await fetch('/__velum/art?u=' + encodeURIComponent(uri));
          if (r.ok) {
            const b = new Uint8Array(await r.arrayBuffer());
            if (b.length > 100) tags.picture = { mime: r.headers.get('content-type') || 'image/jpeg', data: b };
          }
        }
      } catch (e) { }
    }
    let art = '', color = null;
    if (tags.picture) {
      art = 'p' + hashBytes(tags.picture.data);
      color = await storeArt(art, new Blob([tags.picture.data], { type: tags.picture.mime }));
      if (!color) art = '';
    }
    if (!art) {
      const c = Lib.covers.get(t.folder.toLowerCase());
      if (c && fileRefs.has(c.p)) {
        try {
          const key = 'f:' + c.p;
          color = await storeArt(key, await readBlob(c.p));
          if (color) art = key;
        } catch (e) { }
      }
    }
    delete tags.picture;
    const rec = { v: META_VERSION, s: t.size, m: t.mtime, t: tags, art, color };
    metaCache.set(t.path, rec);
    return rec;
  }

  async function analyze() {
    const todo = Array.from(Lib.tracks.values()).filter(t => !t.tagged && fileRefs.has(t.path));
    if (!todo.length) return;
    Lib.progress = { done: 0, total: todo.length, phase: 'tags' };
    emit('progress', Lib.progress);
    let batch = [];
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const t = todo[i++];
        try {
          const rec = await analyzeOne(t);
          batch.push([t.path, rec]);
          const f = { p: t.path, s: t.size, m: t.mtime };
          Lib.tracks.set(t.path, makeTrack(f));
        } catch (e) { }
        Lib.progress.done++;
        if (Lib.progress.done % 8 === 0) emit('progress', Lib.progress);
        if (batch.length >= 40) { const b = batch; batch = []; DB.setMany('meta', b).catch(() => { }); }
        changed();
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (batch.length) await DB.setMany('meta', batch).catch(() => { });
    buildIndex();
  }

  // Guarda la duración real cuando se reproduce (corrige estimaciones)
  Lib.setDuration = function (id, d) {
    const t = Lib.tracks.get(id);
    if (!t || !d || !isFinite(d) || Math.abs((t.duration || 0) - d) < 1) return;
    t.duration = d;
    const rec = metaCache.get(id);
    if (rec) { rec.t.duration = d; DB.set('meta', id, rec).catch(() => { }); }
  };

  // ---------- Carátulas ----------
  const artUrls = new Map();
  Lib.artUrl = function (key) {
    if (!key) return Promise.resolve(null);
    if (artUrls.has(key)) return artUrls.get(key);
    if (native && (key.startsWith('n:') || key.startsWith('f:'))) {
      const u = fileRefs.get(key.slice(2));
      const url = !u ? null : key.startsWith('n:') ? '/__velum/art?u=' + encodeURIComponent(u) : mediaUrl(u);
      const pr = Promise.resolve(url);
      artUrls.set(key, pr);
      return pr;
    }
    const p = DB.get('art', key).then(async rec => {
      if (rec) return URL.createObjectURL(rec.blob);
      if (key.startsWith('f:')) {
        const path = key.slice(2);
        if (!fileRefs.has(path)) return null;
        const color = await storeArt(key, await readBlob(path));
        if (!color) return null;
        const r2 = await DB.get('art', key);
        return r2 ? URL.createObjectURL(r2.blob) : null;
      }
      return null;
    }).catch(() => null);
    artUrls.set(key, p);
    return p;
  };
  // Color principal de una carátula (desde la base local o leyendo la imagen)
  const colorCache = new Map();
  Lib.artColor = async key => {
    if (!key) return null;
    if (colorCache.has(key)) return colorCache.get(key);
    let color = null;
    const r = await DB.get('art', key).catch(() => null);
    if (r) color = r.color;
    else {
      const url = await Lib.artUrl(key);
      if (url) {
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          color = pickColor(img);
        } catch (e) { }
      }
    }
    colorCache.set(key, color);
    return color;
  };
  Lib.artDataUrl = async function (key, size = 320) {
    const url = await Lib.artUrl(key);
    if (!url) return '';
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d').drawImage(img, 0, 0, size, size);
      return c.toDataURL('image/jpeg', 0.82);
    } catch (e) { return ''; }
  };

  // ---------- Letras ----------
  const lyricCache = new Map();
  Lib.lyrics = async function (t) {
    if (lyricCache.has(t.id)) return lyricCache.get(t.id);
    let res = null;
    const lp = Lib.lrc.get(noExt(t.path).toLowerCase());
    if (lp && fileRefs.has(lp)) {
      try { res = VelumTags.parseLRC(await readText(lp)); } catch (e) { }
    }
    if (!res && t.lyricsText) res = VelumTags.parseLRC(t.lyricsText);
    lyricCache.set(t.id, res);
    return res;
  };
  Lib.hasLyricsFile = t => Lib.lrc.has(noExt(t.path).toLowerCase()) || !!t.lyricsText;

  // ---------- Listas .m3u de la carpeta ----------
  async function loadM3U() {
    const out = [];
    for (const p of Lib.m3u) {
      if (!fileRefs.has(p)) continue;
      try {
        const text = await readText(p);
        const dir = dirOf(p);
        const ids = [];
        for (let line of text.split(/\r?\n/)) {
          line = line.trim().replace(/^﻿/, '');
          if (!line || line.startsWith('#')) continue;
          line = line.replace(/\\/g, '/');
          try { line = decodeURIComponent(line.replace(/^file:\/\//, '')); } catch (e) { }
          const id = resolvePath(dir, line);
          if (id) ids.push(id);
        }
        if (ids.length) out.push({ id: 'm3u:' + p, name: noExt(baseOf(p)), ids, file: true });
      } catch (e) { }
    }
    Lib.filePlaylists = out;
    emit('change');
  }

  function resolvePath(dir, rel) {
    const parts = (rel.startsWith('/') || /^[a-z]:\//i.test(rel) ? rel.split('/') : (dir + '/' + rel).split('/'));
    const stack = [];
    for (const s of parts) { if (s === '..') stack.pop(); else if (s && s !== '.') stack.push(s); }
    const full = stack.join('/');
    if (Lib.tracks.has(full)) return full;
    const lower = full.toLowerCase();
    const tail2 = stack.slice(-2).join('/').toLowerCase();
    const tail1 = (stack[stack.length - 1] || '').toLowerCase();
    let best = null;
    for (const id of Lib.tracks.keys()) {
      const l = id.toLowerCase();
      if (l === lower) return id;
      if (l.endsWith('/' + tail2)) return id;
      if (!best && l.endsWith('/' + tail1)) best = id;
    }
    return best;
  }

  // ---------- Búsqueda ----------
  Lib.search = function (q) {
    const n = norm(q);
    if (!n) return null;
    const words = n.split(/\s+/);
    const match = s => { const x = norm(s); return words.every(w => x.includes(w)); };
    const score = (s) => { const x = norm(s); return x === n ? 0 : x.startsWith(n) ? 1 : 2; };
    const songs = [];
    for (const id of Lib.sorted) {
      const t = Lib.tracks.get(id);
      if (match(t.title + ' ' + t.artist + ' ' + t.album)) songs.push(t);
    }
    songs.sort((a, b) => score(a.title) - score(b.title));
    const albums = Array.from(Lib.albums.values()).filter(a => match(a.title + ' ' + a.artist)).sort((a, b) => score(a.title) - score(b.title));
    const artists = Array.from(Lib.artists.values()).filter(a => match(a.name)).sort((a, b) => score(a.name) - score(b.name));
    return { songs, albums, artists };
  };

  // ---------- Inicio ----------
  Lib.init = async function (settings) {
    Object.assign(Lib.settings, settings || {});
    metaCache = await DB.all('meta').catch(() => new Map());
    await loadRoots();
    const files = (await DB.get('kv', 'files')) || [];
    ingest(files, true);
    if (native) {
      if (Lib.roots.length) Lib.scan();
    } else if (Lib.roots.some(r => !r.needsPermission)) Lib.scan();
  };

  Lib.clearCache = async function () {
    await DB.clear('meta'); await DB.clear('art');
    metaCache = new Map();
    lyricCache.clear();
    artUrls.clear();
    for (const t of Lib.tracks.values()) { t.tagged = false; }
    await Lib.scan();
  };

  Lib.resetLyrics = id => lyricCache.delete(id);

  global.Lib = Lib;
})(window);
