import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { loadBrandConfig, ROOT } from "./lib.mjs";
import { getModelPath } from "./model-path.mjs";
import { WHISPER_PATH, WHISPER_VERSION } from "./whisper-config.mjs";

let ok = true;
const check = (label, pass, hint = "") => {
  const tag = pass ? "OK  " : "FAIL";
  console.log(`[${tag}] ${label}${!pass && hint ? ` -> ${hint}` : ""}`);
  if (!pass) ok = false;
};

const major = Number(process.versions.node.split(".")[0]);
check(`Node ${process.versions.node}`, major >= 20, "use Node 20.19+, 22.13+ or >= 24");

const ff = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
check("ffmpeg installed", ff.status === 0, "sudo apt install ffmpeg");
if (ff.status === 0) {
  for (const f of ["silencedetect", "aselect", "loudnorm", "blackdetect"]) {
    check(`ffmpeg filter: ${f}`, Boolean(ff.stdout?.includes(f)));
  }
}

const brand = loadBrandConfig();
check(
  `brand.config.json (${brand.brandName} · ${brand.domain})`,
  existsSync(path.join(ROOT, "brand.config.json")),
  "run /setup in your Agent CLI or `npm run init` to configure your brand",
);

for (const spec of [brand.fonts?.heading, brand.fonts?.mono].filter(Boolean)) {
  const fontPath = path.join(ROOT, "assets", "fonts", spec.file);
  check(
    `font (${spec.family}: ${spec.file})`,
    existsSync(fontPath),
    `place ${spec.file} in assets/fonts/ or run npm run init`,
  );
}

const sfxDir = path.join(ROOT, "assets", "sfx");
const sfxCount = existsSync(sfxDir) ? readdirSync(sfxDir).filter((f) => f.endsWith(".mp3")).length : 0;
check(`bundled SFX (${sfxCount} files)`, sfxCount >= 10, "run npm run init to restore assets/sfx/");

const hyperframesBin = path.join(ROOT, "node_modules", ".bin", "hyperframes");
check("HyperFrames CLI", existsSync(hyperframesBin), "npm install");

check(`whisper.cpp (${WHISPER_VERSION})`, existsSync(path.join(WHISPER_PATH, "main")), "npm run setup-whisper");
check("whisper model (large-v3-turbo)", existsSync(getModelPath()), "npm run setup-whisper");

process.exit(ok ? 0 : 1);
