---
name: setup
description: Interactive onboarding wizard for nodo-videos. Run when the user types /setup, /configurar, /init, "iniciar", or asks to configure their brand, fonts, colors, and environment for creating informative videos.
---

# Asistente de Configuración Inicial (`nodo-videos`)

Cuando el usuario invoque `/setup`, `/configurar`, `"iniciar"` o pida configurar el proyecto por primera vez, guíalo paso a paso en español de forma directa y concisa para dejar listo su entorno y su identidad visual en `brand.config.json`.

## Paso 1: Diagnóstico rápido del entorno
1. Verifica si existen `node_modules/` y `whisper.cpp/`. Si falta alguno, informa al usuario y ejecuta:
   - `npm install` (si no existe `node_modules/`)
   - `npm run setup-whisper` (si no existe el binario o modelo `large-v3-turbo` en `whisper.cpp/`)
   - `npm run link-memory`
2. Ejecuta `npm run check-env` para comprobar `ffmpeg`, fuentes, `hyperframes` y `assets/sfx/`.

## Paso 2: Entrevista de Identidad y Marca (1 sola ronda de preguntas claras)
Haz al usuario las siguientes preguntas (usando la herramienta de preguntas de opción múltiple si tu CLI la tiene disponible, o en una lista numerada corta en texto plano):

1. **Nombre de tu marca o proyecto y dominio web:**
   - Ejemplo: `Kivra` y `kivra.com.mx` (el dominio aparecerá siempre visible de forma sobria en el pie del video).
2. **Sitio web o referencia visual (opcional):**
   - Pregunta si tiene una URL activa (ej. `https://kivra.com.mx`). Si la proporciona, **inspecciónala automáticamente** para extraer su paleta de colores real (`bgDark`, `bgLight`, `accent`, `accentLight`) y sus tipografías sin pedirle códigos hexadecimales a mano.
3. **Textos institucionales de la retícula:**
   - **Encabezado izquierdo:** (ej. `Kivra · Arquitectura de Software e IA`)
   - **Encabezado derecho (categoría):** (ej. `DIAGNÓSTICO DE PROCESOS`)
   - **Pie izquierdo (lema):** (ej. `NEGOCIO ANTES QUE CÓDIGO`)
4. **Estilo tipográfico principal (`fonts.heading`):**
   - **Sans-Serif Geométrica (Recomendado):** `Manrope` (`Manrope-Variable.ttf`, incluida) o `Montserrat Black` (`Montserrat-Black.ttf`, incluida)
   - **Serif Editorial:** `Playfair Display` (`PlayfairDisplay-Italic.ttf`, incluida)
   - **Tipografía propia:** Si el usuario indica otra fuente de Google Fonts o un archivo `.ttf`, colócala en `assets/fonts/` y regístrala en `brand.config.json`.
   - *(Para datos y métricas tabulares se usa por defecto `IBM Plex Mono` en `IBMPlexMono-SemiBold.ttf`).*
5. **Paleta de color (`colors`):**
   - Si no se extrajo de su web, ofrece:
     - **Cobalto Arquitectónico (por defecto):** Fondo oscuro `#050816`, papel `#F7F8FC`, acento `#5570FF` / `#8EA0FF`.
     - **Esmeralda Financiero:** Fondo oscuro `#04110E`, papel `#F6FAF8`, acento `#10B981` / `#6EE7B7`.
     - **Ámbar Editorial:** Fondo oscuro `#0F0C06`, papel `#FAF8F5`, acento `#F59E0B` / `#FCD34D`.
     - **Personalizado:** Códigos hexadecimales que indique el usuario.
6. **Preferencias de audio y ritmo:**
   - Idioma de transcripción (`es` por defecto).
   - Música ambiental de fondo (`informative-bed.wav` a `-20 dB`) y efectos de sonido sincronizados (`SFX` activados por defecto).

## Paso 3: Guardar `brand.config.json` y Validar
1. Escribe la configuración completa en `brand.config.json` en la raíz del repositorio (o ejecuta `npm run init -- --brand="..." --domain="..." --accent="..."`).
2. Ejecuta `npm run init` para verificar que todas las fuentes, la cama musical (`assets/music/informative-bed.wav`), los efectos (`assets/sfx/`) y `whisper.cpp` reporten `[OK]`.

## Paso 4: Instrucciones Finales para el Usuario
Una vez que `npm run init` pase con todo en `[OK]`, muéstrale al usuario exactamente cómo producir su primer video:

1. **Crear la carpeta del video:**
   Coloca tu grabación frente a cámara (`video.mp4` o `camera.mp4`, o solo voz `voice.wav`) dentro de:
   ```text
   input/<nombre-del-video>/
   ```
   *(Opcional)* Agrega `input/<nombre-del-video>/notes.md` con el gancho inicial, términos técnicos o nombres propios a cuidar en la transcripción.
2. **Iniciar el pipeline:**
   Escribe aquí mismo en el chat:
   > **`procesa <nombre-del-video>`**
3. **Flujo con 2 Checkpoints:**
   - El agente limpiará el video/audio, transcribirá con timestamps palabra por palabra y **se detendrá en el Checkpoint 1** para que confirmes el texto.
   - Luego diseñará la escaleta de escenas (combinando persona a cámara, animaciones de datos en HyperFrames y tarjetas tipográficas bicolores) y **se detendrá en el Checkpoint 2** para tu aprobación antes de renderizar `out/<nombre-del-video>.mp4`.
