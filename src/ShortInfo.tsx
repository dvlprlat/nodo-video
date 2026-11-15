import type { Caption } from "@remotion/captions";
import { fitText } from "@remotion/layout-utils";
import { useEffect, useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  type CalculateMetadataFunction,
  continueRender,
  delayRender,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type BrandConfig, DEFAULT_BRAND_CONFIG, mergeBrandConfig } from "./brand";

const FPS = 30;

const GRID = {
  left: 86,
  right: 86,
  top: 125,
  bottom: 125,
  splitY: 900,
  captionTopY: 1540,
};

const normalizeToken = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const cleanToken = (s: string) => s.replace(/^[¿¡"«(]+|[?!.,;:"»)]+$/g, "");

const loadedFontKeys = new Set<string>();
const useBrandFonts = (brand: BrandConfig) => {
  useEffect(() => {
    const specs = [brand.fonts.heading, brand.fonts.mono];
    const handle = delayRender("Loading brand fonts");
    Promise.all(
      specs.map(async (s) => {
        const key = `${s.family}:${s.file}:${s.weight}`;
        if (loadedFontKeys.has(key)) {
          return;
        }
        const face = new FontFace(s.family, `url(${staticFile(`fonts/${s.file}`)})`, {
          weight: s.weight,
          style: "normal",
        });
        await face.load();
        document.fonts.add(face);
        loadedFontKeys.add(key);
      }),
    )
      .then(() => continueRender(handle))
      .catch((err) => {
        console.error(err);
        continueRender(handle);
      });
  }, [brand.fonts.heading, brand.fonts.mono]);
};

export type InfoMode = "camera" | "hyperframes" | "kinetic";
export type HyperframesLayout = "fullscreen" | "split";
export type Grade = "cold" | "bw" | "warm";

export type InfoHook = {
  title: string;
  subtitle?: string;
  startMs: number;
  endMs: number;
};

export type InfoLook = {
  song?: string;
  artist?: string;
  hook?: InfoHook;
};

export type SfxCueSpec = {
  file: string;
  offsetMs: number;
  volume?: number;
};

export type InfoScene = {
  id: number;
  text: string;
  startMs: number;
  endMs: number;
  mode: InfoMode;
  hyperframesLayout?: HyperframesLayout;
  animationId?: string;
  grade?: Grade;
  emphasis: string[];
  sfx?: SfxCueSpec[];
};

export type ShortInfoProps = {
  music: string | null;
  audio: string;
  camera: string | null;
  captions: Caption[];
  scenes: InfoScene[];
  look?: InfoLook;
  brand?: BrandConfig;
};

type WordToken = {
  text: string;
  fromMs: number;
  toMs: number;
};

type PhrasePage = {
  startMs: number;
  endMs: number;
  tokens: WordToken[];
};

const PROCLITICS = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "lo",
  "de",
  "del",
  "a",
  "al",
  "en",
  "con",
  "por",
  "para",
  "hacia",
  "hasta",
  "sin",
  "sobre",
  "entre",
  "que",
  "si",
  "como",
  "cuando",
  "porque",
  "aunque",
  "pero",
  "y",
  "e",
  "o",
  "u",
  "ni",
  "mi",
  "mis",
  "tu",
  "tus",
  "su",
  "sus",
  "ese",
  "esa",
  "este",
  "esta",
  "estos",
  "estas",
  "no",
  "se",
  "te",
  "me",
  "le",
  "les",
  "nos",
  "es",
  "son",
  "fue",
  "era",
  "mas",
  "muy",
  "ya",
  "solo",
]);

const PREPOSITIONS = new Set([
  "de",
  "del",
  "a",
  "al",
  "en",
  "con",
  "por",
  "para",
  "sin",
  "sobre",
  "entre",
  "que",
  "pero",
  "porque",
]);

const isFunctionWord = (text: string) => PROCLITICS.has(normalizeToken(text));

