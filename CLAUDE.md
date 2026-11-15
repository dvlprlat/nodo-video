@AGENTS.md

## Claude Code only

- `AGENTS.md` is the single instructions file for every agent. Edit rules there, not here.
- Custom slash commands `/setup` and `/configurar` live in `.claude/commands/` and delegate to `.agents/skills/setup/SKILL.md`.
- Run `npm run link-memory` once so Claude Code auto-loads `docs/memory/`.
