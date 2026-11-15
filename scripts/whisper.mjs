import { rmSync } from "node:fs";
import { toCaptions, transcribe } from "@remotion/install-whisper-cpp";
import { alignToDtw, run } from "./lib.mjs";
import { WHISPER_LANG, WHISPER_MODEL, WHISPER_PATH, WHISPER_VERSION } from "./whisper-config.mjs";

// Transcribes any audio file into word captions timed by DTW onsets.
// Song lyrics may not be in Spanish, so callers can pass "auto" or another language.
export const transcribeWords = async (input, prompt, language = WHISPER_LANG) => {
  // whisper.cpp only accepts 16 kHz wav.
  const input16k = `${input}.16k.wav`;
  await run("ffmpeg", ["-y", "-hide_banner", "-i", input, "-ar", "16000", "-ac", "1", input16k]);

  const whisperCppOutput = await transcribe({
    inputPath: input16k,
    model: WHISPER_MODEL,
    whisperPath: WHISPER_PATH,
    whisperCppVersion: WHISPER_VERSION,
    tokenLevelTimestamps: true,
    language,
    translateToEnglish: false,
    splitOnWord: true,
    printOutput: false,
    additionalArgs: prompt ? [["--prompt", prompt]] : [],
  });
  rmSync(input16k);

  // toCaptions() keeps only the first token's probability. A word is as doubtful
  // as its weakest token, so take the minimum.
  const items = whisperCppOutput.transcription.filter((item) => item.text !== "");
  const { captions } = toCaptions({ whisperCppOutput });
  const scored = captions.map((caption, i) => {
    const probabilities = items[i].tokens.filter((t) => !t.text.startsWith("[_")).map((t) => t.p);
    return {
      ...caption,
      confidence: probabilities.length ? Math.min(...probabilities) : caption.confidence,
    };
  });

  return alignToDtw(scored);
};
