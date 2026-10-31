/* Velum · en Android la música la reproduce el teléfono (MediaPlayer), no el navegador interno.
   NativeAudio imita lo que el reproductor usa de un <audio>: src, play, pause, currentTime, duration,
   volume, playbackRate y sus eventos, y manda las órdenes al reproductor nativo. */
(function (global) {
  'use strict';
  const bridge = global.AndroidBridge;
  const enabled = !!(bridge && bridge.nativeAudio && (() => { try { return bridge.nativeAudio(); } catch (e) { return false; } })());
  const slots = [];

  class NativeAudio extends EventTarget {
    constructor(slot) {
      super();
      this.slot = slot;
      this.dataset = {};
      this.preload = 'auto';
      this.crossOrigin = null;
      this.preservesPitch = true;
      this.defaultPlaybackRate = 1;
      this.paused = true;
      this.ended = false;
      this.readyState = 0;
      this._src = '';
      this._t = 0;
      this._at = 0;
      this._running = false;
      this._dur = NaN;
      this._vol = 1;
      this._rate = 1;
      slots[slot] = this;
    }

    get src() { return this._src; }
    set src(v) {
      this._src = v ? new URL(v, location.href).href : '';
      this.paused = true; this.ended = false; this.readyState = 0;
      this._dur = NaN; this._running = false;
      if (!this._src) { bridge.audioStop(this.slot); return; }
      const url = new URL(this._src);
      const uri = url.searchParams.get('u');
      const m = /#t=([\d.]+)/.exec(this._src);
      this._t = m ? parseFloat(m[1]) : 0;
      this._at = performance.now();
      bridge.audioLoad(this.slot, uri || '', Math.round(this._t * 1000));
    }
    getAttribute(n) { return n === 'src' ? (this._src || null) : null; }
    removeAttribute(n) { if (n === 'src') this.src = ''; }
    load() { /* la carga ya empieza al asignar src */ }

    play() {
      if (!this._src) return Promise.resolve();
      this.paused = false;
      this.ended = false;
      bridge.audioPlay(this.slot);
      return Promise.resolve();
    }
    pause() {
      const was = !this.paused;
      this._t = this.currentTime;
      this._running = false;
      this.paused = true;
      bridge.audioPause(this.slot);
      if (was) this._fire('pause');
    }

    get currentTime() {
      if (!this._running) return this._t;
      const t = this._t + (performance.now() - this._at) / 1000 * this._rate;
      return isFinite(this._dur) ? Math.min(t, this._dur) : t;
    }
    set currentTime(v) {
      v = Math.max(0, +v || 0);
      this._t = v; this._at = performance.now();
      bridge.audioSeek(this.slot, Math.round(v * 1000));
    }
    get duration() { return this._dur; }

    get volume() { return this._vol; }
    set volume(v) { this._vol = Math.max(0, Math.min(1, v)); bridge.audioVolume(this.slot, this._vol); }
    get playbackRate() { return this._rate; }
    set playbackRate(r) { this._rate = r || 1; bridge.audioSpeed(this._rate); }

    _fire(type) { this.dispatchEvent(new Event(type)); }

    // Eventos que llegan del reproductor nativo
    _event(ev, tMs, dMs) {
      if (dMs > 0) this._dur = dMs / 1000;
      if (ev === 'loaded') {
        this.readyState = 4;
        if (!this._running) this._t = tMs / 1000;
        this._fire('loadedmetadata'); this._fire('canplay');
      } else if (ev === 'playing') {
        this._t = tMs / 1000; this._at = performance.now(); this._running = true;
        this.paused = false; this.ended = false;
        this._fire('play'); this._fire('playing');
      } else if (ev === 'time') {
        this._t = tMs / 1000; this._at = performance.now();
        if (!this.paused) this._running = true;
        this._fire('timeupdate');
      } else if (ev === 'ended') {
        this._t = isFinite(this._dur) ? this._dur : tMs / 1000;
        this._running = false; this.ended = true; this.paused = true;
        this._fire('timeupdate'); this._fire('pause'); this._fire('ended');
      } else if (ev === 'error') {
        this._running = false; this.paused = true;
        this._fire('error');
      }
    }
  }

  global.VelumNative = global.VelumNative || {};
  global.VelumNative.onAudio = (slot, ev, t, d) => { const a = slots[slot]; if (a) a._event(ev, t, d); };

  global.NativeAudio = enabled ? NativeAudio : null;
  global.NativeAudioBridge = enabled ? {
    setNext: (from, to) => bridge.audioSetNext(from, to),
    setEq: eq => bridge.setEq(JSON.stringify(eq))
  } : null;
})(window);
