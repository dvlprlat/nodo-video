import path from "node:path";
import { WHISPER_MODEL, WHISPER_PATH } from "./whisper-config.mjs";

export const getModelPath = () => path.join(WHISPER_PATH, `ggml-${WHISPER_MODEL}.bin`);