const extractWords = (captions: Caption[]): WordToken[] => {
  const words: WordToken[] = [];
  for (const c of captions) {
    if ((c.text.startsWith(" ") || words.length === 0) && c.text.trim()) {
      words.push({ text: c.text.trim(), fromMs: c.startMs, toMs: c.endMs });
    } else if (words.length > 0) {
      words[words.length - 1].text += c.text;
      words[words.length - 1].toMs = c.endMs;
    }
  }
  return words;
};

const solveClause = (cl: WordToken[]): WordToken[][] => {
  const n = cl.length;
  if (n <= 5) {
    return [cl];
  }
  const dp = Array<number>(n + 1).fill(-1e9);
  const nextIdx = Array<number>(n + 1).fill(n);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    for (let k = 2; k <= 6 && i + k <= n; k++) {
      const slice = cl.slice(i, i + k);
      const lastW = normalizeToken(slice[slice.length - 1].text);
      const nextW = normalizeToken(cl[i + k]?.text ?? "");
      const contentCount = slice.filter((t) => !isFunctionWord(t.text)).length;
      const totalChars = slice.reduce((acc, t) => acc + t.text.length, 0);

      let score = 0;
      if (PROCLITICS.has(lastW)) {
        score -= 260;
      } else {
        score += 34;
      }
      if (contentCount >= 1 && contentCount <= 3) {
        score += 28;
      } else if (contentCount === 0) {
        score -= 140;
      }
      if (i + k < n && PREPOSITIONS.has(nextW)) {
        score += 24;
      }
      if (totalChars > 32) {
        score -= (totalChars - 32) * 2.5;
      }

      const cand = score + dp[i + k];
      if (cand > dp[i]) {
        dp[i] = cand;
        nextIdx[i] = i + k;
      }
    }
  }

  const out: WordToken[][] = [];
  let cur = 0;
  while (cur < n) {
    const nxt = nextIdx[cur] > cur ? nextIdx[cur] : n;
    out.push(cl.slice(cur, nxt));
    cur = nxt;
  }
  return out;
};

const buildPhrasePages = (captions: Caption[], scenes: InfoScene[]): PhrasePage[] => {
  const words = extractWords(captions);
  const sceneOf = (ms: number) => scenes.find((s) => ms >= s.startMs && ms < s.endMs);
  const clauses: WordToken[][] = [];
  let clause: WordToken[] = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    clause.push(w);
    const hasPunct = /[,.;:?!]$/.test(w.text) && !/^\d+[.,)]?$/.test(w.text);
    const gapAfter = next ? next.fromMs - w.toMs : 9999;
    const sceneChange = next ? sceneOf(w.fromMs)?.id !== sceneOf(next.fromMs)?.id : true;
    if (sceneChange || hasPunct || (gapAfter >= 360 && !isFunctionWord(w.text))) {
      clauses.push(clause);
      clause = [];
    }
  }
  if (clause.length) {
    clauses.push(clause);
  }

  const pages: PhrasePage[] = [];
  for (const cl of clauses) {
    for (const chunk of solveClause(cl)) {
      pages.push({
        startMs: chunk[0].fromMs,
        endMs: chunk[chunk.length - 1].toMs,
        tokens: chunk,
      });
    }
  }
  return pages;
};

const fit = (text: string, withinWidth: number, fontFamily: string, fontWeight: number | string = 700) =>
  fitText({ text: text || "A", withinWidth: Math.max(120, withinWidth), fontFamily, fontWeight }).fontSize;

