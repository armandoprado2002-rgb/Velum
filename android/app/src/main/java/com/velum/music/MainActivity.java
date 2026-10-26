package com.velum.music;

import android.Manifest;
import android.app.Activity;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import android.provider.OpenableColumns;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class MainActivity extends Activity {
    // Dominio reservado de WebView: la app y la música se sirven desde aquí, sin internet.
    static final String HOST = "appassets.androidplatform.net";
    private static final int PICK_REQ = 1;
    private static final int PERM_NOTIF = 2;
    private static final Set<String> WANTED = new HashSet<>(java.util.Arrays.asList(
            "mp3", "m4a", "aac", "flac", "ogg", "oga", "opus", "wav", "webm", "weba", "mp4", "3gp", "m4b",
            "lrc", "m3u", "m3u8", "jpg", "jpeg", "png", "webp"));

    static MainActivity instance;
    WebView web;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;
        prefs = getSharedPreferences("velum", MODE_PRIVATE);

        goEdgeToEdge();
        web = new WebView(this);
        web.setBackgroundColor(0xFF07070A);
        web.setOnApplyWindowInsetsListener((v, insets) -> { sendInsets(insets); return insets; });
        web.setHapticFeedbackEnabled(true);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                return intercept(req);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (lastInsets != null) js(lastInsets);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.loadUrl("https://" + HOST + "/index.html");

        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                && !prefs.getBoolean("askedNotif", false)) {
            prefs.edit().putBoolean("askedNotif", true).apply();
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERM_NOTIF);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        js("window.VelumNative && VelumNative.onResume && VelumNative.onResume()");
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        web.evaluateJavascript("(window.VelumNative && VelumNative.onBack) ? VelumNative.onBack() : false", v -> {
            // En la pantalla principal, "atrás" deja la música sonando en segundo plano
            if (!"true".equals(v)) moveTaskToBack(true);
        });
    }

    @Override
    protected void onDestroy() {
        if (instance == this) instance = null;
        stopService(new Intent(this, PlaybackService.class));
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    private String lastInsets;

    @SuppressWarnings("deprecation")
    private void goEdgeToEdge() {
        Window w = getWindow();
        if (Build.VERSION.SDK_INT >= 30) w.setDecorFitsSystemWindows(false);
        else w.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            w.setStatusBarContrastEnforced(false);
            w.setNavigationBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
    }

    // Le dice a la app cuánto miden la barra de estado, la de navegación y el teclado
    @SuppressWarnings("deprecation")
    private void sendInsets(WindowInsets in) {
        int top, bottom, kb = 0;
        if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets bars = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
            top = bars.top; bottom = bars.bottom;
            kb = Math.max(0, in.getInsets(WindowInsets.Type.ime()).bottom - bottom);
        } else {
            top = in.getSystemWindowInsetTop();
            bottom = in.getStableInsetBottom();
            kb = Math.max(0, in.getSystemWindowInsetBottom() - bottom);
        }
        float d = getResources().getDisplayMetrics().density;
        lastInsets = String.format(Locale.ROOT, "window.VelumNative && VelumNative.setInsets && VelumNative.setInsets(%.1f,%.1f,%.1f)", top / d, bottom / d, kb / d);
        js(lastInsets);
    }

    static void js(String code) {
        MainActivity a = instance;
        if (a == null) return;
        a.runOnUiThread(() -> { if (a.web != null) a.web.evaluateJavascript(code, null); });
    }

    // ---------- Carpetas ----------
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_REQ) return;
        boolean ok = false;
        if (resultCode == RESULT_OK && data != null && data.getData() != null) {
            Uri tree = data.getData();
            try {
                getContentResolver().takePersistableUriPermission(tree, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                addFolder(tree);
                ok = true;
            } catch (Exception ignored) { }
        }
        js("VelumNative.onFolderPicked(" + ok + ")");
    }

    private synchronized JSONArray savedFolders() {
        try { return new JSONArray(prefs.getString("folders", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    private synchronized void addFolder(Uri tree) throws Exception {
        JSONArray list = savedFolders();
        for (int i = 0; i < list.length(); i++) if (list.getJSONObject(i).getString("id").equals(tree.toString())) return;
        String name = displayName(DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree)));
        if (name == null || name.isEmpty()) name = "Música";
        String base = name;
        for (int n = 2; nameTaken(list, name); n++) name = base + " (" + n + ")";
        list.put(new JSONObject().put("id", tree.toString()).put("name", name));
        prefs.edit().putString("folders", list.toString()).apply();
    }

    private boolean nameTaken(JSONArray list, String name) throws Exception {
        for (int i = 0; i < list.length(); i++) if (list.getJSONObject(i).getString("name").equals(name)) return true;
        return false;
    }

    private synchronized void removeFolder(String id) {
        JSONArray list = savedFolders(), out = new JSONArray();
        try {
            for (int i = 0; i < list.length(); i++) {
                JSONObject o = list.getJSONObject(i);
                if (o.getString("id").equals(id)) {
                    try { getContentResolver().releasePersistableUriPermission(Uri.parse(id), Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception ignored) { }
                } else out.put(o);
            }
        } catch (Exception ignored) { }
        prefs.edit().putString("folders", out.toString()).apply();
    }

    // Solo las carpetas a las que todavía tenemos permiso
    private JSONArray activeFolders() {
        Set<String> granted = new HashSet<>();
        for (UriPermission p : getContentResolver().getPersistedUriPermissions()) if (p.isReadPermission()) granted.add(p.getUri().toString());
        JSONArray list = savedFolders(), out = new JSONArray();
        try {
            for (int i = 0; i < list.length(); i++) if (granted.contains(list.getJSONObject(i).getString("id"))) out.put(list.getJSONObject(i));
        } catch (Exception ignored) { }
        return out;
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) { }
        return null;
    }

    // ---------- Escaneo de la carpeta ----------
    private String scan() {
        JSONArray out = new JSONArray();
        JSONArray folders = activeFolders();
        for (int i = 0; i < folders.length(); i++) {
            try {
                JSONObject f = folders.getJSONObject(i);
                Uri tree = Uri.parse(f.getString("id"));
                walk(tree, DocumentsContract.getTreeDocumentId(tree), f.getString("name"), out, 0);
            } catch (Exception ignored) { }
        }
        return out.toString();
    }

    private void walk(Uri tree, String docId, String prefix, JSONArray out, int depth) {
        if (depth > 24) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        List<String[]> dirs = new ArrayList<>();
        String[] cols = {Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED};
        try (Cursor c = getContentResolver().query(children, cols, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                if (name == null || name.startsWith(".")) continue;
                if (Document.MIME_TYPE_DIR.equals(mime)) { dirs.add(new String[]{id, name}); continue; }
                String ext = ext(name);
                if (!WANTED.contains(ext)) continue;
                long size = c.isNull(3) ? 0 : c.getLong(3);
                if (isImage(ext) && size > 4 * 1024 * 1024) continue;
                out.put(new JSONObject()
                        .put("p", prefix + "/" + name)
                        .put("s", size)
                        .put("m", c.isNull(4) ? 0 : c.getLong(4))
                        .put("u", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString()));
            }
        } catch (Exception ignored) { }
        for (String[] d : dirs) walk(tree, d[0], prefix + "/" + d[1], out, depth + 1);
    }

    private static String ext(String name) {
        int i = name.lastIndexOf('.');
        return i < 0 ? "" : name.substring(i + 1).toLowerCase(Locale.ROOT);
    }

    private static boolean isImage(String ext) {
        return ext.equals("jpg") || ext.equals("jpeg") || ext.equals("png") || ext.equals("webp");
    }

    // ---------- Servidor local (app + música) ----------
    private WebResourceResponse intercept(WebResourceRequest req) {
        Uri u = req.getUrl();
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath() == null ? "/" : u.getPath();
        try {
            switch (path) {
                case "/__velum/media": return media(Uri.parse(u.getQueryParameter("u")), req.getRequestHeaders());
                case "/__velum/scan": return text("application/json", scan());
                case "/__velum/art": return embeddedArt(Uri.parse(u.getQueryParameter("u")));
                case "/__velum/meta": return text("application/json", nativeMeta(Uri.parse(u.getQueryParameter("u"))));
                case "/__velum/folders": {
                    JSONArray f = activeFolders();
                    JSONArray out = new JSONArray();
                    for (int i = 0; i < f.length(); i++) out.put(new JSONObject().put("id", f.getJSONObject(i).getString("id")).put("name", f.getJSONObject(i).getString("name")));
                    return text("application/json", out.toString());
                }
                default: {
                    if (path.equals("/")) path = "/index.html";
                    if (path.contains("..")) return notFound();
                    InputStream in = getAssets().open("www" + path, AssetManager.ACCESS_STREAMING);
                    String mime = mimeOf(ext(path));
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-cache");
                    return new WebResourceResponse(mime, mime.startsWith("image") ? null : "utf-8", 200, "OK", h, in);
                }
            }
        } catch (Exception e) {
            return notFound();
        }
    }

    private WebResourceResponse text(String mime, String body) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        return new WebResourceResponse(mime, "utf-8", 200, "OK", h, new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }

    private WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    // Archivo de la carpeta con soporte de "Range" (para adelantar la canción y leer etiquetas)
    private WebResourceResponse media(Uri uri, Map<String, String> headers) throws IOException {
        ContentResolver cr = getContentResolver();
        ParcelFileDescriptor pfd = cr.openFileDescriptor(uri, "r");
        if (pfd == null) return notFound();
        long size = pfd.getStatSize();
        if (size < 0) {
            try (Cursor c = cr.query(uri, new String[]{OpenableColumns.SIZE}, null, null, null)) {
                if (c != null && c.moveToFirst() && !c.isNull(0)) size = c.getLong(0);
            } catch (Exception ignored) { }
        }
        FileInputStream in = new ParcelFileDescriptor.AutoCloseInputStream(pfd);
        String mime = cr.getType(uri);
        String guess = mimeOf(ext(uri.getLastPathSegment() == null ? "" : uri.getLastPathSegment()));
        if (mime == null || !(mime.startsWith("audio") || mime.startsWith("image") || mime.startsWith("text"))) mime = guess;

        String range = null;
        if (headers != null) for (Map.Entry<String, String> e : headers.entrySet()) if ("range".equalsIgnoreCase(e.getKey())) range = e.getValue();

        Map<String, String> h = new HashMap<>();
        h.put("Accept-Ranges", "bytes");
        h.put("Cache-Control", "no-store");
        if (range != null && range.startsWith("bytes=") && size > 0) {
            String spec = range.substring(6).split(",")[0].trim();
            int dash = spec.indexOf('-');
            long start, end;
            if (dash == 0) { start = Math.max(0, size - Long.parseLong(spec.substring(1))); end = size - 1; }
            else {
                start = Long.parseLong(spec.substring(0, dash));
                end = dash == spec.length() - 1 ? size - 1 : Long.parseLong(spec.substring(dash + 1));
            }
            end = Math.min(end, size - 1);
            if (start >= size || start > end) {
                in.close();
                h.put("Content-Range", "bytes */" + size);
                return new WebResourceResponse(mime, null, 416, "Range Not Satisfiable", h, new ByteArrayInputStream(new byte[0]));
            }
            in.getChannel().position(start);
            long len = end - start + 1;
            h.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
            h.put("Content-Length", String.valueOf(len));
            return new WebResourceResponse(mime, null, 206, "Partial Content", h, new LimitedStream(in, len));
        }
        if (size > 0) h.put("Content-Length", String.valueOf(size));
        return new WebResourceResponse(mime, null, 200, "OK", h, in);
    }

    // Carátula incrustada, leída por Android y guardada reducida en la caché (rápida al desplazarse)
    private WebResourceResponse embeddedArt(Uri uri) {
        File dir = new File(getCacheDir(), "art");
        if (!dir.exists()) dir.mkdirs();
        String key = Integer.toHexString(uri.toString().hashCode()) + "_" + uri.toString().length() + "_v2";
        File jpg = new File(dir, key + ".jpg"), none = new File(dir, key + ".none");
        try {
            if (!jpg.exists() && !none.exists()) {
                byte[] pic = null;
                MediaMetadataRetriever r = new MediaMetadataRetriever();
                try {
                    r.setDataSource(this, uri);
                    pic = r.getEmbeddedPicture();
                } catch (Exception ignored) {
                } finally {
                    try { r.release(); } catch (Exception ignored) { }
                }
                Bitmap bmp = pic == null ? null : decodeScaled(pic, 640);
                if (bmp == null) {
                    // Respaldo para MP3: nuestro propio lector de etiquetas ID3
                    try (InputStream in = getContentResolver().openInputStream(uri)) {
                        byte[] id3 = in == null ? null : Id3Art.read(in);
                        if (id3 != null) bmp = decodeScaled(id3, 640);
                    } catch (Exception ignored) { }
                }
                if (bmp == null) { none.createNewFile(); return notFound(); }
                File tmp = new File(dir, key + ".tmp");
                try (FileOutputStream out = new FileOutputStream(tmp)) { bmp.compress(Bitmap.CompressFormat.JPEG, 88, out); }
                bmp.recycle();
                if (!tmp.renameTo(jpg)) return notFound();
            }
            if (!jpg.exists()) return notFound();
            Map<String, String> h = new HashMap<>();
            h.put("Cache-Control", "max-age=86400");
            return new WebResourceResponse("image/jpeg", null, 200, "OK", h, new FileInputStream(jpg));
        } catch (Exception e) {
            return notFound();
        }
    }

    private static Bitmap decodeScaled(byte[] data, int max) {
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(data, 0, data.length, o);
        if (o.outWidth <= 0 || o.outHeight <= 0) return null;
        int sample = 1;
        while (Math.max(o.outWidth, o.outHeight) / (sample * 2) >= max) sample *= 2;
        o = new BitmapFactory.Options();
        o.inSampleSize = sample;
        Bitmap b = BitmapFactory.decodeByteArray(data, 0, data.length, o);
        if (b == null) return null;
        int big = Math.max(b.getWidth(), b.getHeight());
        if (big <= max) return b;
        float k = (float) max / big;
        Bitmap s = Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * k), Math.round(b.getHeight() * k), true);
        if (s != b) b.recycle();
        return s;
    }

    // Lector de Android (respaldo): etiquetas del archivo
    private String nativeMeta(Uri uri) {
        MediaMetadataRetriever r = new MediaMetadataRetriever();
        JSONObject o = new JSONObject();
        try {
            r.setDataSource(this, uri);
            int[][] keys = {
                    {MediaMetadataRetriever.METADATA_KEY_TITLE, 0}, {MediaMetadataRetriever.METADATA_KEY_ARTIST, 1},
                    {MediaMetadataRetriever.METADATA_KEY_ALBUM, 2}, {MediaMetadataRetriever.METADATA_KEY_ALBUMARTIST, 3},
                    {MediaMetadataRetriever.METADATA_KEY_CD_TRACK_NUMBER, 4}, {MediaMetadataRetriever.METADATA_KEY_YEAR, 5},
                    {MediaMetadataRetriever.METADATA_KEY_GENRE, 6}, {MediaMetadataRetriever.METADATA_KEY_DURATION, 7},
                    {MediaMetadataRetriever.METADATA_KEY_DISC_NUMBER, 8}};
            String[] names = {"title", "artist", "album", "albumArtist", "track", "year", "genre", "durationMs", "disc"};
            for (int[] k : keys) {
                String v = r.extractMetadata(k[0]);
                if (v != null && !v.trim().isEmpty()) o.put(names[k[1]], v.trim());
            }
            o.put("hasArt", r.getEmbeddedPicture() != null);
        } catch (Exception ignored) {
        } finally {
            try { r.release(); } catch (Exception ignored) { }
        }
        return o.toString();
    }

    private static String mimeOf(String ext) {
        switch (ext) {
            case "html": return "text/html";
            case "js": return "application/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "webmanifest": return "application/manifest+json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "mp3": return "audio/mpeg";
            case "m4a": case "m4b": case "mp4": return "audio/mp4";
            case "aac": return "audio/aac";
            case "flac": return "audio/flac";
            case "ogg": case "oga": case "opus": return "audio/ogg";
            case "wav": return "audio/wav";
            case "webm": case "weba": return "audio/webm";
            case "3gp": return "audio/3gpp";
            case "lrc": case "m3u": case "m3u8": return "text/plain";
            default: return "application/octet-stream";
        }
    }

    static class LimitedStream extends InputStream {
        private final InputStream in;
        private long left;

        LimitedStream(InputStream in, long left) { this.in = in; this.left = left; }

        @Override public int read() throws IOException {
            if (left <= 0) return -1;
            int b = in.read();
            if (b >= 0) left--;
            return b;
        }

        @Override public int read(byte[] b, int off, int len) throws IOException {
            if (left <= 0) return -1;
            int n = in.read(b, off, (int) Math.min(len, left));
            if (n > 0) left -= n;
            return n;
        }

        @Override public int available() throws IOException { return (int) Math.min(in.available(), left); }

        @Override public void close() throws IOException { in.close(); }
    }

    // ---------- Puente con la app ----------
    class Bridge {
        @JavascriptInterface
        public void pickFolder() {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                if (Build.VERSION.SDK_INT >= 26) {
                    i.putExtra(DocumentsContract.EXTRA_INITIAL_URI,
                            DocumentsContract.buildDocumentUri("com.android.externalstorage.documents", "primary:Music"));
                }
                try { startActivityForResult(i, PICK_REQ); }
                catch (Exception e) { js("VelumNative.onFolderPicked(false)"); }
            });
        }

        @JavascriptInterface
        public void removeFolder(String id) { MainActivity.this.removeFolder(id); }

        @JavascriptInterface
        public void setMeta(String json) { PlaybackService.setMeta(MainActivity.this, json); }

        @JavascriptInterface
        public void setState(boolean playing, double positionMs, double durationMs, double speed) {
            PlaybackService.setState(MainActivity.this, playing, (long) positionMs, (long) durationMs, (float) speed);
        }

        @JavascriptInterface
        public void haptic() {
            runOnUiThread(() -> { if (web != null) web.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); });
        }

        // Fondo del color del tema (las barras del sistema son transparentes)
        @JavascriptInterface
        public void setBarColor(String hex) {
            runOnUiThread(() -> {
                try {
                    // Las barras son transparentes (pantalla completa); solo cambia el fondo
                    int c = Color.parseColor(hex);
                    if (web != null) web.setBackgroundColor(c);
                } catch (Exception ignored) { }
            });
        }

        // Cambia el ícono de la app en el teléfono (Obsidiana, Violeta o Grafito)
        @JavascriptInterface
        public void setAppIcon(String name) {
            String target = "violeta".equals(name) ? "IconVioleta" : "grafito".equals(name) ? "IconGrafito" : "IconObsidiana";
            PackageManager pm = getPackageManager();
            String[] all = {"IconObsidiana", "IconVioleta", "IconGrafito"};
            try {
                // Primero se activa el nuevo para que la app nunca se quede sin ícono
                pm.setComponentEnabledSetting(new ComponentName(MainActivity.this, getPackageName() + "." + target),
                        PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
                for (String a : all) {
                    if (a.equals(target)) continue;
                    pm.setComponentEnabledSetting(new ComponentName(MainActivity.this, getPackageName() + "." + a),
                            PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
                }
            } catch (Exception ignored) { }
        }

        @JavascriptInterface
        public String getAppIcon() {
            PackageManager pm = getPackageManager();
            String[][] all = {{"IconVioleta", "violeta"}, {"IconGrafito", "grafito"}};
            for (String[] a : all) {
                try {
                    int st = pm.getComponentEnabledSetting(new ComponentName(MainActivity.this, getPackageName() + "." + a[0]));
                    if (st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) return a[1];
                } catch (Exception ignored) { }
            }
            return "obsidiana";
        }

        @JavascriptInterface
        public void exit() { runOnUiThread(() -> moveTaskToBack(true)); }
    }
}
