// Links Claude Code's per-project memory folder to docs/memory/ in this repo,
// so the project memory travels with git across machines and other agents
// (Codex, OpenCode, Antigravity) can read the same notes.
import { existsSync, lstatSync, mkdirSync, readlinkSync, renameSync, symlinkSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoMemory = path.join(repoRoot, "docs", "memory");
// Claude Code names the project folder after the absolute path, with every
// non-alphanumeric character replaced by "-".
const projectKey = repoRoot.replace(/[^a-zA-Z0-9]/g, "-");
const projectDir = path.join(os.homedir(), ".claude", "projects", projectKey);
const link = path.join(projectDir, "memory");

mkdirSync(repoMemory, { recursive: true });
mkdirSync(projectDir, { recursive: true });

if (existsSync(link) || lstatSync(link, { throwIfNoEntry: false })) {
  const stat = lstatSync(link);
  if (stat.isSymbolicLink()) {
    if (path.resolve(projectDir, readlinkSync(link)) === repoMemory) {
      console.log(`Already linked: ${link} -> ${repoMemory}`);
      process.exit(0);
    }
    unlinkSync(link);
  } else {
    // A local memory already exists: keep it aside so nothing is lost.
    const backup = `${link}.backup-${Date.now()}`;
    renameSync(link, backup);
    console.log(`Existing local memory moved to ${backup}; merge it into ${repoMemory} if needed.`);
  }
}

symlinkSync(repoMemory, link, "dir");
console.log(`Linked: ${link} -> ${repoMemory}`);