const splitSceneGrammatically = (tokens: WordToken[]): [WordToken[], WordToken[]] => {
  if (tokens.length <= 2) {
    return [tokens, []];
  }
  const n = tokens.length;
  const target = n / 2;
  let bestIdx = Math.max(1, Math.floor(target));
  let bestScore = -1e9;

  for (let i = 2; i <= n - 2; i++) {
    const prev = tokens[i - 1];
    const next = tokens[i];
    const prevNorm = normalizeToken(prev.text);
    const nextNorm = normalizeToken(next.text);
    let score = -Math.abs(i - target) * 14;

    if (/[,.;:?!]$/.test(prev.text)) {
      score += 90;
    }
    if (PROCLITICS.has(prevNorm)) {
      score -= 300;
    }
    if (PREPOSITIONS.has(nextNorm)) {
      score += 36;
    }
    const lowerContent = tokens.slice(i).filter((t) => !isFunctionWord(t.text)).length;
    if (lowerContent === 0) {
      score -= 300;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return [tokens.slice(0, bestIdx), tokens.slice(bestIdx)];
};

// Persistent Architectural Grid Header & Footer parameterized by BrandConfig
export const BrandChrome: React.FC<{ brand: BrandConfig }> = ({ brand }) => {
  const { colors, fonts } = brand;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
      {/* 1px architectural hairline grid */}
      <div style={{ position: "absolute", top: 0, bottom: 0, left: GRID.left, width: 1, backgroundColor: colors.ruleDark }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: GRID.right, width: 1, backgroundColor: colors.ruleDark }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: GRID.top, height: 1, backgroundColor: colors.ruleDark }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: GRID.bottom, height: 1, backgroundColor: colors.ruleDark }} />

      {/* Top Editorial Header Bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: GRID.left,
          right: GRID.right,
          height: GRID.top,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            fontFamily: fonts.heading.family,
            fontSize: 21,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: colors.textTertiary,
          }}
        >
          <span
            style={{
              width: 16,
              height: 2,
              backgroundColor: colors.accent,
              display: "inline-block",
            }}
          />
          {brand.headerLeft}
        </div>

        <span
          style={{
            fontFamily: fonts.mono.family,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: colors.textMuted,
          }}
        >
          {brand.headerRight}
        </span>
      </div>

      {/* Bottom Institutional Footer Bar: single persistent domain signature */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: GRID.left,
          right: GRID.right,
          height: GRID.bottom,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
        }}
      >
        <span
          style={{
            fontFamily: fonts.mono.family,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: colors.textMuted,
          }}
        >
          {brand.footerLeft}
        </span>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            fontFamily: fonts.heading.family,
            fontSize: 25,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: colors.textWhite,
          }}
        >
          <span
            style={{
              width: 16,
              height: 2,
              backgroundColor: colors.accent,
              display: "inline-block",
            }}
          />
          {brand.domain}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Opening Hook Band: Full-width architectural paper band docked to the top hairline rule (0px radius)
const HookBanner: React.FC<{ hook: InfoHook; brand: BrandConfig }> = ({ hook, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts } = brand;
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 180, mass: 0.7 } });
  const translateY = interpolate(enter, [0, 1], [-18, 0]);
  const titleFontSize = Math.min(40, Math.max(28, fit(hook.title, 820, fonts.heading.family, 800)));

  return (
    <div
      style={{
        position: "absolute",
        top: GRID.top + 1,
        left: GRID.left + 1,
        right: GRID.right + 1,
        backgroundColor: colors.bgLight,
        borderBottom: `1px solid ${colors.ruleLight}`,
        padding: "24px 36px",
        transform: `translateY(${translateY}px)`,
        opacity: enter,
        zIndex: 10,
      }}
    >
      {hook.subtitle ? (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            fontFamily: fonts.mono.family,
            fontWeight: 600,
            fontSize: 16,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: colors.accent,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              width: 14,
              height: 2,
              backgroundColor: colors.accent,
              display: "inline-block",
            }}
          />
          {hook.subtitle}
        </div>
      ) : null}
      <div
        style={{
          color: colors.textPrimary,
          fontFamily: fonts.heading.family,
          fontWeight: 800,
          fontSize: titleFontSize,
          lineHeight: 1.1,
          letterSpacing: "-0.025em",
        }}
      >
        {hook.title}
      </div>
    </div>
  );
};

const isEmphasized = (word: string, emphasis: string[]) => {
  const norm = normalizeToken(word);
  if (!norm || isFunctionWord(word)) {
    return false;
  }
  return emphasis.some((e) =>
    e
      .split(/\s+/)
      .map(normalizeToken)
      .filter(Boolean)
      .includes(norm),
  );
};

