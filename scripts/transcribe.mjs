import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fail, getSlug, slugPaths } from "./lib.mjs";
import { transcribeWords } from "./whisper.mjs";

const LOW_CONFIDENCE = 0.6;
// Style hint only: it nudges whisper toward punctuation and sentence case.
const PUNCTUATION_PROMPT = "Hola, ¿cómo estás? Este es un texto en español, con puntuación y mayúsculas.";

const slug = getSlug();
const { cleanVoice, captions: captionsPath, transcript, lowConfidence } = slugPaths(slug);
if (!existsSync(cleanVoice)) {
  fail(`missing ${path.relative(process.cwd(), cleanVoice)}: run clean-audio first`);
}

const aligned = await transcribeWords(cleanVoice, PUNCTUATION_PROMPT);

const text = aligned.map((c) => c.text).join("").trim();
const doubtful = aligned.filter((c) => c.confidence < LOW_CONFIDENCE);

writeFileSync(captionsPath, JSON.stringify(aligned, null, 2));
writeFileSync(transcript, `${text}\n`);
writeFileSync(lowConfidence, JSON.stringify(doubtful, null, 2));

console.log(text);
console.log(`\nWords: ${aligned.length}. Low confidence: ${doubtful.length}`);
for (const c of doubtful) {
  console.log(`  ${(c.startMs / 1000).toFixed(2)} s  ${c.text.trim()}  (${c.confidence.toFixed(2)})`);
}
if (text.includes("�")) {
  console.error("WARNING: transcript contains broken characters (U+FFFD)");
  process.exit(4);
}
