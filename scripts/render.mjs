import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { ensureWorkDir, fail, getDurationSec, getSlug, loadBrandConfig, ROOT, slugPaths } from "./lib.mjs";

const AUDIO_EXTENSIONS = /\.(mp3|m4a|wav|aac|ogg)$/i;

const slug = getSlug();
const paths = slugPaths(slug);

for (const file of [paths.cleanVoice, paths.captions, paths.scenes]) {
  if (!existsSync(file)) {
    fail(`missing ${path.relative(ROOT, file)}`);
  }
}
ensureWorkDir(slug);

const brand = loadBrandConfig();
const musicDir = path.join(ROOT, "assets", "music");
const music = existsSync(musicDir)
  ? (readdirSync(musicDir).find((f) => AUDIO_EXTENSIONS.test(f)) ?? null)
  : null;
const camera = existsSync(paths.cleanCamera) ? "camera.clean.mp4" : null;
const output = path.join(ROOT, "out", `${slug}.mp4`);
mkdirSync(path.dirname(output), { recursive: true });

const initialProps = {
  music,
  audio: "voice.clean.wav",
  camera,
  captions: [],
  scenes: [],
  brand,
};

const started = Date.now();
const { status } = spawnSync(
  "npx",
  [
    "remotion",
    "render",
    "ShortInfo",
    output,
    `--public-dir=${paths.work}`,
    `--props=${JSON.stringify(initialProps)}`,
    "--codec=h264",
    "--audio-codec=aac",
    ...process.argv.slice(3),
  ],
  { stdio: "inherit" },
);
if (status !== 0) {
  fail(`render exited with ${status}`);
}

const seconds = Math.round((Date.now() - started) / 1000);
console.log(
  `Rendered ${path.relative(ROOT, output)} (brand: ${brand.brandName}, domain: ${brand.domain}): ${(await getDurationSec(output)).toFixed(2)} s in ${seconds} s (music: ${music ?? "none"}, sfx: ${brand.audio?.sfxEnabled !== false ? "on" : "off"})`,
);
