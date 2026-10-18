# Velum Music

App de música para tu propia música (archivos en tu teléfono), con diseño premium tipo *liquid glass* en los colores del logo.

## Instalar en Android
Ve a **Releases** en este repositorio, descarga `Velum-Music.apk` (la versión más reciente) desde el teléfono y ábrelo.
La primera vez toca **Elegir carpeta de música** y selecciona la carpeta donde guardas tus canciones (por ejemplo `Music` o `Download`).
Velum recuerda la carpeta y, cada vez que vuelves a la app, detecta canciones nuevas.

## Qué hace
- **Reconoce tu carpeta**: canciones, álbumes, artistas, géneros y subcarpetas. Puedes agregar varias carpetas.
- **Lee las etiquetas** de MP3, M4A/AAC/ALAC, FLAC, OGG, OPUS y WAV: título, artista, álbum, número de pista, año, género, carátula y letra.
  Si una canción no tiene etiquetas, usa el nombre del archivo (`Artista - Título.mp3`) y la carátula `cover.jpg`/`folder.jpg` de la carpeta.
- **Letras sincronizadas** desde archivos `.lrc` con el mismo nombre de la canción (toca una línea para saltar a esa parte).
- **Listas `.m3u`** de tu carpeta aparecen solas en *Listas → De tu carpeta*.
- **Reproductor completo**: fondo que toma el color de la carátula, carátula que late con el bajo, aleatorio, repetir (todo / una), cola editable (arrastrar para reordenar), a continuación / al final de la cola.
- **Ecualizador de 10 bandas** con preajustes (graves, voces, rock, reggaetón, electrónica…).
- **Fundido entre canciones** (0–12 s), **sin pausas**, **reproducción automática** de canciones parecidas al terminar la cola.
- **Temporizador para dormir** (con desvanecido) y **velocidad** de reproducción.
- **Me gusta**, listas propias, *Más escuchadas*, *Escuchadas recientemente*, *Agregadas recientemente*, *Para hoy*.
- **Búsqueda** sin importar acentos, con búsquedas recientes.
- **Estadísticas**: tiempo escuchado por día, canciones y artistas más escuchados.
- **Segundo plano**: controles en la notificación, pantalla bloqueada y audífonos; pausa al desconectar audífonos o al recibir una llamada.
- Recuerda dónde te quedaste (canción, posición y cola).

Todo se queda en tu teléfono; no necesita internet.

## Estructura
- `www/` — la app (HTML/CSS/JS). También funciona en Chrome de computadora: abre `www/index.html` desde un servidor local.
- `android/` — envoltura nativa (WebView) que lee la carpeta elegida y maneja la notificación de reproducción.
- `.github/workflows/build.yml` — construye el APK y lo publica en Releases.
