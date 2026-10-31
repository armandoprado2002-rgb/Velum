package com.velum.music;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.PlaybackParams;
import android.media.audiofx.Equalizer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

/**
 * Reproductor nativo de Android (MediaPlayer) con dos "ranuras", igual que los dos reproductores de la app:
 * la canción actual y la siguiente ya preparada. La siguiente arranca sola al terminar la actual
 * (setNextMediaPlayer), sin pausas y sin depender de que la app web esté despierta.
 * La app web manda órdenes y recibe eventos (cargada, sonando, tiempo, terminada, error).
 */
final class AudioEngine {
    static final AudioEngine I = new AudioEngine();

    private final Handler h = new Handler(Looper.getMainLooper());
    private final MediaPlayer[] mp = new MediaPlayer[2];
    private final boolean[] prepared = new boolean[2];
    private final boolean[] wantPlay = new boolean[2];
    private final int[] pendingSeek = new int[2];
    private final int[] gen = new int[2];
    private final int[] nextOf = {-1, -1};
    private final float[] vol = {1f, 1f};
    private float speed = 1f;
    private int session = 0;
    private Equalizer eq;
    private String eqJson;
    private Context ctx;
    private boolean ticking;

    private AudioEngine() { }

    void init(Context c) {
        ctx = c.getApplicationContext();
        if (session == 0) {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            if (am != null) session = am.generateAudioSessionId();
        }
    }

    boolean isPlaying() {
        for (int i = 0; i < 2; i++) if (mp[i] != null && prepared[i] && wantPlay[i]) return true;
        return false;
    }

    // ---------- Órdenes (vienen de cualquier hilo; se ejecutan en el principal) ----------
    void load(int slot, String uri, int startMs) { h.post(() -> doLoad(slot, uri, startMs)); }
    void play(int slot) { h.post(() -> doPlay(slot)); }
    void pause(int slot) { h.post(() -> doPause(slot)); }
    void seek(int slot, int ms) { h.post(() -> doSeek(slot, ms)); }
    void stop(int slot) { h.post(() -> release(slot)); }
    void volume(int slot, float v) { h.post(() -> { vol[slot] = Math.max(0f, Math.min(1f, v)); applyVolume(slot); }); }
    void speed(float s) { h.post(() -> { speed = s > 0 ? s : 1f; for (int i = 0; i < 2; i++) if (wantPlay[i]) applySpeed(i); }); }
    void setNext(int from, int to) { h.post(() -> { nextOf[from] = to; linkNext(from); }); }
    void setEq(String json) { h.post(() -> { eqJson = json; applyEq(); }); }
    void releaseAll() { h.post(() -> { release(0); release(1); if (eq != null) { try { eq.release(); } catch (Exception ignored) { } eq = null; } }); }

