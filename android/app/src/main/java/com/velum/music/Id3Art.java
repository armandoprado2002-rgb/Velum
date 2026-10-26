package com.velum.music;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Lector propio de carátulas en etiquetas ID3 (MP3). Se usa cuando el lector de Android no la encuentra:
 * entiende ID3v2.2/2.3/2.4, la "desincronización" y las etiquetas v2.4 mal escritas por iTunes
 * (tamaños sin synchsafe). Como último recurso busca una imagen JPEG o PNG dentro de la etiqueta.
 */
final class Id3Art {
    private static final int MAX_TAG = 48 * 1024 * 1024;

    private Id3Art() { }

    static byte[] read(InputStream in) throws IOException {
        byte[] h = readFully(in, 10);
        if (h == null || h[0] != 'I' || h[1] != 'D' || h[2] != '3') return null;
        int ver = h[3], flags = h[5] & 0xFF, size = synch(h, 6);
        if (size <= 0 || size > MAX_TAG) return null;
        byte[] tag = readFully(in, size);
        if (tag == null) return null;
        return fromTag(tag, ver, flags);
    }

    static byte[] fromTag(byte[] tag, int ver, int flags) {
        if (ver < 4 && (flags & 0x80) != 0) tag = unsync(tag);
        int p = 0;
        if ((flags & 0x40) != 0 && tag.length >= 4) p = ver == 3 ? be32(tag, 0) + 4 : synch(tag, 0);
        int idLen = ver == 2 ? 3 : 4, hdr = ver == 2 ? 6 : 10;
        byte[] best = null;
        while (p >= 0 && p + hdr <= tag.length) {
            if (!isId(tag, p, idLen)) break;
            String id = new String(tag, p, idLen, StandardCharsets.ISO_8859_1);
            int size = ver == 2 ? be24(tag, p + 3) : ver == 4 ? synch(tag, p + 4) : be32(tag, p + 4);
            if (ver == 4) {
                // iTunes escribe tamaños normales en v2.4: si el siguiente marco no cuadra, prueba así
                int plain = be32(tag, p + 4);
                if (plain != size && !nextOk(tag, p + hdr + size, idLen) && nextOk(tag, p + hdr + plain, idLen)) size = plain;
            }
            if (size <= 0) break;
            int fflags = ver == 2 ? 0 : tag[p + 9] & 0xFF;
            int start = p + hdr, end = Math.min(tag.length, start + size);
            if (id.equals("APIC") || id.equals("PIC")) {
                byte[] d = Arrays.copyOfRange(tag, start, end);
                if (ver == 4 && (fflags & 0x01) != 0 && d.length > 4) d = Arrays.copyOfRange(d, 4, d.length);
                if (ver == 4 && (fflags & 0x02) != 0) d = unsync(d);
                byte[] img = picture(d, id.equals("PIC"));
                if (img != null) {
                    int type = pictureType(d, id.equals("PIC"));
                    if (type == 3) return img;          // portada
                    if (best == null) best = img;
                }
            }
            p = start + size;
        }
        if (best != null) return best;
        return scanForImage(tag);
    }

    private static byte[] picture(byte[] d, boolean v22) {
        if (d.length < 8) return null;
        int enc = d[0], o;
        if (v22) o = 5;
        else {
            o = 1;
            while (o < d.length && d[o] != 0) o++;
            o += 2; // fin del tipo MIME + tipo de imagen
        }
        if (enc == 1 || enc == 2) {
            while (o + 1 < d.length && !(d[o] == 0 && d[o + 1] == 0)) o += 2;
            o += 2;
        } else {
            while (o < d.length && d[o] != 0) o++;
            o++;
        }
        if (o < d.length) {
            int s = imageStart(d, o);
            if (s >= 0) return Arrays.copyOfRange(d, s, d.length);
        }
        int s = imageStart(d, 1);
        return s >= 0 ? Arrays.copyOfRange(d, s, d.length) : null;
    }

    private static int pictureType(byte[] d, boolean v22) {
        if (v22) return d.length > 4 ? d[4] & 0xFF : 0;
        int o = 1;
        while (o < d.length && d[o] != 0) o++;
        return o + 1 < d.length ? d[o + 1] & 0xFF : 0;
    }

    // Posición del inicio de un JPEG o PNG a partir de "from" (tolera unos bytes de basura antes)
    private static int imageStart(byte[] d, int from) {
        int limit = Math.min(d.length - 4, from + 64);
        for (int i = Math.max(0, from); i <= limit; i++) if (isImageAt(d, i)) return i;
        return -1;
    }

    private static byte[] scanForImage(byte[] tag) {
        for (int i = 0; i + 4 < tag.length; i++) if (isImageAt(tag, i)) return Arrays.copyOfRange(tag, i, tag.length);
        return null;
    }

    private static boolean isImageAt(byte[] d, int i) {
        if (i + 4 > d.length) return false;
        if ((d[i] & 0xFF) == 0xFF && (d[i + 1] & 0xFF) == 0xD8 && (d[i + 2] & 0xFF) == 0xFF) return true;
        return (d[i] & 0xFF) == 0x89 && d[i + 1] == 'P' && d[i + 2] == 'N' && d[i + 3] == 'G';
    }

    private static boolean isId(byte[] b, int p, int n) {
        for (int i = 0; i < n; i++) {
            int c = b[p + i];
            if (!((c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9'))) return false;
        }
        return true;
    }

    private static boolean nextOk(byte[] b, int q, int idLen) {
        if (q == b.length) return true;
        if (q < 0 || q > b.length) return false;
        if (b[q] == 0) return true; // relleno
        return q + idLen <= b.length && isId(b, q, idLen);
    }

    private static byte[] unsync(byte[] b) {
        byte[] out = new byte[b.length];
        int j = 0;
        for (int i = 0; i < b.length; i++) {
            out[j++] = b[i];
            if ((b[i] & 0xFF) == 0xFF && i + 1 < b.length && b[i + 1] == 0) i++;
        }
        return Arrays.copyOf(out, j);
    }

    private static int synch(byte[] b, int o) {
        return ((b[o] & 0x7F) << 21) | ((b[o + 1] & 0x7F) << 14) | ((b[o + 2] & 0x7F) << 7) | (b[o + 3] & 0x7F);
    }

    private static int be32(byte[] b, int o) {
        return ((b[o] & 0xFF) << 24) | ((b[o + 1] & 0xFF) << 16) | ((b[o + 2] & 0xFF) << 8) | (b[o + 3] & 0xFF);
    }

    private static int be24(byte[] b, int o) {
        return ((b[o] & 0xFF) << 16) | ((b[o + 1] & 0xFF) << 8) | (b[o + 2] & 0xFF);
    }

    private static byte[] readFully(InputStream in, int n) throws IOException {
        byte[] b = new byte[n];
        int off = 0;
        while (off < n) {
            int r = in.read(b, off, n - off);
            if (r < 0) return off >= 10 ? Arrays.copyOf(b, off) : null;
            off += r;
        }
        return b;
    }
}
