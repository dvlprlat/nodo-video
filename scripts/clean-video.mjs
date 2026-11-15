import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ensureWorkDir, fail, getDurationSec, getSlug, run, slugPaths } from "./lib.mjs";

const TARGET_LUFS = -14;
const TARGET_TRUE_PEAK = -1.5;
const TARGET_LRA = 11;
const option = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const MAX_SILENCE_SEC = Number(option("max-silence") ?? 0.4);
const KEPT_PAUSE_SEC = Number(option("kept-pause") ?? 0.15);
const MAX_DURATION_SEC = 60;
const LIMITER_MARGIN_DB = 1;
const ADJACENT_SILENCE_SEC = 0.05;
const SILENCE_BELOW_LOUDNESS_DB = 25;

const RATE = 48000;
const FRAME = 480; // 10 ms
const BREATH_BELOW_LOUDNESS_DB = Number(option("breath-below-db") ?? 8);
const TEMPO = Number(option("tempo") ?? 1);
const BREATH_DUCK_DB = -20;
const MIN_BREATH_FRAMES = 30;
const MIN_SPEECH_FRAMES = 5;
const EDGE_GUARD_FRAMES = 3;
const RAMP_SAMPLES = 960; // 20 ms
const HEAD_KEEP_FRAMES = 5;
const TAIL_KEEP_FRAMES = 20;

const HIGHPASS_HZ = 80;
const COMPRESS_BELOW_LOUDNESS_DB = 4;
const COMPRESS_RATIO = 3;

const analyzeLoudness = async (file) => {
  const filter = `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA}:print_format=json`;
  const { stderr } = await run("ffmpeg", ["-nostdin", "-hide_banner", "-i", file, "-af", filter, "-f", "null", "-"]);
  return JSON.parse(stderr.slice(stderr.lastIndexOf("{"), stderr.lastIndexOf("}") + 1));
};

const parseSilences = (log, totalSec) => {
  const starts = [...log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  const merged = [];
  starts.forEach((start, i) => {
    const previous = merged[merged.length - 1];
    if (previous && start - previous.end < ADJACENT_SILENCE_SEC) {
      previous.end = ends[i] ?? totalSec;
    } else {
      merged.push({ start, end: ends[i] ?? totalSec });
    }
  });
  return merged;
};

const getKeptSegments = (silences, totalSec) => {
  const margin = KEPT_PAUSE_SEC / 2;
  const segments = [];
  let cursor = 0;
  for (const { start, end } of silences) {
    segments.push([cursor, Math.min(start + margin, totalSec)]);
    cursor = Math.max(end - margin, 0);
  }
  segments.push([cursor, totalSec]);
  return segments.filter(([from, to]) => to - from > 0.04);
};

const editBreaths = async (input, output) => {
  const { input_i: lufs } = await analyzeLoudness(input);
  const rawFile = `${output}.f32`;
  await run("ffmpeg", ["-nostdin", "-y", "-hide_banner", "-i", input, "-f", "f32le", "-ac", "1", "-ar", String(RATE), rawFile]);
  const bytes = readFileSync(rawFile);
  const samples = new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));

  const quietDb = Number(lufs) - BREATH_BELOW_LOUDNESS_DB;
  const frameCount = Math.floor(samples.length / FRAME);
  const isQuiet = Array.from({ length: frameCount }, (_, f) => {
    let energy = 0;
    for (let i = f * FRAME; i < (f + 1) * FRAME; i++) {
      energy += samples[i] ** 2;
    }
    return 10 * Math.log10(energy / FRAME + 1e-12) < quietDb;
  });

  const runs = [];
  for (let f = 0; f < frameCount; f++) {
    if (!runs.length || runs[runs.length - 1].quiet !== isQuiet[f]) {
      runs.push({ quiet: isQuiet[f], from: f, to: f + 1 });
    }
    runs[runs.length - 1].to = f + 1;
  }
  const speech = runs.filter((r) => !r.quiet && r.to - r.from >= MIN_SPEECH_FRAMES);
  const firstFrame = Math.max(0, speech[0].from - HEAD_KEEP_FRAMES);
  const lastFrame = Math.min(frameCount, speech[speech.length - 1].to + TAIL_KEEP_FRAMES);

  const gaps = runs.filter(
    (r) => r.quiet && r.from >= speech[0].to && r.to <= speech[speech.length - 1].from && r.to - r.from >= MIN_BREATH_FRAMES,
  );
  const gain = 10 ** (BREATH_DUCK_DB / 20);
  for (const gap of gaps) {
    const from = (gap.from + EDGE_GUARD_FRAMES) * FRAME;
    const to = (gap.to - EDGE_GUARD_FRAMES) * FRAME;
    for (let i = from; i < to; i++) {
      const edge = Math.min(i - from, to - i) / RAMP_SAMPLES;
      samples[i] *= 1 - (1 - gain) * Math.min(1, edge);
    }
  }

  const kept = samples.subarray(firstFrame * FRAME, lastFrame * FRAME);
  writeFileSync(rawFile, Buffer.from(kept.buffer, kept.byteOffset, kept.byteLength));
  await run("ffmpeg", ["-nostdin", "-y", "-hide_banner", "-f", "f32le", "-ar", String(RATE), "-ac", "1", "-i", rawFile, output]);
  rmSync(rawFile);

  return {
    headTrimSec: (firstFrame * FRAME) / RATE,
    tailTrimSec: ((frameCount - lastFrame) * FRAME) / RATE,
    keptDurationSec: ((lastFrame - firstFrame) * FRAME) / RATE,
    breaths: gaps.map((g) => ({
      fromSec: ((g.from - firstFrame) * FRAME) / RATE,
      toSec: ((g.to - firstFrame) * FRAME) / RATE,
    })),
  };
};