// Clean Editorial Subtitles — no rounded player box, no thick left border, no background pills
const LowerCaptionBand: React.FC<{
  pages: PhrasePage[];
  scene: InfoScene;
  brand: BrandConfig;
  dockedBar?: boolean;
}> = ({ pages, scene, brand, dockedBar = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts } = brand;
  const nowMs = scene.startMs + (frame / fps) * 1000;
  const activePage =
    pages.find((p) => nowMs >= p.startMs && nowMs < p.endMs) ??
    pages.find((p) => p.startMs >= scene.startMs && p.startMs < scene.endMs);

  if (!activePage) {
    return null;
  }

  const pageElapsedFrames = Math.max(0, ((nowMs - activePage.startMs) / 1000) * fps);
  const pop = spring({ frame: pageElapsedFrames, fps, config: { damping: 20, stiffness: 220, mass: 0.6 } });
  const y = interpolate(pop, [0, 1], [10, 0]);
  const fullLine = activePage.tokens.map((t) => cleanToken(t.text)).join(" ");
  const maxFont = dockedBar ? 48 : 54;
  const fontSize = Math.min(maxFont, Math.max(34, fit(fullLine, 780, fonts.heading.family, 800)));

  if (dockedBar) {
    return (
      <div
        style={{
          position: "absolute",
          left: GRID.left + 1,
          right: GRID.right + 1,
          top: GRID.captionTopY,
          height: 1920 - GRID.bottom - GRID.captionTopY,
          backgroundColor: colors.bgDark,
          borderTop: `1px solid ${colors.ruleDark}`,
          padding: "0 44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          zIndex: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            gap: "6px 13px",
            transform: `translateY(${y}px)`,
          }}
        >
          {activePage.tokens.map((tok, idx) => {
            const active = nowMs >= tok.fromMs;
            const emph = isEmphasized(tok.text, scene.emphasis);
            return (
              <span
                key={`${tok.fromMs}-${idx}`}
                style={{
                  fontFamily: fonts.heading.family,
                  fontWeight: emph ? 800 : 700,
                  fontSize,
                  lineHeight: 1.14,
                  letterSpacing: "-0.02em",
                  color: emph ? colors.accentLight : colors.textWhite,
                  opacity: active ? 1 : 0.38,
                  textDecoration: emph && active ? "underline" : "none",
                  textDecorationColor: colors.accent,
                  textUnderlineOffset: "8px",
                  textDecorationThickness: "3px",
                }}
              >
                {cleanToken(tok.text)}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        left: GRID.left + 44,
        right: GRID.right + 44,
        bottom: GRID.bottom + 42,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "flex-start",
        gap: "6px 14px",
        zIndex: 8,
        transform: `translateY(${y}px)`,
      }}
    >
      {activePage.tokens.map((tok, idx) => {
        const active = nowMs >= tok.fromMs;
        const emph = isEmphasized(tok.text, scene.emphasis);
        return (
          <span
            key={`${tok.fromMs}-${idx}`}
            style={{
              fontFamily: fonts.heading.family,
              fontWeight: emph ? 800 : 700,
              fontSize,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              color: emph ? colors.accentLight : colors.textWhite,
              opacity: active ? 1 : 0.38,
              textDecoration: emph && active ? "underline" : "none",
              textDecorationColor: colors.accent,
              textUnderlineOffset: "8px",
              textDecorationThickness: "3px",
            }}
          >
            {cleanToken(tok.text)}
          </span>
        );
      })}
    </div>
  );
};

// Architectural Bicolor Split Card (Full sentence split across Light Paper top & Dark Navy bottom, 0px radius)
export const KineticFullCard: React.FC<{
  allWords: WordToken[];
  scene: InfoScene;
  brand: BrandConfig;
}> = ({ allWords, scene, brand }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors, fonts } = brand;
  const nowMs = scene.startMs + (frame / fps) * 1000;

  const sceneTokens = useMemo(() => {
    const matching = allWords.filter((w) => w.toMs > scene.startMs && w.fromMs < scene.endMs);
    return matching.length > 0
      ? matching
      : [{ text: scene.text, fromMs: scene.startMs, toMs: scene.endMs }];
  }, [allWords, scene.startMs, scene.endMs, scene.text]);

  const [upperTokens, lowerTokens] = useMemo(() => splitSceneGrammatically(sceneTokens), [sceneTokens]);

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 180, mass: 0.75 } });
  const translateY = interpolate(enter, [0, 1], [18, 0]);

  const upperText = upperTokens.map((t) => cleanToken(t.text)).join(" ");
  const lowerText = lowerTokens.map((t) => cleanToken(t.text)).join(" ");
  const upperSize = Math.min(84, Math.max(52, fit(upperText || "A", 1100, fonts.heading.family, 800)));
  const lowerSize = Math.min(108, Math.max(60, fit(lowerText || "A", 950, fonts.heading.family, 800)));

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      {/* Upper Paper Cell (0px radius, edge-to-edge inside grid) */}
      <div
        style={{
          position: "absolute",
          top: GRID.top + 1,
          left: GRID.left + 1,
          right: GRID.right + 1,
          height: 834,
          backgroundColor: colors.bgLight,
          borderBottom: `1px solid ${colors.ruleLight}`,
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${colors.ruleLight}`,
            paddingBottom: 20,
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono.family,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: colors.accent,
            }}
          >
            TESIS DE ARQUITECTURA
          </span>
          <span
            style={{
              fontFamily: fonts.mono.family,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.1em",
              color: colors.textSecondary,
            }}
          >
            {String(scene.id).padStart(2, "0")}
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px 18px",
              transform: `translateY(${translateY}px)`,
            }}
          >
            {upperTokens.map((tok, i) => {
              const emph = isEmphasized(tok.text, scene.emphasis);
              const active = nowMs >= tok.fromMs;
              return (
                <span
                  key={`${tok.fromMs}-${i}`}
                  style={{
                    fontFamily: fonts.heading.family,
                    fontWeight: 800,
                    fontSize: upperSize,
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                    color: emph && active ? colors.accent : colors.textPrimary,
                    opacity: active ? 1 : 0.28,
                  }}
                >
                  {cleanToken(tok.text)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lower Dark Cell (0px radius, edge-to-edge inside grid) */}
      <div
        style={{
          position: "absolute",
          top: GRID.top + 835,
          left: GRID.left + 1,
          right: GRID.right + 1,
          bottom: GRID.bottom + 1,
          backgroundColor: colors.bgDark,
          padding: "48px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px 20px",
              transform: `translateY(${translateY}px)`,
            }}
          >
            {lowerTokens.map((tok, i) => {
              const emph = isEmphasized(tok.text, scene.emphasis);
              const active = nowMs >= tok.fromMs;
              return (
                <span
                  key={`${tok.fromMs}-${i}`}
                  style={{
                    fontFamily: fonts.heading.family,
                    fontWeight: 800,
                    fontSize: lowerSize,
                    lineHeight: 1.05,
                    letterSpacing: "-0.03em",
                    color: emph && active ? colors.accentLight : colors.textWhite,
                    opacity: active ? 1 : 0.32,
                  }}
                >
                  {cleanToken(tok.text)}
                </span>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${colors.ruleDark}`,
            paddingTop: 20,
          }}
        >
          <span
            style={{
              fontFamily: fonts.mono.family,
              fontSize: 17,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: colors.textMuted,
            }}
          >
            CRITERIO EJECUTIVO
          </span>
          <span
            style={{
              width: 28,
              height: 2,
              backgroundColor: colors.accent,
              display: "inline-block",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{
  scene: InfoScene;
  camera: string | null;
  pages: PhrasePage[];
  allWords: WordToken[];
  brand: BrandConfig;
  hook?: InfoHook;
}> = ({ scene, camera, pages, allWords, brand, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { colors } = brand;
  const startFrame = Math.round((scene.startMs / 1000) * fps);
  const sceneDurFrames = Math.max(1, Math.round(((scene.endMs - scene.startMs) / 1000) * fps));
  const zoom = interpolate(frame, [0, sceneDurFrames], [1.01, 1.045], { extrapolateRight: "clamp" });
  const nowMs = scene.startMs + (frame / fps) * 1000;
  const showHook = Boolean(hook && nowMs >= hook.startMs && nowMs < hook.endMs);

  if (scene.mode === "kinetic" || (!camera && scene.mode === "camera")) {
    return <KineticFullCard allWords={allWords} scene={scene} brand={brand} />;
  }

  if (scene.mode === "hyperframes" && scene.animationId) {
    const isSplit = scene.hyperframesLayout === "split" && Boolean(camera);
    return (
      <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
        <OffthreadVideo
          src={staticFile(`hyperframes/${scene.animationId}.mp4`)}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {isSplit && camera ? (
          <div
            style={{
              position: "absolute",
              top: GRID.top + 1,
              left: GRID.left + 1,
              right: GRID.right + 1,
              height: GRID.splitY - GRID.top - 1,
              overflow: "hidden",
              borderBottom: `1px solid ${colors.ruleDark}`,
              backgroundColor: colors.bgDark2,
              zIndex: 4,
            }}
          >
            <OffthreadVideo
              src={staticFile(camera)}
              startFrom={startFrame}
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 54%",
                transform: `scale(${zoom})`,
              }}
            />
          </div>
        ) : null}

        <LowerCaptionBand pages={pages} scene={scene} brand={brand} dockedBar />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDark }}>
      <div
        style={{
          position: "absolute",
          top: GRID.top + 1,
          left: GRID.left + 1,
          right: GRID.right + 1,
          bottom: GRID.bottom + 1,
          overflow: "hidden",
          backgroundColor: colors.bgDark2,
        }}
      >
        {camera ? (
          <OffthreadVideo
            src={staticFile(camera)}
            startFrom={startFrame}
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "50% 34%",
              transform: `scale(${zoom})`,
            }}
          />
        ) : null}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(180deg, rgba(5,8,22,0.18) 0%, rgba(5,8,22,0.0) 28%, rgba(5,8,22,0.08) 60%, rgba(5,8,22,0.86) 86%, rgba(5,8,22,0.95) 100%)",
          }}
        />
      </div>
      {showHook && hook ? <HookBanner hook={hook} brand={brand} /> : null}
      <LowerCaptionBand pages={pages} scene={scene} brand={brand} />
    </AbsoluteFill>
  );
};

