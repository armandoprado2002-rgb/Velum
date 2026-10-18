package com.velum.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Base64;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

/** Mantiene la música sonando en segundo plano y muestra los controles en la notificación y la pantalla bloqueada. */
public class PlaybackService extends Service {
    private static final String CHANNEL = "playback";
    private static final int NOTIF_ID = 7;
    private static final String ACTION = "com.velum.music.CMD";

    private static final Handler main = new Handler(Looper.getMainLooper());
    private static PlaybackService instance;
    private static String title = "", artist = "", album = "";
    private static Bitmap art;
    private static long duration, position;
    private static boolean playing;
    private static float speed = 1f;

    private MediaSessionCompat session;
    private boolean noisyOn, foreground, mustStartForeground = true;

    // ---------- Llamadas desde la app ----------
    static void setMeta(Context ctx, String json) {
        try {
            JSONObject o = new JSONObject(json);
            String t = o.optString("title"), a = o.optString("artist"), al = o.optString("album");
            long d = o.optLong("duration");
            String data = o.optString("art");
            Bitmap bmp = null;
            if (data.startsWith("data:")) {
                byte[] b = Base64.decode(data.substring(data.indexOf(',') + 1), Base64.DEFAULT);
                bmp = BitmapFactory.decodeByteArray(b, 0, b.length);
            }
            final Bitmap img = bmp;
            main.post(() -> {
                title = t; artist = a; album = al; duration = d; art = img; position = 0;
                ensure(ctx);
                if (instance != null) instance.refresh(true);
            });
        } catch (Exception ignored) { }
    }

    static void setState(Context ctx, boolean isPlaying, long pos, long dur, float sp) {
        main.post(() -> {
            boolean changed = isPlaying != playing;
            playing = isPlaying; position = pos; speed = sp > 0 ? sp : 1f;
            if (dur > 0) duration = dur;
            if (isPlaying) ensure(ctx);
            if (instance != null) instance.refresh(changed);
        });
    }

    private static void ensure(Context ctx) {
        if (instance != null) return;
        Intent i = new Intent(ctx, PlaybackService.class);
        try {
            if (playing && Build.VERSION.SDK_INT >= 26) ctx.startForegroundService(i);
            else ctx.startService(i);
        } catch (Exception ignored) { }
    }

    private static void command(String cmd, long arg) {
        MainActivity.js("window.VelumNative && VelumNative.onCommand && VelumNative.onCommand('" + cmd + "'," + arg + ")");
    }

    // ---------- Servicio ----------
    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Reproducción", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            ch.setDescription("Controles de la música");
            ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(ch);
        }
        session = new MediaSessionCompat(this, "Velum");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { command("play", 0); }
            @Override public void onPause() { command("pause", 0); }
            @Override public void onSkipToNext() { command("next", 0); }
            @Override public void onSkipToPrevious() { command("prev", 0); }
            @Override public void onSeekTo(long pos) { command("seek", pos); }
            @Override public void onStop() { command("pause", 0); }
        });
        session.setSessionActivity(openApp());
        session.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Si se inició como servicio en primer plano, hay que mostrar la notificación de inmediato
        refresh(true);
        if (intent != null && ACTION.equals(intent.getAction())) {
            String c = intent.getStringExtra("c");
            if ("close".equals(c)) { command("pause", 0); stopSelf(); }
            else if (c != null) command(c, 0);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        instance = null;
        setNoisy(false);
        if (session != null) { session.setActive(false); session.release(); }
        stopForeground(true);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(NOTIF_ID);
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private PendingIntent openApp() {
        Intent i = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private PendingIntent action(String c, int code) {
        Intent i = new Intent(this, PlaybackService.class).setAction(ACTION).putExtra("c", c);
        return PendingIntent.getService(this, code, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void refresh(boolean rebuild) {
        if (session == null) return;
        session.setPlaybackState(new PlaybackStateCompat.Builder()
                .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_PLAY_PAUSE
                        | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                        | PlaybackStateCompat.ACTION_SEEK_TO | PlaybackStateCompat.ACTION_STOP)
                .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, position, playing ? speed : 0f)
                .build());
        if (!rebuild) return;
        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);
        if (art != null) meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, art);
        session.setMetadata(meta.build());

        Notification n = new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(title.isEmpty() ? "Velum" : title)
                .setContentText(artist)
                .setSubText(album)
                .setLargeIcon(art)
                .setContentIntent(openApp())
                .setDeleteIntent(action("close", 9))
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setColor(0xFF9D6FF5)
                .setOngoing(playing)
                .addAction(R.drawable.ic_prev, "Anterior", action("prev", 1))
                .addAction(playing ? R.drawable.ic_pause : R.drawable.ic_play, playing ? "Pausar" : "Reproducir", action(playing ? "pause" : "play", 2))
                .addAction(R.drawable.ic_next, "Siguiente", action("next", 3))
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(session.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2))
                .build();

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        // Android exige mostrar la notificación en cuanto arranca un servicio en primer plano
        if (playing || mustStartForeground) {
            mustStartForeground = false;
            try {
                if (Build.VERSION.SDK_INT >= 29) startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                else startForeground(NOTIF_ID, n);
                foreground = true;
            } catch (Exception e) {
                nm.notify(NOTIF_ID, n);
            }
        }
        if (playing) {
            setNoisy(true);
        } else {
            setNoisy(false);
            if (foreground) {
                // En pausa la notificación se queda, pero ya se puede deslizar para quitarla
                if (Build.VERSION.SDK_INT >= 24) stopForeground(STOP_FOREGROUND_DETACH); else stopForeground(false);
                foreground = false;
            }
            if (!title.isEmpty()) nm.notify(NOTIF_ID, n);
            else nm.cancel(NOTIF_ID);
        }
    }

    // Pausa al desconectar audífonos
    private final BroadcastReceiver noisy = new BroadcastReceiver() {
        @Override public void onReceive(Context c, Intent i) { command("pause", 0); }
    };

    private void setNoisy(boolean on) {
        if (on == noisyOn) return;
        noisyOn = on;
        if (on) {
            IntentFilter f = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            if (Build.VERSION.SDK_INT >= 33) registerReceiver(noisy, f, Context.RECEIVER_NOT_EXPORTED);
            else registerReceiver(noisy, f);
        } else {
            try { unregisterReceiver(noisy); } catch (Exception ignored) { }
        }
    }
}
