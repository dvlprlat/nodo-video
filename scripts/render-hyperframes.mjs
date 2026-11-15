import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureWorkDir, fail, getSlug, loadBrandConfig, ROOT, run, slugPaths } from "./lib.mjs";

const CHROME_HEADLESS_SHELL = path.join(
  ROOT,
  "node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell",
);

const brand = loadBrandConfig();
const headingFont = brand.fonts?.heading ?? { family: "Manrope", file: "Manrope-Variable.ttf", weight: "100 900" };
const monoFont = brand.fonts?.mono ?? { family: "IBM Plex Mono", file: "IBMPlexMono-SemiBold.ttf", weight: "600" };
const brandColors = brand.colors ?? {};

// Editorial brand palette & typography loaded dynamically from brand.config.json:
// zero rounded SaaS cards, zero pill badges, pure 1px architectural hairline grid.
const KIVRA_EDITORIAL_CSS = `
  @font-face {
    font-family: "${headingFont.family}";
    src: url("assets/fonts/${headingFont.file}") format("truetype");
    font-weight: ${headingFont.weight};
    font-style: normal;
  }
  @font-face {
    font-family: "${monoFont.family}";
    src: url("assets/fonts/${monoFont.file}") format("truetype");
    font-weight: ${monoFont.weight};
    font-style: normal;
  }
  :root {
    --paper: ${brandColors.bgLight ?? "#F7F8FC"};
    --white: ${brandColors.bgWhite ?? "#FFFFFF"};
    --dark: ${brandColors.bgDark ?? "#050816"};
    --dark-mid: ${brandColors.bgDark2 ?? "#0B1120"};
    --ink: ${brandColors.textPrimary ?? "#0F172A"};
    --ink-muted: ${brandColors.textSecondary ?? "#475569"};
    --text-light: ${brandColors.textWhite ?? "#F8FAFC"};
    --text-dim: ${brandColors.textTertiary ?? "#94A3B8"};
    --cobalt: ${brandColors.accent ?? "#5570FF"};
    --cobalt-soft: ${brandColors.accentLight ?? "#8EA0FF"};
    --rule-dark: ${brandColors.ruleDark ?? "rgba(248, 250, 252, 0.14)"};
    --rule-light: ${brandColors.ruleLight ?? "rgba(15, 23, 42, 0.14)"};
  }
  #root {
    position: absolute;
    inset: 0;
    font-family: "${headingFont.family}", sans-serif;
    color: var(--text-light);
    background: var(--dark);
    overflow: hidden;
  }
  .kicker {
    font-family: "${monoFont.family}", monospace;
    font-size: 21px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--cobalt-soft);
  }
  .kicker.on-light {
    color: var(--cobalt);
  }
  .tabnum {
    font-variant-numeric: tabular-nums;
  }
`;

