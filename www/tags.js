/* Velum · lector de etiquetas (ID3v1/v2, FLAC, Ogg Vorbis/Opus, MP4/M4A, WAV).
   readTags(read, size) → { title, artist, album, albumArtist, track, disc, year, genre, duration, lyrics, picture:{mime,data} }
   read(start, length) debe devolver una Promise<Uint8Array>. */
(function (global) {
  'use strict';

  const GENRES = ('Blues,Classic Rock,Country,Dance,Disco,Funk,Grunge,Hip-Hop,Jazz,Metal,New Age,Oldies,Other,Pop,R&B,Rap,Reggae,Rock,Techno,' +
    'Industrial,Alternative,Ska,Death Metal,Pranks,Soundtrack,Euro-Techno,Ambient,Trip-Hop,Vocal,Jazz+Funk,Fusion,Trance,Classical,Instrumental,' +
    'Acid,House,Game,Sound Clip,Gospel,Noise,AlternRock,Bass,Soul,Punk,Space,Meditative,Instrumental Pop,Instrumental Rock,Ethnic,Gothic,Darkwave,' +
    'Techno-Industrial,Electronic,Pop-Folk,Eurodance,Dream,Southern Rock,Comedy,Cult,Gangsta,Top 40,Christian Rap,Pop/Funk,Jungle,Native American,' +
    'Cabaret,New Wave,Psychedelic,Rave,Showtunes,Trailer,Lo-Fi,Tribal,Acid Punk,Acid Jazz,Polka,Retro,Musical,Rock & Roll,Hard Rock,Folk,Folk-Rock,' +
    'National Folk,Swing,Fast Fusion,Bebop,Latin,Revival,Celtic,Bluegrass,Avantgarde,Gothic Rock,Progressive Rock,Psychedelic Rock,Symphonic Rock,' +
    'Slow Rock,Big Band,Chorus,Easy Listening,Acoustic,Humour,Speech,Chanson,Opera,Chamber Music,Sonata,Symphony,Booty Bass,Primus,Porn Groove,' +
    'Satire,Slow Jam,Club,Tango,Samba,Folklore,Ballad,Power Ballad,Rhythmic Soul,Freestyle,Duet,Punk Rock,Drum Solo,A Cappella,Euro-House,' +
    'Dance Hall,Goa,Drum & Bass,Club-House,Hardcore,Terror,Indie,BritPop,Afro-Punk,Polsk Punk,Beat,Christian Gangsta Rap,Heavy Metal,Black Metal,' +
    'Crossover,Contemporary Christian,Christian Rock,Merengue,Salsa,Thrash Metal,Anime,JPop,Synthpop').split(',');

  const latin1 = new TextDecoder('latin1');
  const utf8 = new TextDecoder('utf-8');
  const utf16le = new TextDecoder('utf-16le');
  const utf16be = new TextDecoder('utf-16be');
  const clean = s => (s || '').replace(/\0+$/g, '').replace(/\0/g, ' / ').trim();
  const u32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
  const u32le = (b, o) => b[o] + (b[o + 1] << 8) + (b[o + 2] << 16) + ((b[o + 3] << 24) >>> 0);
  const u24 = (b, o) => (b[o] << 16) + (b[o + 1] << 8) + b[o + 2];
  const syncsafe = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
  const str = (b, o, n) => latin1.decode(b.subarray(o, o + n));

  function genreName(g) {
    if (!g) return '';
    g = g.trim();
    const m = /^\((\d+)\)(.*)$/.exec(g);
    if (m) return m[2].trim() || GENRES[+m[1]] || '';
    if (/^\d+$/.test(g)) return GENRES[+g] || '';
    return g;
  }

  function num(v) {
    const n = parseInt(String(v || '').split('/')[0], 10);
    return isFinite(n) ? n : 0;
  }

  // ---------- ID3v2 ----------
  function decodeText(enc, b) {
    if (!b.length) return '';
    switch (enc) {
      case 0: return latin1.decode(b);
      case 1: {
        if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF) return utf16be.decode(b.subarray(2));
        if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) return utf16le.decode(b.subarray(2));
        return utf16le.decode(b);
      }
      case 2: return utf16be.decode(b);
      default: return utf8.decode(b);
    }
  }

  // Encuentra el final de una cadena terminada en nulo según la codificación.
  function strEnd(b, o, enc) {
    if (enc === 1 || enc === 2) {
      for (let i = o; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
      return b.length;
    }
    for (let i = o; i < b.length; i++) if (b[i] === 0) return i;
    return b.length;
  }
  const termLen = enc => (enc === 1 || enc === 2 ? 2 : 1);

  function unsync(b) {
    const out = new Uint8Array(b.length);
    let j = 0;
    for (let i = 0; i < b.length; i++) {
      out[j++] = b[i];
      if (b[i] === 0xFF && b[i + 1] === 0x00) i++;
    }
    return out.subarray(0, j);
  }

  function nextOk(b, q, idLen) {
    if (q === b.length) return true;
    if (q < 0 || q > b.length) return false;
    if (b[q] === 0) return true;
    return q + idLen <= b.length && /^[A-Z0-9]+$/.test(str(b, q, idLen));
  }

  function parseID3v2(tag, t) {
    const ver = tag[3];
    const flags = tag[5];
    let body = tag.subarray(10);
    if (ver < 4 && flags & 0x80) body = unsync(body);
    let p = 0;
    if (flags & 0x40) p = ver === 3 ? u32(body, 0) + 4 : syncsafe(body, 0);
    const idLen = ver === 2 ? 3 : 4;
    const hdrLen = ver === 2 ? 6 : 10;
    const map = {
      TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TALB: 'album', TAL: 'album',
      TPE2: 'albumArtist', TP2: 'albumArtist', TRCK: 'track', TRK: 'track', TPOS: 'disc', TPA: 'disc',
      TYER: 'year', TYE: 'year', TDRC: 'year', TCON: 'genre', TCO: 'genre', TLEN: 'tlen', TLE: 'tlen'
    };
    while (p + hdrLen <= body.length) {
      const id = str(body, p, idLen);
      if (!/^[A-Z0-9]+$/.test(id)) break;
      let size = ver === 2 ? u24(body, p + 3) : ver === 4 ? syncsafe(body, p + 4) : u32(body, p + 4);
      if (ver === 4) {
        // iTunes escribe tamaños normales (no synchsafe) en v2.4: si el siguiente marco no cuadra, prueba así
        const plain = u32(body, p + 4);
        if (plain !== size && !nextOk(body, p + hdrLen + size, idLen) && nextOk(body, p + hdrLen + plain, idLen)) size = plain;
      }
      const fflags = ver === 2 ? 0 : body[p + 9];
      let data = body.subarray(p + hdrLen, p + hdrLen + size);
      p += hdrLen + size;
      if (size <= 0) continue;
      if (ver === 4) {
        if (fflags & 0x01) data = data.subarray(4); // indicador de longitud
        if (fflags & 0x02) data = unsync(data);
      }
      if (ver === 3 && fflags & 0xC0) continue; // comprimido/cifrado: lo saltamos
      try {
        if (map[id]) {
          const v = clean(decodeText(data[0], data.subarray(1)));
          const k = map[id];
          if (v && !t[k]) t[k] = v;
        } else if ((id === 'APIC' || id === 'PIC') && !t.picture) {
          const enc = data[0];
          let o = 1, mime;
          if (id === 'PIC') {
            const fmt = str(data, 1, 3).toLowerCase();
            mime = fmt === 'png' ? 'image/png' : 'image/jpeg';
            o = 4;
          } else {
            const e = strEnd(data, 1, 0);
            mime = str(data, 1, e - 1).toLowerCase().replace('image/jpg', 'image/jpeg') || 'image/jpeg';
            if (!mime.includes('/')) mime = 'image/' + (mime === 'png' ? 'png' : 'jpeg');
            o = e + 1;
          }
          const type = data[o++];
          o = strEnd(data, o, enc) + termLen(enc);
          const img = data.slice(o);
          if (img.length > 100 && (type === 3 || !t.picture)) t.picture = { mime, data: img };
        } else if ((id === 'USLT' || id === 'ULT') && !t.lyrics) {
          const enc = data[0];
          let o = 4;
          o = strEnd(data, o, enc) + termLen(enc);
          t.lyrics = decodeText(enc, data.subarray(o)).replace(/\0+$/, '').trim();
        }
      } catch (e) { /* marco dañado: seguimos */ }
    }
  }

  function parseID3v1(b, t) {
    if (b.length < 128 || str(b, 0, 3) !== 'TAG') return;
    const f = (o, n) => clean(latin1.decode(b.subarray(o, o + n)));
    t.title = t.title || f(3, 30);
    t.artist = t.artist || f(33, 30);
    t.album = t.album || f(63, 30);
    t.year = t.year || f(93, 4);
    if (b[125] === 0 && b[126]) t.track = t.track || String(b[126]);
    if (!t.genre && b[127] < GENRES.length) t.genre = GENRES[b[127]];
  }

  // ---------- MP3: duración ----------
  const BR = {
    '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  };
  const SR = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 25: [11025, 12000, 8000] };

  function mp3Duration(b, audioStart, size) {
    for (let i = 0; i + 4 < b.length; i++) {
      if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) continue;
      const vb = (b[i + 1] >> 3) & 3, lb = (b[i + 1] >> 1) & 3;
      const bri = b[i + 2] >> 4, sri = (b[i + 2] >> 2) & 3;
      if (vb === 1 || lb === 0 || bri === 0 || bri === 15 || sri === 3) continue;
      const ver = vb === 3 ? 1 : vb === 2 ? 2 : 25;
      const layer = 4 - lb;
      const sr = SR[ver][sri];
      const br = BR[(ver === 1 ? '1' : '2') + '-' + (ver === 1 ? layer : layer === 1 ? 1 : 2)][bri];
      const mono = (b[i + 3] >> 6) === 3;
      const spf = layer === 1 ? 384 : layer === 2 || ver === 1 ? 1152 : 576;
      const xo = i + 4 + (ver === 1 ? (mono ? 17 : 32) : (mono ? 9 : 17));
      const x = str(b, xo, 4);
      if ((x === 'Xing' || x === 'Info') && b[xo + 7] & 1) {
        const frames = u32(b, xo + 8);
        if (frames) return frames * spf / sr;
      }
      if (str(b, i + 36, 4) === 'VBRI') {
        const frames = u32(b, i + 36 + 14);
        if (frames) return frames * spf / sr;
      }
      return (size - audioStart - i) * 8 / (br * 1000);
    }
    return 0;
  }

  // ---------- Vorbis comment (FLAC / Ogg) ----------
  function parseVorbisComment(b, o, t) {
    const vlen = u32le(b, o); o += 4 + vlen;
    const n = u32le(b, o); o += 4;
    for (let i = 0; i < n && o + 4 <= b.length; i++) {
      const len = u32le(b, o); o += 4;
      const s = utf8.decode(b.subarray(o, o + len)); o += len;
      const eq = s.indexOf('=');
      if (eq < 0) continue;
      const k = s.slice(0, eq).toUpperCase(), v = s.slice(eq + 1).trim();
      if (!v) continue;
      const map = {
        TITLE: 'title', ARTIST: 'artist', ALBUM: 'album', ALBUMARTIST: 'albumArtist', 'ALBUM ARTIST': 'albumArtist',
        TRACKNUMBER: 'track', DISCNUMBER: 'disc', DATE: 'year', YEAR: 'year', GENRE: 'genre', LYRICS: 'lyrics', UNSYNCEDLYRICS: 'lyrics'
      };
      if (map[k]) {
        if (k === 'ARTIST' && t.artist) t.artist += ', ' + v;
        else if (!t[map[k]]) t[map[k]] = v;
      } else if (k === 'METADATA_BLOCK_PICTURE' && !t.picture) {
        try {
          const bin = Uint8Array.from(atob(v), c => c.charCodeAt(0));
          parseFlacPicture(bin, 0, t);
        } catch (e) { }
      }
    }
  }

  function parseFlacPicture(b, o, t) {
    const type = u32(b, o); o += 4;
    const ml = u32(b, o); o += 4;
    const mime = str(b, o, ml) || 'image/jpeg'; o += ml;
    const dl = u32(b, o); o += 4 + dl + 16;
    const len = u32(b, o); o += 4;
    if (len > 100 && (!t.picture || type === 3)) t.picture = { mime, data: b.slice(o, o + len) };
  }

  async function parseFLAC(read, start, size, t) {
    let o = start + 4;
    for (let guard = 0; guard < 64 && o < size; guard++) {
      const h = await read(o, 4);
      if (h.length < 4) break;
      const last = h[0] & 0x80, type = h[0] & 0x7F, len = u24(h, 1);
      o += 4;
      if (type === 0 || type === 4 || (type === 6 && !t.picture && len < 16e6)) {
        const d = await read(o, len);
        if (type === 0) {
          const sr = (d[10] << 12) | (d[11] << 4) | (d[12] >> 4);
          const total = (d[13] & 0x0F) * 2 ** 32 + u32(d, 14);
          if (sr) t.duration = total / sr;
        } else if (type === 4) parseVorbisComment(d, 0, t);
        else parseFlacPicture(d, 0, t);
      }
      o += len;
      if (last) break;
    }
  }

  // ---------- Ogg (Vorbis / Opus) ----------
  async function parseOgg(read, size, t) {
    const head = await read(0, Math.min(size, 512 * 1024));
    // Junta los paquetes de las primeras páginas.
    const packets = [];
    let cur = [], o = 0;
    while (o + 27 <= head.length && packets.length < 2 && str(head, o, 4) === 'OggS') {
      const segs = head[o + 26];
      let p = o + 27 + segs;
      for (let i = 0; i < segs; i++) {
        const l = head[o + 27 + i];
        cur.push(head.subarray(p, p + l)); p += l;
        if (l < 255) {
          let total = 0; cur.forEach(c => total += c.length);
          const pk = new Uint8Array(total); let q = 0; cur.forEach(c => { pk.set(c, q); q += c.length; });
          packets.push(pk); cur = [];
        }
      }
      o = p;
    }
    let rate = 0, preskip = 0;
    if (packets[0]) {
      if (str(packets[0], 0, 8) === 'OpusHead') { rate = 48000; preskip = packets[0][10] | (packets[0][11] << 8); }
      else if (str(packets[0], 1, 6) === 'vorbis') rate = u32le(packets[0], 12);
    }
    if (packets[1]) {
      if (str(packets[1], 0, 8) === 'OpusTags') parseVorbisComment(packets[1], 8, t);
      else if (str(packets[1], 1, 6) === 'vorbis') parseVorbisComment(packets[1], 7, t);
    }
    if (rate) {
      const tailLen = Math.min(size, 65536);
      const tail = await read(size - tailLen, tailLen);
      for (let i = tail.length - 14; i >= 0; i--) {
        if (tail[i] === 0x4F && str(tail, i, 4) === 'OggS') {
          const g = u32le(tail, i + 6) + u32le(tail, i + 10) * 2 ** 32;
          t.duration = Math.max(0, g - preskip) / rate;
          break;
        }
      }
    }
  }

  // ---------- MP4 / M4A ----------
  function mp4Children(b, s, e, cb) {
    let o = s;
    while (o + 8 <= e) {
      let len = u32(b, o);
      const type = str(b, o + 4, 4);
      let h = 8;
      if (len === 1) { len = u32(b, o + 8) * 2 ** 32 + u32(b, o + 12); h = 16; }
      else if (len === 0) len = e - o;
      if (len < h) break;
      cb(type, o + h, Math.min(o + len, e));
      o += len;
    }
  }

  async function parseMP4(read, size, t) {
    let o = 0, moov = null;
    for (let guard = 0; guard < 64 && o + 8 <= size; guard++) {
      const h = await read(o, 16);
      let len = u32(h, 0);
      const type = str(h, 4, 4);
      if (len === 1) len = u32(h, 8) * 2 ** 32 + u32(h, 12);
      else if (len === 0) len = size - o;
      if (len < 8) break;
      if (type === 'moov') { if (len < 64e6) moov = await read(o, len); break; }
      o += len;
    }
    if (!moov) return;
    const keys = { '©nam': 'title', '©ART': 'artist', '©alb': 'album', 'aART': 'albumArtist', '©day': 'year', '©gen': 'genre', '©lyr': 'lyrics' };
    const walk = (s, e) => mp4Children(moov, s, e, (type, cs, ce) => {
      if (type === 'mvhd') {
        const v = moov[cs];
        const ts = v === 1 ? u32(moov, cs + 20) : u32(moov, cs + 12);
        const du = v === 1 ? u32(moov, cs + 24) * 2 ** 32 + u32(moov, cs + 28) : u32(moov, cs + 16);
        if (ts) t.duration = du / ts;
      } else if (type === 'moov' || type === 'udta' || type === 'ilst') walk(cs, ce);
      else if (type === 'meta') walk(cs + 4, ce);
      else if (keys[type] || type === 'trkn' || type === 'disk' || type === 'covr' || type === 'gnre') {
        mp4Children(moov, cs, ce, (dt, ds, de) => {
          if (dt !== 'data') return;
          const kind = u32(moov, ds) & 0xFFFFFF;
          const v = moov.subarray(ds + 8, de);
          if (keys[type]) { if (!t[keys[type]]) t[keys[type]] = utf8.decode(v).trim(); }
          else if (type === 'trkn' && v.length >= 4) t.track = String((v[2] << 8) | v[3]);
          else if (type === 'disk' && v.length >= 4) t.disc = String((v[2] << 8) | v[3]);
          else if (type === 'gnre' && v.length >= 2) t.genre = t.genre || GENRES[((v[0] << 8) | v[1]) - 1] || '';
          else if (type === 'covr' && !t.picture && v.length > 100) t.picture = { mime: kind === 14 ? 'image/png' : 'image/jpeg', data: v.slice() };
        });
      }
    });
    walk(0, moov.length);
  }

  // ---------- WAV ----------
  async function parseWAV(read, size, t) {
    const b = await read(0, Math.min(size, 256 * 1024));
    let o = 12, byteRate = 0;
    while (o + 8 <= b.length) {
      const id = str(b, o, 4), len = u32le(b, o + 4);
      if (id === 'fmt ') byteRate = u32le(b, o + 16);
      else if (id === 'data') { if (byteRate) t.duration = Math.min(len, size - o - 8) / byteRate; }
      else if (id === 'LIST' && str(b, o + 8, 4) === 'INFO') {
        let p = o + 12;
        while (p + 8 <= o + 8 + len) {
          const k = str(b, p, 4), l = u32le(b, p + 4);
          const v = clean(utf8.decode(b.subarray(p + 8, p + 8 + l)));
          const m = { INAM: 'title', IART: 'artist', IPRD: 'album', IGNR: 'genre', ICRD: 'year', ITRK: 'track' }[k];
          if (m && v) t[m] = v;
          p += 8 + l + (l & 1);
        }
      } else if (id === 'id3 ' || id === 'ID3 ') {
        const tag = b.subarray(o + 8, o + 8 + len);
        if (str(tag, 0, 3) === 'ID3') parseID3v2(tag, t);
      }
      if (id === 'data') break;
      o += 8 + len + (len & 1);
    }
  }

  async function readTags(read, size) {
    const t = {};
    const head = await read(0, Math.min(size, 12));
    let start = 0;
    if (str(head, 0, 3) === 'ID3') {
      const flags = head[5];
      const len = 10 + syncsafe(head, 6) + (flags & 0x10 ? 10 : 0);
      const tag = await read(0, Math.min(len, size, 32 * 1024 * 1024));
      try { parseID3v2(tag, t); } catch (e) { }
      start = len;
    }
    const sig = start ? await read(start, 12) : head;
    const s4 = str(sig, 0, 4), s8 = str(sig, 4, 4);
    try {
      if (s4 === 'fLaC') await parseFLAC(read, start, size, t);
      else if (s4 === 'OggS') await parseOgg(read, size, t);
      else if (s8 === 'ftyp') await parseMP4(read, size, t);
      else if (s4 === 'RIFF' && str(sig, 8, 4) === 'WAVE') await parseWAV(read, size, t);
      else {
        // MP3 (o desconocido): busca el primer cuadro de audio
        const b = await read(start, Math.min(16384, size - start));
        const d = mp3Duration(b, start, size);
        if (d) t.duration = d;
        if (!t.title && size > 128) parseID3v1(await read(size - 128, 128), t);
      }
    } catch (e) { }
    if (t.tlen && !t.duration) t.duration = +t.tlen / 1000;
    delete t.tlen;
    t.genre = genreName(t.genre);
    t.year = (String(t.year || '').match(/\d{4}/) || [''])[0];
    t.trackNo = num(t.track); t.discNo = num(t.disc);
    delete t.track; delete t.disc;
    for (const k of ['title', 'artist', 'album', 'albumArtist']) if (t[k]) t[k] = t[k].replace(/\s+/g, ' ').trim();
    return t;
  }

  // ---------- Letras LRC ----------
  function parseLRC(text) {
    if (!text) return null;
    const lines = [];
    let offset = 0, timed = false;
    for (const raw of text.split(/\r?\n/)) {
      const off = /^\[offset:\s*([+-]?\d+)\]/i.exec(raw);
      if (off) { offset = +off[1] / 1000; continue; }
      const stamps = [];
      let rest = raw, m;
      const re = /^\s*\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/;
      while ((m = re.exec(rest))) {
        stamps.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.')));
        rest = rest.slice(m[0].length);
      }
      rest = rest.replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '').trim();
      if (stamps.length) { timed = true; stamps.forEach(s => lines.push({ t: Math.max(0, s - offset), text: rest })); }
      else if (!/^\[[a-z]+:.*\]$/i.test(raw.trim())) lines.push({ t: -1, text: raw.trim() });
    }
    if (timed) {
      const out = lines.filter(l => l.t >= 0).sort((a, b) => a.t - b.t);
      return { synced: true, lines: out };
    }
    const plain = lines.map(l => l.text);
    while (plain.length && !plain[0]) plain.shift();
    return plain.length ? { synced: false, lines: plain.map(text => ({ t: -1, text })) } : null;
  }

  global.VelumTags = { readTags, parseLRC };
})(window);
