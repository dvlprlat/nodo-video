import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./lib.mjs";

const FONT_PRESETS = {
  manrope: { family: "Manrope", file: "Manrope-Variable.ttf", weight: "100 900", style: "sans-serif" },
  montserrat: { family: "Montserrat", file: "Montserrat-Black.ttf", weight: "900", style: "sans-serif" },
  playfair: { family: "Playfair Display", file: "PlayfairDisplay-Italic.ttf", weight: "400", style: "serif" },
  ibmplexmono: { family: "IBM Plex Mono", file: "IBMPlexMono-SemiBold.ttf", weight: "600" },
};

const parseFlags = () => {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([\w-]+)=(.*)$/);
    if (m) {
      out[m[1]] = m[2];
    }
  }
  return out;
};

const flags = parseFlags();
const configPath = path.join(ROOT, "brand.config.json");
const examplePath = path.join(ROOT, "brand.config.example.json");

if (!existsSync(configPath)) {
  copyFileSync(examplePath, configPath);
  console.log("Created brand.config.json from brand.config.example.json");
}

const current = JSON.parse(readFileSync(configPath, "utf8"));

if (flags.preset) {
  const presetFile = path.join(ROOT, "examples", `${flags.preset}.brand.json`);
  if (existsSync(presetFile)) {
    copyFileSync(presetFile, configPath);
    console.log(`Loaded preset examples/${flags.preset}.brand.json -> brand.config.json`);
  }
}

const updated = JSON.parse(readFileSync(configPath, "utf8"));
if (flags.brand) updated.brandName = flags.brand;
if (flags.domain) updated.domain = flags.domain;
if (flags["header-left"]) updated.headerLeft = flags["header-left"];
if (flags["header-right"]) updated.headerRight = flags["header-right"];
if (flags["footer-left"]) updated.footerLeft = flags["footer-left"];
if (flags.lang) updated.language = flags.lang;
if (flags.accent) updated.colors.accent = flags.accent;
if (flags["accent-light"]) updated.colors.accentLight = flags["accent-light"];
if (flags["bg-dark"]) updated.colors.bgDark = flags["bg-dark"];
if (flags["bg-light"]) updated.colors.bgLight = flags["bg-light"];
if (flags["heading-font"]) {
  const key = flags["heading-font"].toLowerCase().replace(/[^a-z0-9]/g, "");
  if (FONT_PRESETS[key]) {
    updated.fonts.heading = FONT_PRESETS[key];
  } else {
    updated.fonts.heading.family = flags["heading-font"];
    if (flags["heading-file"]) updated.fonts.heading.file = flags["heading-file"];
  }
}

writeFileSync(configPath, `${JSON.stringify(updated, null, 2)}\n`);
console.log(`Saved brand.config.json (${updated.brandName} · ${updated.domain})`);

// Ensure bundled SFX exist in assets/sfx/
const sfxDir = path.join(ROOT, "assets", "sfx");
mkdirSync(sfxDir, { recursive: true });
const bundledSfx = path.join(ROOT, "node_modules", "hyperframes", "dist", "skills", "media-use", "audio", "assets", "sfx");
if (existsSync(bundledSfx) && readdirSync(sfxDir).filter((f) => f.endsWith(".mp3")).length === 0) {
  cpSync(bundledSfx, sfxDir, { recursive: true });
  console.log("Restored bundled HyperFrames SFX into assets/sfx/");
}

// Generate default ambient background music bed if assets/music/ has no track yet
const musicDir = path.join(ROOT, "assets", "music");
mkdirSync(musicDir, { recursive: true });
const hasMusic = readdirSync(musicDir).some((f) => /\.(mp3|m4a|wav|aac|ogg)$/i.test(f));
if (!hasMusic) {
  const bedPath = path.join(musicDir, "informative-bed.wav");
  console.log("Generating ambient background music bed (assets/music/informative-bed.wav)...");
  spawnSync(
    "ffmpeg",
    [
      "-nostdin",
      "-y",
      "-f",
      "lavfi",
      "-i",
      "aevalsrc=0.12*sin(2*PI*110*t)+0.08*sin(2*PI*164.81*t)+0.06*sin(2*PI*220*t)+0.04*sin(2*PI*277.18*t):s=48000:d=90",
      "-af",
      "lowpass=f=420,afade=t=in:st=0:d=2,afade=t=out:st=87:d=3",
      bedPath,
    ],
    { stdio: "ignore" },
  );
}

// Run check-env to report status
const check = spawnSync("node", [path.join(ROOT, "scripts", "check-env.mjs")], { stdio: "inherit" });
process.exit(check.status ?? 0);