function buildSubcomposition(scene) {
  const id = scene.animationId;
  const dur = Number(((scene.endMs - scene.startMs) / 1000).toFixed(2));

  // 1. ORPHAN TOOLS (split: y 888..1560, architectural 3-row hairline table)
  if (id === "orphan-tools") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-table {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 900px;
      height: 640px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-top: 1px solid var(--rule-dark);
    }
    .row {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 18px;
      border-bottom: 1px solid var(--rule-dark);
      padding: 0 8px;
    }
    .row-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .row-left {
      display: flex;
      align-items: baseline;
      gap: 22px;
    }
    .row-idx {
      font-family: "IBM Plex Mono", monospace;
      font-size: 22px;
      color: var(--text-dim);
    }
    .row-name {
      font-size: 40px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text-light);
    }
    .row-val {
      font-family: "IBM Plex Mono", monospace;
      font-size: 28px;
      font-weight: 600;
      color: var(--text-dim);
    }
    .line-track {
      width: 100%;
      height: 6px;
      background: rgba(248, 250, 252, 0.10);
      position: relative;
    }
    .line-fill {
      position: absolute;
      inset: 0;
      background: var(--text-dim);
      transform-origin: left center;
    }
    .line-fill.cobalt {
      background: var(--cobalt);
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-table" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-r1" class="row">
        <div class="row-head">
          <div class="row-left"><span class="row-idx">01</span><span class="row-name">Sistemas a medias</span></div>
          <span class="row-val tabnum">15% USO</span>
        </div>
        <div class="line-track"><div id="${id}-b1" class="line-fill"></div></div>
      </div>
      <div id="${id}-r2" class="row">
        <div class="row-head">
          <div class="row-left"><span class="row-idx">02</span><span class="row-name">CRM corporativo</span></div>
          <span class="row-val tabnum">0 REGISTROS</span>
        </div>
        <div class="line-track"><div id="${id}-b2" class="line-fill"></div></div>
      </div>
      <div id="${id}-r3" class="row">
        <div class="row-head">
          <div class="row-left"><span class="row-idx" style="color:var(--cobalt-soft);">03</span><span class="row-name">Excel sigue mandando</span></div>
          <span class="row-val tabnum" style="color:var(--cobalt-soft);">100% CONTROL</span>
        </div>
        <div class="line-track"><div id="${id}-b3" class="line-fill cobalt"></div></div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-r1", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.08);
    tl.fromTo("#${id}-b1", { scaleX: 0 }, { scaleX: 0.15, duration: 0.65, ease: "power2.out" }, 0.25);
    tl.fromTo("#${id}-r2", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 1.65);
    tl.fromTo("#${id}-b2", { scaleX: 0 }, { scaleX: 0.015, duration: 0.35, ease: "power2.out" }, 1.85);
    tl.fromTo("#${id}-r3", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 3.35);
    tl.fromTo("#${id}-b3", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out" }, 3.55);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 2. QUESTION 1 (fullscreen: full-bleed bicolor split, 0% vs 100%)
  if (id === "question-1-process") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-wrap {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 125px;
      height: 1435px;
      display: flex;
      flex-direction: column;
    }
    .half-dark {
      flex: 1;
      background: var(--dark);
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-bottom: 1px solid var(--rule-dark);
    }
    .half-light {
      flex: 1.15;
      background: var(--paper);
      color: var(--ink);
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .giant-num {
      font-size: 196px;
      font-weight: 800;
      line-height: 0.9;
      letter-spacing: -0.045em;
    }
    .sub-Statement {
      font-size: 46px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-wrap" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-top" class="half-dark">
        <div class="kicker">PREGUNTA 01 / 03 · DOCUMENTACIÓN</div>
        <div class="giant-num tabnum" style="color: var(--text-dim);">0%</div>
        <div class="sub-Statement" style="color: var(--text-dim);">Proceso escrito en algún lado</div>
      </div>
      <div id="${id}-bot" class="half-light">
        <div class="kicker on-light">DEPENDENCIA OPERATIVA</div>
        <div id="${id}-num" class="giant-num tabnum" style="color: var(--cobalt);">100%</div>
        <div class="sub-Statement" style="color: var(--ink);">Vive solo en la cabeza de una persona</div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const counter = { val: 0 };
    const numEl = document.getElementById("${id}-num");
    tl.fromTo("#${id}-top", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 0.1);
    tl.fromTo("#${id}-bot", { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, 1.55);
    tl.fromTo(counter, { val: 0 }, {
      val: 100,
      duration: 1.25,
      ease: "power2.out",
      onUpdate: () => { if (numEl) numEl.textContent = Math.round(counter.val) + "%"; }
    }, 1.7);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 3. QUESTION 2 (split: 2 columns separated by 1px vertical line)
  if (id === "question-2-variance") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-panel {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 900px;
      height: 640px;
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--rule-dark);
    }
    .split-cols {
      flex: 1;
      display: flex;
      border-bottom: 1px solid var(--rule-dark);
    }
    .col-a {
      flex: 1;
      padding: 42px 36px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-right: 1px solid var(--rule-dark);
    }
    .col-b {
      flex: 1;
      background: var(--paper);
      color: var(--ink);
      padding: 42px 36px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .big-letter {
      font-size: 120px;
      font-weight: 800;
      line-height: 0.95;
      letter-spacing: -0.04em;
    }
    .col-desc {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.12;
      letter-spacing: -0.02em;
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-panel" class="clip" data-start="0" data-duration="${dur}">
      <div class="split-cols">
        <div id="${id}-c1" class="col-a">
          <div class="kicker">PREGUNTA 02 / 03</div>
          <div class="big-letter" style="color: var(--text-light);">A</div>
          <div class="col-desc">Persona 1 sigue su propio criterio</div>
        </div>
        <div id="${id}-c2" class="col-b">
          <div class="kicker on-light">SIN ESTÁNDAR</div>
          <div class="big-letter" style="color: var(--cobalt);">B</div>
          <div class="col-desc" style="color: var(--ink);">Persona 2 lo hace de forma distinta</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-c1", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.08);
    tl.fromTo("#${id}-c2", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.65);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 4. QUESTION 3 HOURS (fullscreen: one giant hero number + 4 clean bars on paper)
  if (id === "question-3-hours") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-wrap {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 125px;
      height: 1435px;
      background: var(--paper);
      color: var(--ink);
      padding: 64px 52px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .hero-num {
      font-size: 204px;
      font-weight: 800;
      line-height: 0.88;
      letter-spacing: -0.045em;
      color: var(--cobalt);
    }
    .hero-unit {
      font-size: 46px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--ink);
      margin-top: 16px;
    }
    .chart-area {
      height: 460px;
      display: flex;
      align-items: flex-end;
      gap: 28px;
      border-bottom: 2px solid var(--ink);
      padding-bottom: 0;
    }
    .bar-wrap {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }
    .bar-col {
      width: 100%;
      background: var(--ink);
      transform-origin: center bottom;
    }
    .bar-col.accent {
      background: var(--cobalt);
    }
    .axis-labels {
      display: flex;
      gap: 28px;
      padding-top: 16px;
    }
    .axis-lbl {
      flex: 1;
      font-family: "IBM Plex Mono", monospace;
      font-size: 20px;
      font-weight: 600;
      color: var(--ink-muted);
      text-align: center;
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-wrap" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-hdr">
        <div class="kicker on-light" style="margin-bottom: 18px;">PREGUNTA 03 / 03 · COSTO OPERATIVO</div>
        <div style="font-size: 52px; font-weight: 800; line-height: 1.08; letter-spacing: -0.025em;">¿Sabes cuánto te cuesta al mes en horas?</div>
      </div>
      <div>
        <div id="${id}-cnt" class="hero-num tabnum">140h</div>
        <div class="hero-unit">Horas operativas perdidas cada mes</div>
      </div>
      <div>
        <div class="chart-area">
          <div class="bar-wrap"><div id="${id}-w1" class="bar-col" style="height: 36%;"></div></div>
          <div class="bar-wrap"><div id="${id}-w2" class="bar-col" style="height: 56%;"></div></div>
          <div class="bar-wrap"><div id="${id}-w3" class="bar-col" style="height: 78%;"></div></div>
          <div class="bar-wrap"><div id="${id}-w4" class="bar-col accent" style="height: 100%;"></div></div>
        </div>
        <div class="axis-labels">
          <div class="axis-lbl">SEM 01</div>
          <div class="axis-lbl">SEM 02</div>
          <div class="axis-lbl">SEM 03</div>
          <div class="axis-lbl" style="color: var(--cobalt);">SEM 04</div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const state = { h: 0 };
    const cntEl = document.getElementById("${id}-cnt");
    tl.fromTo("#${id}-hdr", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.05);
    tl.fromTo("#${id}-w1", { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: "power3.out" }, 0.2);
    tl.fromTo("#${id}-w2", { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: "power3.out" }, 0.42);
    tl.fromTo("#${id}-w3", { scaleY: 0 }, { scaleY: 1, duration: 0.45, ease: "power3.out" }, 0.64);
    tl.fromTo("#${id}-w4", { scaleY: 0 }, { scaleY: 1, duration: 0.5, ease: "power3.out" }, 0.86);
    tl.fromTo(state, { h: 0 }, {
      h: 140,
      duration: 1.4,
      ease: "power2.out",
      onUpdate: () => { if (cntEl) cntEl.textContent = Math.round(state.h) + "h"; }
    }, 0.2);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 5. SKYSCRAPER ANALOGY (fullscreen: architectural elevation blueprint vs un-planned)
  if (id === "skyscraper-analogy") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-wrap {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 125px;
      height: 1435px;
      display: flex;
      flex-direction: column;
    }
    .top-half {
      flex: 0.9;
      background: var(--dark);
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-bottom: 1px solid var(--rule-dark);
    }
    .bot-half {
      flex: 1.25;
      background: var(--paper);
      color: var(--ink);
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .headline-lg {
      font-size: 68px;
      font-weight: 800;
      line-height: 1.02;
      letter-spacing: -0.03em;
    }
    .levels {
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--rule-light);
    }
    .lvl {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 24px 0;
      border-bottom: 1px solid var(--rule-light);
      font-size: 36px;
      font-weight: 700;
      letter-spacing: -0.015em;
    }
    .lvl-num {
      font-family: "IBM Plex Mono", monospace;
      font-size: 22px;
      color: var(--cobalt);
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-wrap" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-top" class="top-half">
        <div class="kicker">IMPROVISACIÓN</div>
        <div class="headline-lg" style="color: var(--text-dim);">Albañil sin plano</div>
        <div style="font-size: 34px; color: var(--text-dim); font-weight: 500;">Tirar código sin entender el negocio</div>
      </div>
      <div id="${id}-bot" class="bot-half">
        <div class="kicker on-light">ARQUITECTURA DE RASCACIELOS</div>
        <div class="headline-lg" style="color: var(--ink);">Diseño estructural</div>
        <div class="levels">
          <div id="${id}-l1" class="lvl"><span>Cimientos de negocio</span><span class="lvl-num">NIVEL 01</span></div>
          <div id="${id}-l2" class="lvl"><span>Estructura de procesos</span><span class="lvl-num">NIVEL 02</span></div>
          <div id="${id}-l3" class="lvl" style="color: var(--cobalt);"><span>Ingeniería e IA</span><span class="lvl-num">NIVEL 03</span></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-top", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.05);
    tl.fromTo("#${id}-bot", { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.7);
    tl.fromTo("#${id}-l1", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, 1.0);
    tl.fromTo("#${id}-l2", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, 1.25);
    tl.fromTo("#${id}-l3", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" }, 1.5);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 6. THREE PILLARS (split: 3 clean hairline bands, no rounded boxes)
  if (id === "three-pillars") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-panel {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 900px;
      height: 640px;
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--rule-dark);
    }
    .band {
      flex: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid var(--rule-dark);
    }
    .band.light {
      background: var(--paper);
      color: var(--ink);
      padding: 0 32px;
    }
    .band-left {
      display: flex;
      align-items: baseline;
      gap: 28px;
    }
    .band-idx {
      font-family: "IBM Plex Mono", monospace;
      font-size: 24px;
      font-weight: 600;
      color: var(--cobalt-soft);
    }
    .band-title {
      font-size: 52px;
      font-weight: 800;
      letter-spacing: -0.025em;
    }
    .band-sub {
      font-family: "IBM Plex Mono", monospace;
      font-size: 20px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-panel" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-s1" class="band">
        <div class="band-left"><span class="band-idx">01</span><span class="band-title">El diseño</span></div>
        <span class="band-sub">CASO DE NEGOCIO</span>
      </div>
      <div id="${id}-s2" class="band">
        <div class="band-left"><span class="band-idx">02</span><span class="band-title">La estructura</span></div>
        <span class="band-sub">ORDEN Y REGLAS</span>
      </div>
      <div id="${id}-s3" class="band light">
        <div class="band-left"><span class="band-idx" style="color:var(--cobalt);">03</span><span class="band-title" style="color:var(--ink);">Los números</span></div>
        <span class="band-sub" style="color:var(--cobalt);">RENTABILIDAD</span>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-s1", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.15);
    tl.fromTo("#${id}-s2", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 1.15);
    tl.fromTo("#${id}-s3", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 2.05);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 7. KIVRA DUPLA 1 (split: light paper architectural sheet for Business Direction)
  if (id === "kivra-dupla-1") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-panel {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 900px;
      height: 640px;
      background: var(--paper);
      color: var(--ink);
      padding: 40px 44px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .rows {
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--rule-light);
    }
    .r-line {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 26px 0;
      border-bottom: 1px solid var(--rule-light);
    }
    .r-title {
      font-size: 44px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--ink);
    }
    .r-num {
      font-family: "IBM Plex Mono", monospace;
      font-size: 22px;
      font-weight: 600;
      color: var(--cobalt);
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-panel" class="clip" data-start="0" data-duration="${dur}">
      <div class="kicker on-light">DIRECCIÓN DE NEGOCIO · KIVRA</div>
      <div class="rows">
        <div id="${id}-p1" class="r-line"><span class="r-title">Estrategia</span><span class="r-num">01</span></div>
        <div id="${id}-p2" class="r-line"><span class="r-title">Visión legal</span><span class="r-num">02</span></div>
        <div id="${id}-p3" class="r-line"><span class="r-title" style="color:var(--cobalt);">Visión financiera</span><span class="r-num">03</span></div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-p1", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.08);
    tl.fromTo("#${id}-p2", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 0.95);
    tl.fromTo("#${id}-p3", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 1.75);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 8. KIVRA DUPLA 2 (split: 50/50 vertical grid — Business Direction + Iván Engineering & AI)
  if (id === "kivra-dupla-2") {
    return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-panel {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 900px;
      height: 640px;
      display: flex;
      border-top: 1px solid var(--rule-dark);
      border-bottom: 1px solid var(--rule-dark);
    }
    .half-l {
      flex: 1;
      background: var(--dark);
      padding: 40px 34px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-right: 1px solid var(--rule-dark);
    }
    .half-r {
      flex: 1.15;
      background: var(--paper);
      color: var(--ink);
      padding: 40px 36px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .big-role {
      font-size: 40px;
      font-weight: 800;
      line-height: 1.08;
      letter-spacing: -0.02em;
    }
    .sub-list {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.45;
      color: var(--text-dim);
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-panel" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-c1" class="half-l">
        <div class="kicker">NEGOCIO</div>
        <div class="big-role" style="color: var(--text-light);">Dirección</div>
        <div class="sub-list">Estrategia<br/>Visión legal<br/>Finanzas</div>
      </div>
      <div id="${id}-c2" class="half-r">
        <div class="kicker on-light">INGENIERÍA · IVÁN</div>
        <div id="${id}-t1" class="big-role" style="color: var(--ink);">Arquitectura tecnológica</div>
        <div id="${id}-t2" class="big-role" style="color: var(--cobalt);">+ Inteligencia Artificial</div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    tl.fromTo("#${id}-c1", { opacity: 0.5 }, { opacity: 1, duration: 0.3 }, 0.05);
    tl.fromTo("#${id}-c2", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.25);
    tl.fromTo("#${id}-t1", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 1.05);
    tl.fromTo("#${id}-t2", { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }, 2.35);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
  }

  // 9. ROI PROOF (fullscreen: clean bicolor split with 2 giant tabular metrics)
  return `<template>
  <style>
    ${KIVRA_EDITORIAL_CSS}
    #${id}-wrap {
      position: absolute;
      left: 86px;
      right: 86px;
      top: 125px;
      height: 1435px;
      display: flex;
      flex-direction: column;
    }
    .top- cell {
      flex: 1;
    }
    .cell-dark {
      flex: 1;
      background: var(--dark);
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border-bottom: 1px solid var(--rule-dark);
    }
    .cell-light {
      flex: 1.1;
      background: var(--paper);
      color: var(--ink);
      padding: 56px 48px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .stat-giant {
      font-size: 184px;
      font-weight: 800;
      line-height: 0.9;
      letter-spacing: -0.045em;
    }
    .stat-caption {
      font-size: 44px;
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
  </style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
    <div id="${id}-wrap" class="clip" data-start="0" data-duration="${dur}">
      <div id="${id}-m1" class="cell-dark">
        <div class="kicker">01 · IMPACTO OPERATIVO</div>
        <div id="${id}-v1" class="stat-giant tabnum" style="color: var(--text-light);">+60%</div>
        <div class="stat-caption" style="color: var(--text-dim);">Tiempo recuperado para tu operación</div>
      </div>
      <div id="${id}-m2" class="cell-light">
        <div class="kicker on-light">02 · IMPACTO FINANCIERO</div>
        <div id="${id}-v2" class="stat-giant tabnum" style="color: var(--cobalt);">2.5×</div>
        <div class="stat-caption" style="color: var(--ink);">Rentabilidad demostrada antes de programar</div>
      </div>
    </div>
  </div>
  <script>
    const tl = gsap.timeline({ paused: true });
    const s = { p1: 0, p2: 1.0 };
    const v1 = document.getElementById("${id}-v1");
    const v2 = document.getElementById("${id}-v2");
    tl.fromTo("#${id}-m1", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, 0.1);
    tl.fromTo(s, { p1: 0 }, {
      p1: 60,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => { if (v1) v1.textContent = "+" + Math.round(s.p1) + "%"; }
    }, 0.25);
    tl.fromTo("#${id}-m2", { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }, 1.4);
    tl.fromTo(s, { p2: 1.0 }, {
      p2: 2.5,
      duration: 1.1,
      ease: "power2.out",
      onUpdate: () => { if (v2) v2.textContent = s.p2.toFixed(1) + "×"; }
    }, 1.55);
    window.__timelines["${id}"] = tl;
  </script>
</template>`;
}

const slug = getSlug();
const paths = slugPaths(slug);
ensureWorkDir(slug);

if (!existsSync(paths.scenes)) {
  fail(`missing ${path.relative(ROOT, paths.scenes)}`);
}

const { scenes } = JSON.parse(readFileSync(paths.scenes, "utf8"));
const hfScenes = scenes.filter((s) => s.mode === "hyperframes" && s.animationId);
if (!hfScenes.length) {
  console.log("No hyperframes scenes found in scenes.json");
  process.exit(0);
}

const hfDir = path.join(paths.work, "hyperframes");
const compDir = path.join(hfDir, "compositions");
const hfFontsDir = path.join(hfDir, "assets", "fonts");
mkdirSync(compDir, { recursive: true });
mkdirSync(hfFontsDir, { recursive: true });

for (const spec of [headingFont, monoFont]) {
  const fontSrc = path.join(ROOT, "assets", "fonts", spec.file);
  if (existsSync(fontSrc)) {
    copyFileSync(fontSrc, path.join(hfFontsDir, spec.file));
  }
}

let cursorSec = 0;
const slots = [];
for (const scene of hfScenes) {
  const durSec = Number(((scene.endMs - scene.startMs) / 1000).toFixed(2));
  const compFile = `compositions/${scene.animationId}.html`;
  writeFileSync(path.join(hfDir, compFile), buildSubcomposition(scene));
  slots.push({
    id: scene.animationId,
    startSec: Number(cursorSec.toFixed(2)),
    durSec,
    compFile,
  });
  cursorSec = Number((cursorSec + durSec).toFixed(2));
}

const totalDurationSec = Number(cursorSec.toFixed(2));

const indexHtml = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face {
        font-family: "${headingFont.family}";
        src: url("assets/fonts/${headingFont.file}") format("truetype");
        font-weight: ${headingFont.weight};
        font-style: normal;
      }
      @font-face {
        font-family: "${monoFont.family}";
        src: url("assets/fonts/${monoFont.file}") format("truetype");
        font-weight: ${monoFont.weight};
        font-style: normal;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        width: 1080px;
        height: 1920px;
        overflow: hidden;
        background: ${brandColors.bgDark ?? "#050816"};
      }
      #root {
        position: relative;
        width: 1080px;
        height: 1920px;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="${totalDurationSec}"
      data-width="1080"
      data-height="1920"
      data-fps="30"
    >
${slots
  .map(
    (s, i) => `      <div
        id="${s.id}"
        data-composition-id="${s.id}"
        data-composition-src="${s.compFile}"
        data-start="${s.startSec}"
        data-duration="${s.durSec}"
        data-track-index="${i + 1}"
        data-track-kind="graphics"
        data-width="1080"
        data-height="1920"
      ></div>`,
  )
  .join("\n")}
    </div>
    <script>
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`;

writeFileSync(path.join(hfDir, "index.html"), indexHtml);
writeFileSync(
  path.join(hfDir, "hyperframes.json"),
  JSON.stringify({ name: `${slug}-hyperframes`, width: 1080, height: 1920, fps: 30 }, null, 2),
);

const env = {
  ...process.env,
  HYPERFRAMES_BROWSER_PATH: existsSync(CHROME_HEADLESS_SHELL)
    ? CHROME_HEADLESS_SHELL
    : process.env.HYPERFRAMES_BROWSER_PATH,
  HYPERFRAMES_CHROME_SANDBOX: "0",
  HYPERFRAMES_SKIP_SKILLS: "1",
  HYPERFRAMES_NO_UPDATE_CHECK: "1",
};

console.log(`Linting HyperFrames project (${slots.length} scenes, ${totalDurationSec} s)...`);
const lintRes = spawnSync("npx", ["hyperframes", "lint", hfDir], { stdio: "inherit", env });
if (lintRes.status !== 0) {
  fail(`hyperframes lint failed with status ${lintRes.status}`);
}

const reelPath = path.join(hfDir, "reel.mp4");
console.log(`Rendering HyperFrames reel to ${path.relative(ROOT, reelPath)}...`);
const renderRes = spawnSync(
  "npx",
  ["hyperframes", "render", hfDir, "--quality", "looks", "--fps", "30", "-o", reelPath],
  { stdio: "inherit", env },
);
if (renderRes.status !== 0) {
  fail(`hyperframes render failed with status ${renderRes.status}`);
}

for (const s of slots) {
  const clipOut = path.join(hfDir, `${s.id}.mp4`);
  run("ffmpeg", [
    "-nostdin",
    "-y",
    "-ss",
    s.startSec.toFixed(3),
    "-t",
    s.durSec.toFixed(3),
    "-i",
    reelPath,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "16",
    "-pix_fmt",
    "yuv420p",
    "-an",
    clipOut,
  ]);
  console.log(`  Sliced ${s.id}.mp4 (${s.durSec} s)`);
}

console.log(`All ${slots.length} HyperFrames animations rendered in ${path.relative(ROOT, hfDir)}`);