type SfxEvent = {
  file: string;
  atMs: number;
  volume: number;
};

const ANIMATION_SFX_PRESETS: Record<string, SfxCueSpec[]> = {
  "orphan-tools": [
    { file: "whoosh-short.mp3", offsetMs: 0, volume: 0.25 },
    { file: "click-soft.mp3", offsetMs: 120, volume: 0.24 },
    { file: "click-soft.mp3", offsetMs: 1350, volume: 0.24 },
    { file: "ping.mp3", offsetMs: 2650, volume: 0.26 },
  ],
  "question-1-process": [
    { file: "whoosh.mp3", offsetMs: 0, volume: 0.26 },
    { file: "whoosh-short.mp3", offsetMs: 1750, volume: 0.24 },
    { file: "ping.mp3", offsetMs: 1950, volume: 0.28 },
  ],
  "question-2-variance": [
    { file: "click-soft.mp3", offsetMs: 0, volume: 0.24 },
    { file: "whoosh-short.mp3", offsetMs: 950, volume: 0.24 },
    { file: "click.mp3", offsetMs: 1120, volume: 0.25 },
  ],
  "question-3-hours": [
    { file: "whoosh.mp3", offsetMs: 0, volume: 0.26 },
    { file: "click-soft.mp3", offsetMs: 600, volume: 0.18 },
    { file: "click-soft.mp3", offsetMs: 780, volume: 0.2 },
    { file: "click-soft.mp3", offsetMs: 960, volume: 0.22 },
    { file: "ping.mp3", offsetMs: 1150, volume: 0.28 },
  ],
  "skyscraper-analogy": [
    { file: "whoosh.mp3", offsetMs: 0, volume: 0.26 },
    { file: "whoosh-short.mp3", offsetMs: 1150, volume: 0.25 },
    { file: "click-soft.mp3", offsetMs: 1500, volume: 0.2 },
    { file: "click-soft.mp3", offsetMs: 1700, volume: 0.22 },
    { file: "click.mp3", offsetMs: 1900, volume: 0.25 },
  ],
  "three-pillars": [
    { file: "whoosh-short.mp3", offsetMs: 0, volume: 0.22 },
    { file: "click-soft.mp3", offsetMs: 250, volume: 0.24 },
    { file: "click-soft.mp3", offsetMs: 1050, volume: 0.24 },
    { file: "ping.mp3", offsetMs: 1850, volume: 0.26 },
  ],
  "kivra-dupla-1": [
    { file: "whoosh-short.mp3", offsetMs: 0, volume: 0.22 },
    { file: "click-soft.mp3", offsetMs: 350, volume: 0.22 },
    { file: "click-soft.mp3", offsetMs: 1000, volume: 0.22 },
    { file: "click.mp3", offsetMs: 1650, volume: 0.25 },
  ],
  "kivra-dupla-2": [
    { file: "click-soft.mp3", offsetMs: 0, volume: 0.22 },
    { file: "whoosh-short.mp3", offsetMs: 400, volume: 0.25 },
    { file: "ping.mp3", offsetMs: 1500, volume: 0.26 },
  ],
  "roi-proof": [
    { file: "whoosh.mp3", offsetMs: 0, volume: 0.26 },
    { file: "ping.mp3", offsetMs: 700, volume: 0.24 },
    { file: "whoosh-short.mp3", offsetMs: 1350, volume: 0.25 },
    { file: "chime.mp3", offsetMs: 1600, volume: 0.28 },
  ],
};

