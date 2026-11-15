import path from "node:path";

export const WHISPER_PATH = path.join(process.cwd(), "whisper.cpp");

// large-v3-turbo requires 1.7.2 or higher. 1.7.2 is the last release that builds
// with plain make; Remotion's installer does not call cmake.
export const WHISPER_VERSION = "1.7.2";

// Multilingual on purpose: a .en model cannot transcribe Spanish.
export const WHISPER_MODEL = "large-v3-turbo";

export const WHISPER_LANG = "es";