const slug = getSlug();
const paths = slugPaths(slug);
const { cleanVoice, work } = paths;
const rawVideo = option("input")
  ? path.join(paths.input, option("input"))
  : path.join(paths.input, "camera.mp4");
if (!existsSync(rawVideo)) {
  fail(`missing ${path.relative(process.cwd(), rawVideo)}`);
}
ensureWorkDir(slug);

const flag = process.argv.find((a) => a.startsWith("--threshold-db="));
const measured = await analyzeLoudness(rawVideo);
const thresholdDb = flag
  ? Number(flag.split("=")[1])
  : Number(measured.input_i) - SILENCE_BELOW_LOUDNESS_DB;

const totalSec = await getDurationSec(rawVideo);
const { stderr: detection } = await run("ffmpeg", [
  "-nostdin", "-hide_banner", "-i", rawVideo,
  "-af", `silencedetect=n=${thresholdDb}dB:d=${MAX_SILENCE_SEC}`,
  "-f", "null", "-",
]);

// Optional cold-open hook segment (--cold-open=start-end in seconds of rawVideo)
const coldOpenOpt = option("cold-open");
const coldOpenSeg = coldOpenOpt
  ? [coldOpenOpt.split("-").map(Number)]
  : [];

const baseSegments = getKeptSegments(parseSilences(detection, totalSec), totalSec);
const segments = [...coldOpenSeg, ...baseSegments];

const audioCuts = segments
  .map(([from, to], i) => `[0:a]atrim=start=${from.toFixed(3)}:end=${to.toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`)
  .join(";");
const audioInputs = segments.map((_, i) => `[a${i}]`).join("");
const audioGraph = `${audioCuts};${audioInputs}concat=n=${segments.length}:v=0:a=1[aout]`;

const trimmedAudio = path.join(work, "voice.trimmed.wav");
await run("ffmpeg", [
  "-nostdin", "-y", "-hide_banner", "-i", rawVideo,
  "-filter_complex", audioGraph, "-map", "[aout]", "-ac", "1", "-ar", String(RATE),
  trimmedAudio,
]);

const editedAudio = path.join(work, "voice.edited.wav");
const edit = await editBreaths(trimmedAudio, editedAudio);
writeFileSync(
  path.join(work, "audio-edit.json"),
  JSON.stringify({ ...edit, tempo: TEMPO, segments, coldOpen: coldOpenOpt ?? null }, null, 2),
);

