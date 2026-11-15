import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import path from "node:path";

export const ROOT = process.cwd();

export const fail = (message) => {
  console.error(`ERROR: ${message}`);
  process.exit(1);
};

export const getSlug = () => {
  const slug = process.argv[2];
  if (!slug || slug.startsWith("-") || !/^[\w-]+$/.test(slug)) {
    fail("usage: node scripts/<script>.mjs <slug>");
  }
  return slug;
};

export const loadBrandConfig = () => {
  const configPath = path.join(ROOT, "brand.config.json");
  const examplePath = path.join(ROOT, "brand.config.example.json");
  const target = existsSync(configPath) ? configPath : examplePath;
  return JSON.parse(readFileSync(target, "utf8"));
};

export const slugPaths = (slug) => ({
  rawVoice: path.join(ROOT, "input", slug, "voice.wav"),
  input: path.join(ROOT, "input", slug),
  notes: path.join(ROOT, "input", slug, "notes.md"),
  work: path.join(ROOT, "work", slug),
  cleanVoice: path.join(ROOT, "work", slug, "voice.clean.wav"),
  cleanCamera: path.join(ROOT, "work", slug, "camera.clean.mp4"),
  captions: path.join(ROOT, "work", slug, "captions.json"),
  transcript: path.join(ROOT, "work", slug, "transcript.txt"),
  lowConfidence: path.join(ROOT, "work", slug, "low-confidence.json"),
  scenes: path.join(ROOT, "work", slug, "scenes.json"),
});

// work/<slug> doubles as Remotion's --public-dir, so each render sees its own
// files plus the shared fonts, music, sfx and active brand.config.json.
export const ensureWorkDir = (slug) => {
  const { work } = slugPaths(slug);
  mkdirSync(work, { recursive: true });
  for (const name of ["fonts", "music", "sfx"]) {
    const link = path.join(work, name);
    if (!existsSync(link)) {
      symlinkSync(path.join("..", "..", "assets", name), link);
    }
  }
  const brandSrc = existsSync(path.join(ROOT, "brand.config.json"))
    ? path.join(ROOT, "brand.config.json")
    : path.join(ROOT, "brand.config.example.json");
  if (existsSync(brandSrc)) {
    copyFileSync(brandSrc, path.join(work, "brand.config.json"));
  }
};

export const run = (bin, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${bin} exited with ${code}:\n${stderr.slice(-2000)}`));
      }
    });
  });

export const getDurationSec = async (file) => {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  return Number(stdout.trim());
};

export const alignToDtw = (captions, lastWordMs = 400) => {
  const starts = [];
  captions.forEach((c, i) => {
    const onset = c.timestampMs ?? c.startMs;
    starts.push(Math.max(onset, starts[i - 1] ?? 0));
  });
  return captions.map((c, i) => ({
    ...c,
    startMs: starts[i],
    endMs: starts[i + 1] ?? starts[i] + lastWordMs,
  }));
};
