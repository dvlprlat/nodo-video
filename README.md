# nodo-videos

Sistema open-source para producir **videos informativos verticales** (`1080×1920`, `30 fps`) para TikTok, Instagram Reels, YouTube Shorts y LinkedIn combinando:

- **Persona a cámara (`camera`)** enmarcada en una retícula arquitectónica de `1px` con el dominio de tu marca siempre visible.
- **Animaciones de datos y conceptos (`hyperframes`)** generadas como código HTML/GSAP con [HyperFrames](https://github.com/heygen-com/hyperframes), tanto en pantalla dividida (`split` 50/50 con el presentador) como a pantalla completa (`fullscreen`).
- **Tarjetas tipográficas bicolores (`kinetic`)** con partición gramatical en español (sin dejar preposiciones ni artículos huérfanos).
- **Diseño sonoro automático (`SFX` + música ambiental)** con *whooshes*, *rollovers*, *dings* de métricas y golpes graves sincronizados al milisegundo bajo la voz normalizada a `-14 LUFS`.

Diseñado para usarse directamente desde cualquier **Agente CLI** (**Claude Code**, **Antigravity CLI**, **Codex CLI** u **OpenCode**).

---

## Inicio Rápido (Para quien recién clona el repositorio)

### 1. Clonar e instalar dependencias

> **Importante en Windows (WSL2):** Clona el repositorio dentro del sistema de archivos de Linux (`~/nodo-videos`), nunca en `/mnt/c/`.

```bash
git clone <url-del-repositorio> ~/nodo-videos
cd ~/nodo-videos
npm install
npm run setup-whisper
npm run link-memory
```

### 2. Configurar tu marca con tu Agente CLI (`/setup`)

Abre tu Agente CLI favorito dentro de `~/nodo-videos` (`claude`, `agy`, `codex` u `opencode`) y ejecuta:

```text
/setup
```
*(También puedes usar `/configurar`, escribir `"iniciar"` en el chat, o correr `npm run init` en la terminal).*

El agente te hará unas breves preguntas para configurar tu proyecto con las mínimas iteraciones posibles:
1. **Nombre de tu marca o negocio** y **dominio web** (que aparecerá siempre visible en el pie del video, ej. `kivra.com.mx`).
2. **Sitio web de referencia (opcional):** Si le pasas la URL de tu web, el agente extraerá automáticamente tus colores y tipografías.
3. **Textos de encabezado y lema de pie de página** (ej. *"Arquitectura de Software e IA"* / *"Negocio antes que código"*).
4. **Preferencia tipográfica:** Sans-serif geométrica (`Manrope`, `Montserrat`), Serif editorial (`Playfair Display`) o tu propia fuente `.ttf`, más `IBM Plex Mono` para métricas tabulares.
5. **Paleta de colores y preferencias de audio/SFX.**

Toda tu configuración se guarda en `brand.config.json` (puedes ver un ejemplo real en [`examples/kivra.brand.json`](examples/kivra.brand.json)).

---

## Cómo Crear un Video (`procesa <slug>`)

Una vez completado `/setup`, el flujo para cada nuevo video consta de 3 pasos:

### Paso 1: Colocar tus materiales en `input/<slug>/`
Crea una carpeta con el identificador de tu video dentro de `input/` (por ejemplo `input/mi-primer-video/`) y coloca ahí:
- **`video.mp4`** (o `camera.mp4`): tu grabación hablando a cámara (el sistema también acepta solo audio en `voice.wav` si no quieres aparecer a cámara).
- **`notes.md`** *(opcional)*: notas con el gancho inicial, nombres propios o datos clave que quieras destacar (mira [`input/ejemplo/notes.md`](input/ejemplo/notes.md)).

### Paso 2: Pedirle al Agente que lo procese
En tu Agente CLI escribe:

```text
procesa mi-primer-video
```

### Paso 3: Aprobar los 2 Checkpoints de Calidad
El agente ejecutará el pipeline de 8 etapas y se detendrá únicamente en dos puntos de control:

1. **Limpieza automática (`clean-video`) y Transcripción (`transcribe`):**
   Recorta silencios largos, atenúa respiraciones, normaliza la voz a `-14 LUFS` y transcribe palabra por palabra con `whisper.cpp` (`large-v3-turbo` con alineación DTW).
2. **🛑 Checkpoint 1 (Transcripción y Gancho):**
   El agente te muestra el texto transcrito y las palabras de baja confianza para que confirmes o corrijas términos antes de armar las escenas.
3. **🛑 Checkpoint 2 (Escaleta Visual de Escenas):**
   El agente te presenta una tabla con la división de escenas (`camera`, `hyperframes` en modo `split` o `fullscreen`, y `kinetic`), las palabras de énfasis y qué datos se convertirán en animación.
4. **Render de Animaciones (`render-hyperframes`) + Render Final (`render`):**
   Tras tu aprobación, el agente compila las animaciones en HyperFrames con los colores y fuentes de tu `brand.config.json`, mezcla la voz, la música ambiental y los efectos de sonido (`SFX`), verifica que no existan cuadros negros y entrega el archivo final en:
   ```text
   out/mi-primer-video.mp4
   ```

---

## Comandos de Terminal

| Comando | Qué hace |
| --- | --- |
| `npm run init` | Inicializa `brand.config.json`, restaura `assets/sfx/`, genera cama musical y verifica el entorno |
| `npm run check-env` | Comprueba Node, `ffmpeg`, `brand.config.json`, fuentes, SFX, HyperFrames y `whisper.cpp` |
| `npm run setup-whisper` | Compila `whisper.cpp` y descarga el modelo `ggml-large-v3-turbo.bin` |
| `npm run clean-video <slug>` | Limpia silencios/respiraciones, normaliza a `-14 LUFS` y reescala a `1080×1920` |
| `npm run clean-audio <slug>` | Limpia y normaliza grabaciones de solo voz (`input/<slug>/voice.wav`) |
| `npm run transcribe <slug>` | Transcribe con `whisper.cpp` y genera `captions.json` con tiempos DTW |
| `npm run render-hyperframes <slug>` | Valida (`lint`) y renderiza las animaciones HTML/GSAP de `scenes.json` |
| `npm run render <slug>` | Renderiza el video final en `out/<slug>.mp4` con música y SFX |
| `npm run dev` | Abre Remotion Studio (`BrandPreview` y `ShortInfo`) |
| `npm run lint` | Ejecuta ESLint + TypeScript (`tsc`) |

---

## Estructura del Proyecto

```text
nodo-videos/
├── AGENTS.md                  # Manual maestro para cualquier Agente CLI
├── CLAUDE.md                  # Importador de AGENTS.md para Claude Code
├── brand.config.example.json  # Plantilla de identidad visual y audio
├── examples/
│   └── kivra.brand.json       # Preset real de referencia (Kivra Enterprise)
├── .agents/skills/            # Skills integradas (/setup, hyperframes, media-use, etc.)
├── .claude/commands/          # Comandos slash (/setup, /configurar) para Claude Code
├── assets/
│   ├── fonts/                 # Tipografías OFL incluidas (Manrope, IBM Plex Mono, Montserrat, Playfair)
│   ├── music/                 # Cama musical ambiental (-20 dB bajo la voz)
│   └── sfx/                   # Librería de 19 efectos sonoros (whoosh, click, ping, chime, impact)
├── input/
│   └── ejemplo/notes.md       # Plantilla de notas para un nuevo video
├── scripts/                   # Scripts modulares de cada etapa del pipeline
├── src/
│   ├── brand.ts               # Tipos y validador de BrandConfig
│   ├── ShortInfo.tsx          # Composición principal parametrizada + motor gramatical y SFX
│   └── Root.tsx               # Registro de composiciones (ShortInfo y BrandPreview)
├── work/                      # Archivos intermedios por video (ignorado en git)
└── out/                       # Videos finales renderizados .mp4 (ignorado en git)
```