const buildSfxEvents = (scenes: InfoScene[], allWords: WordToken[], brand: BrandConfig, hook?: InfoHook): SfxEvent[] => {
  if (!brand.audio.sfxEnabled) {
    return [];
  }
  const scale = brand.audio.sfxVolumeScale ?? 1.0;
  const events: SfxEvent[] = [];

  if (hook) {
    events.push({ file: "whoosh-short.mp3", atMs: hook.startMs + 30, volume: 0.26 * scale });
    events.push({ file: "click-soft.mp3", atMs: hook.startMs + 150, volume: 0.22 * scale });
  }

  const brandNorm = normalizeToken(brand.brandName);

  for (const scene of scenes) {
    if (scene.sfx && scene.sfx.length > 0) {
      for (const c of scene.sfx) {
        events.push({ file: c.file, atMs: scene.startMs + c.offsetMs, volume: (c.volume ?? 0.25) * scale });
      }
      continue;
    }

    if (scene.mode === "hyperframes" && scene.animationId) {
      const preset = ANIMATION_SFX_PRESETS[scene.animationId] ?? [
        { file: "whoosh-short.mp3", offsetMs: 0, volume: 0.24 },
      ];
      for (const c of preset) {
        events.push({ file: c.file, atMs: scene.startMs + c.offsetMs, volume: (c.volume ?? 0.25) * scale });
      }
      continue;
    }

    const sceneTokens = allWords.filter((w) => w.toMs > scene.startMs && w.fromMs < scene.endMs);

    if (scene.mode === "kinetic") {
      events.push({ file: "whoosh-short.mp3", atMs: scene.startMs, volume: 0.25 * scale });
      events.push({ file: "impact-bass-1.mp3", atMs: scene.startMs, volume: 0.25 * scale });
      const [, lowerTokens] = splitSceneGrammatically(sceneTokens);
      const lowerOnset = lowerTokens[0]?.fromMs;
      if (lowerOnset && lowerOnset > scene.startMs + 120) {
        if (scene.id === 10) {
          events.push({ file: "impact-bass-1.mp3", atMs: lowerOnset, volume: 0.28 * scale });
          events.push({ file: "click.mp3", atMs: lowerOnset, volume: 0.22 * scale });
        } else if (scene.id === 12) {
          events.push({ file: "chime.mp3", atMs: lowerOnset, volume: 0.24 * scale });
        } else {
          events.push({ file: "click.mp3", atMs: lowerOnset, volume: 0.24 * scale });
        }
      }
      continue;
    }

    const firstEmph = sceneTokens.find((w) => isEmphasized(w.text, scene.emphasis));
    if (firstEmph) {
      const norm = normalizeToken(firstEmph.text);
      if (brandNorm && norm === brandNorm) {
        events.push({ file: "chime.mp3", atMs: firstEmph.fromMs, volume: 0.24 * scale });
      } else {
        events.push({ file: "click-soft.mp3", atMs: firstEmph.fromMs, volume: 0.17 * scale });
      }
    }
    if (scene.id === scenes[scenes.length - 1]?.id) {
      const lastEmph = [...sceneTokens].reverse().find((w) => isEmphasized(w.text, scene.emphasis));
      if (lastEmph && lastEmph !== firstEmph) {
        events.push({ file: "impact-bass-1.mp3", atMs: lastEmph.fromMs, volume: 0.24 * scale });
      }
    }
  }

  return events;
};