    private void doLoad(int slot, String uri, int startMs) {
        release(slot);
        if (ctx == null || uri == null) return;
        final int g = ++gen[slot];
        MediaPlayer p = new MediaPlayer();
        mp[slot] = p;
        prepared[slot] = false;
        wantPlay[slot] = false;
        pendingSeek[slot] = Math.max(0, startMs);
        try {
            p.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build());
            // Mantiene la CPU despierta con la pantalla apagada mientras suena
            p.setWakeMode(ctx, PowerManager.PARTIAL_WAKE_LOCK);
            if (session != 0) p.setAudioSessionId(session);
            p.setOnPreparedListener(x -> {
                if (g != gen[slot]) return;
                prepared[slot] = true;
                if (pendingSeek[slot] > 0) { try { x.seekTo(pendingSeek[slot]); } catch (Exception ignored) { } }
                applyVolume(slot);
                ensureEq();
                emit(slot, "loaded", pendingSeek[slot], safeDuration(slot));
                pendingSeek[slot] = 0;
                for (int i = 0; i < 2; i++) if (nextOf[i] == slot) linkNext(i);
                if (wantPlay[slot]) doPlay(slot);
            });
            p.setOnCompletionListener(x -> {
                if (g != gen[slot]) return;
                int n = nextOf[slot];
                nextOf[slot] = -1;
                wantPlay[slot] = false;
                int d = safeDuration(slot);
                emit(slot, "ended", d, d);
                // La siguiente ya arrancó sola gracias a setNextMediaPlayer
                if (n >= 0 && mp[n] != null && prepared[n]) {
                    wantPlay[n] = true;
                    applySpeed(n);
                    applyVolume(n);
                    emit(n, "playing", position(n), safeDuration(n));
                }
                tick();
            });
            p.setOnSeekCompleteListener(x -> { if (g == gen[slot]) emit(slot, "time", position(slot), safeDuration(slot)); });
            p.setOnErrorListener((x, what, extra) -> {
                if (g != gen[slot]) return true;
                wantPlay[slot] = false;
                emit(slot, "error", position(slot), safeDuration(slot));
                return true;
            });
            p.setDataSource(ctx, Uri.parse(uri));
            p.prepareAsync();
        } catch (Exception e) {
            emit(slot, "error", 0, 0);
        }
    }

    private void doPlay(int slot) {
        MediaPlayer p = mp[slot];
        if (p == null) return;
        wantPlay[slot] = true;
        if (!prepared[slot]) return; // arrancará al terminar de preparar
        try {
            if (!p.isPlaying()) p.start();
            applySpeed(slot);
        } catch (Exception e) {
            emit(slot, "error", 0, 0);
            return;
        }
        emit(slot, "playing", position(slot), safeDuration(slot));
        tick();
    }

    private void doPause(int slot) {
        wantPlay[slot] = false;
        MediaPlayer p = mp[slot];
        if (p != null && prepared[slot]) { try { if (p.isPlaying()) p.pause(); } catch (Exception ignored) { } }
    }

    private void doSeek(int slot, int ms) {
        MediaPlayer p = mp[slot];
        if (p == null) return;
        if (!prepared[slot]) { pendingSeek[slot] = ms; return; }
        try { p.seekTo(Math.max(0, ms)); } catch (Exception ignored) { }
    }

    private void linkNext(int from) {
        int to = nextOf[from];
        MediaPlayer a = mp[from];
        if (a == null || !prepared[from]) return;
        try {
            if (to >= 0 && mp[to] != null && prepared[to]) a.setNextMediaPlayer(mp[to]);
            else a.setNextMediaPlayer(null);
        } catch (Exception ignored) { }
    }

    private void release(int slot) {
        gen[slot]++;
        for (int i = 0; i < 2; i++) {
            if (nextOf[i] == slot) {
                nextOf[i] = -1;
                if (mp[i] != null && prepared[i]) { try { mp[i].setNextMediaPlayer(null); } catch (Exception ignored) { } }
            }
        }
        nextOf[slot] = -1;
        MediaPlayer p = mp[slot];
        mp[slot] = null;
        prepared[slot] = false;
        wantPlay[slot] = false;
        if (p != null) { try { p.reset(); } catch (Exception ignored) { } try { p.release(); } catch (Exception ignored) { } }
    }

    private void applyVolume(int slot) {
        MediaPlayer p = mp[slot];
        if (p != null) { try { p.setVolume(vol[slot], vol[slot]); } catch (Exception ignored) { } }
    }

    private void applySpeed(int slot) {
        MediaPlayer p = mp[slot];
        if (p == null || !prepared[slot]) return;
        try {
            if (Math.abs(speed - 1f) > 0.01f || p.getPlaybackParams().getSpeed() != 1f) {
                if (p.isPlaying()) p.setPlaybackParams(new PlaybackParams().setSpeed(speed));
            }
        } catch (Exception ignored) { }
    }

    private int position(int slot) {
        MediaPlayer p = mp[slot];
        if (p == null || !prepared[slot]) return 0;
        try { return p.getCurrentPosition(); } catch (Exception e) { return 0; }
    }

    private int safeDuration(int slot) {
        MediaPlayer p = mp[slot];
        if (p == null || !prepared[slot]) return 0;
        try { int d = p.getDuration(); return Math.max(d, 0); } catch (Exception e) { return 0; }
    }

    // Avisa el tiempo 4 veces por segundo mientras suena
    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            boolean any = false;
            for (int i = 0; i < 2; i++) {
                MediaPlayer p = mp[i];
                boolean on = false;
                try { on = p != null && prepared[i] && p.isPlaying(); } catch (Exception ignored) { }
                if (on) { any = true; emit(i, "time", position(i), safeDuration(i)); }
            }
            ticking = any;
            if (any) h.postDelayed(this, 250);
        }
    };

    private void tick() {
        if (ticking) return;
        ticking = true;
        h.postDelayed(ticker, 250);
    }

    // ---------- Ecualizador de Android ----------
    private void ensureEq() {
        if (eq != null || session == 0 || eqJson == null) return;
        try { eq = new Equalizer(0, session); } catch (Exception e) { eq = null; return; }
        applyEq();
    }

    private void applyEq() {
        if (eqJson == null) return;
        if (eq == null) { ensureEq(); if (eq == null) return; }
        try {
            JSONObject o = new JSONObject(eqJson);
            boolean on = o.optBoolean("on");
            JSONArray gains = o.optJSONArray("gains"), freqs = o.optJSONArray("freqs");
            if (!on || gains == null || freqs == null) { eq.setEnabled(false); return; }
            short[] range = eq.getBandLevelRange();
            short bands = eq.getNumberOfBands();
            for (short b = 0; b < bands; b++) {
                double hz = eq.getCenterFreq(b) / 1000.0;
                double g = curve(gains, freqs, hz);
                int level = (int) Math.round(g * 100); // dB → milibeles
                level = Math.max(range[0], Math.min(range[1], level));
                eq.setBandLevel(b, (short) level);
            }
            eq.setEnabled(true);
        } catch (Exception ignored) { }
    }

    // Interpola la curva de 10 bandas de la app en la frecuencia de cada banda del teléfono
    private static double curve(JSONArray gains, JSONArray freqs, double hz) throws Exception {
        int n = Math.min(gains.length(), freqs.length());
        double x = Math.log(hz);
        if (x <= Math.log(freqs.getDouble(0))) return gains.getDouble(0);
        for (int i = 1; i < n; i++) {
            double x1 = Math.log(freqs.getDouble(i));
            if (x <= x1) {
                double x0 = Math.log(freqs.getDouble(i - 1));
                double t = (x - x0) / (x1 - x0);
                return gains.getDouble(i - 1) + (gains.getDouble(i) - gains.getDouble(i - 1)) * t;
            }
        }
        return gains.getDouble(n - 1);
    }

    private void emit(int slot, String ev, int t, int d) {
        MainActivity.js(String.format(Locale.ROOT,
                "window.VelumNative && VelumNative.onAudio && VelumNative.onAudio(%d,'%s',%d,%d)", slot, ev, t, d));
    }
}