const { input_i: editedLufs } = await analyzeLoudness(editedAudio);
const shapedAudio = path.join(work, "voice.shaped.wav");
const voiceChain = [
  `highpass=f=${HIGHPASS_HZ}`,
  "deesser=i=0.4",
  `acompressor=threshold=${Number(editedLufs) - COMPRESS_BELOW_LOUDNESS_DB}dB:ratio=${COMPRESS_RATIO}:attack=8:release=120`,
  ...(TEMPO !== 1 ? [`atempo=${TEMPO}`] : []),
].join(",");
await run("ffmpeg", ["-nostdin", "-y", "-hide_banner", "-i", editedAudio, "-af", voiceChain, shapedAudio]);

const { input_i: shapedLufs } = await analyzeLoudness(shapedAudio);
const gainDb = TARGET_LUFS - Number(shapedLufs);
const limitDb = Math.min(0, TARGET_TRUE_PEAK - gainDb - LIMITER_MARGIN_DB);
const limitedAudio = path.join(work, "voice.limited.wav");
await run("ffmpeg", [
  "-nostdin", "-y", "-hide_banner", "-i", shapedAudio,
  "-af", `alimiter=limit=${10 ** (limitDb / 20)}:level=disabled`,
  limitedAudio,
]);

const m = await analyzeLoudness(limitedAudio);
const normalize =
  `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA}` +
  `:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
  `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
await run("ffmpeg", [
  "-nostdin", "-y", "-hide_banner", "-i", limitedAudio,
  "-af", normalize, "-ar", "48000", "-c:a", "pcm_s16le",
  cleanVoice,
]);

for (const file of [trimmedAudio, editedAudio, shapedAudio, limitedAudio]) {
  rmSync(file);
}

// Now cut and scale the video stream using the exact same segments and head/tail trim
const videoCuts = segments
  .map(([from, to], i) => `[0:v]trim=start=${from.toFixed(3)}:end=${to.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`)
  .join(";");
const videoInputs = segments.map((_, i) => `[v${i}]`).join("");
const headStart = edit.headTrimSec.toFixed(3);
const headEnd = (edit.headTrimSec + edit.keptDurationSec).toFixed(3);
const ptsExpr = TEMPO !== 1 ? `(PTS-STARTPTS)/${TEMPO}` : "PTS-STARTPTS";
const videoGraph =
  `${videoCuts};${videoInputs}concat=n=${segments.length}:v=1:a=0[vcat];` +
  `[vcat]trim=start=${headStart}:end=${headEnd},setpts=${ptsExpr},fps=30,` +
  `scale=1080:1920:flags=lanczos:force_original_aspect_ratio=increase,crop=1080:1920,unsharp=3:3:0.45:3:3:0.0[vout]`;

const cleanVideo = path.join(work, "camera.clean.mp4");
await run("ffmpeg", [
  "-nostdin", "-y", "-hide_banner",
  "-i", rawVideo,
  "-i", cleanVoice,
  "-filter_complex", videoGraph,
  "-map", "[vout]", "-map", "1:a",
  "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "192k",
  "-shortest",
  cleanVideo,
]);

const after = await getDurationSec(cleanVoice);
const final = await analyzeLoudness(cleanVoice);

console.log(`Duration: ${totalSec.toFixed(2)} s -> ${after.toFixed(2)} s (${segments.length} segments)`);
console.log(`Loudness: ${Number(measured.input_i).toFixed(1)} -> ${Number(final.input_i).toFixed(1)} LUFS`);
console.log(`Loudness range: ${Number(measured.input_lra).toFixed(1)} -> ${Number(final.input_lra).toFixed(1)} LU`);
console.log(`Silence threshold: ${thresholdDb.toFixed(1)} dB`);
console.log(`Head trimmed: ${edit.headTrimSec.toFixed(2)} s. Breaths ducked: ${edit.breaths.length}`);
console.log(`Clean camera video: ${path.relative(process.cwd(), cleanVideo)}`);

if (after > MAX_DURATION_SEC) {
  console.error(`OVER LIMIT: ${after.toFixed(2)} s is longer than ${MAX_DURATION_SEC} s`);
  process.exit(3);
}