const loadJson = async <T,>(file: string): Promise<T> => {
  const res = await fetch(staticFile(file));
  if (!res.ok) {
    throw new Error(`Could not load ${file}: ${res.status}`);
  }
  return res.json() as Promise<T>;
};

const loadOptionalJson = async <T,>(file: string): Promise<T | null> => {
  try {
    const res = await fetch(staticFile(file));
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  }
};

export const calculateShortInfoMetadata: CalculateMetadataFunction<ShortInfoProps> = async ({ props }) => {
  const [captions, { scenes, look }, brandOverride] = await Promise.all([
    loadJson<Caption[]>("captions.json"),
    loadJson<{ scenes: InfoScene[]; look?: InfoLook }>("scenes.json"),
    loadOptionalJson<Partial<BrandConfig>>("brand.config.json"),
  ]);

  const endMs = scenes[scenes.length - 1]?.endMs ?? 1000;
  return {
    durationInFrames: Math.ceil((endMs / 1000) * FPS),
    props: {
      ...props,
      captions,
      scenes,
      look: look ?? props.look,
      brand: mergeBrandConfig(brandOverride ?? props.brand),
    },
  };
};

export const ShortInfo: React.FC<ShortInfoProps> = ({
  music,
  audio,
  camera,
  captions,
  scenes,
  look,
  brand = DEFAULT_BRAND_CONFIG,
}) => {
  const resolvedBrand = useMemo(() => mergeBrandConfig(brand), [brand]);
  useBrandFonts(resolvedBrand);
  const { fps, durationInFrames: totalFrames } = useVideoConfig();
  const pages = useMemo(() => buildPhrasePages(captions, scenes), [captions, scenes]);
  const allWords = useMemo(() => extractWords(captions), [captions]);
  const sfxEvents = useMemo(
    () => buildSfxEvents(scenes, allWords, resolvedBrand, look?.hook),
    [scenes, allWords, resolvedBrand, look?.hook],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: resolvedBrand.colors.bgDark }}>
      {scenes.map((scene) => {
        const from = Math.round((scene.startMs / 1000) * fps);
        const to = Math.round((scene.endMs / 1000) * fps);
        const durationInFrames = Math.max(1, to - from);

        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
            <SceneView
              scene={scene}
              camera={camera}
              pages={pages}
              allWords={allWords}
              brand={resolvedBrand}
              hook={look?.hook}
            />
          </Sequence>
        );
      })}
      <BrandChrome brand={resolvedBrand} />
      <Audio src={staticFile(audio)} />
      {music ? <Audio src={staticFile(`music/${music}`)} volume={resolvedBrand.audio.musicVolume} loop /> : null}
      {sfxEvents.map((ev, idx) => {
        const from = Math.max(0, Math.round((ev.atMs / 1000) * fps));
        if (from >= totalFrames) {
          return null;
        }
        const dur = Math.min(90, totalFrames - from);
        return (
          <Sequence key={`sfx-${idx}-${from}-${ev.file}`} from={from} durationInFrames={dur}>
            <Audio src={staticFile(`sfx/${ev.file}`)} volume={ev.volume} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
