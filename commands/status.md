---
description: Show current Grok session HUD (context %, model, tools)
argument-hint: "[--all] [--json] [--cwd <path>]"
---

# /grok-hud:status

Print a one-shot **grok-hud** snapshot for the active session(s).

## Arguments

$ARGUMENTS

Supported flags (pass through to CLI):

- `--all` — every active session
- `--json` — machine-readable
- `--cwd <path>` — focus a working directory
- `--session <id>` — focus a session id

## Steps

1. Resolve runner:

```bash
PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-}"
if [ -n "$PLUGIN_ROOT" ] && [ -f "$PLUGIN_ROOT/bin/grok-hud.js" ]; then
  RUNNER="node $PLUGIN_ROOT/bin/grok-hud.js"
elif command -v grok-hud >/dev/null 2>&1; then
  RUNNER="grok-hud"
else
  echo "grok-hud not built. Run /grok-hud:setup first."
  exit 1
fi
```

2. If `dist/` is missing under plugin root, run setup build first (`npm install && npm run build` in plugin root).

3. Run (append user args):

```bash
$RUNNER --once $ARGUMENTS
```

4. Present the output to the user in a fenced code block (preserve ANSI only if the terminal shows colors; otherwise use `--no-color`).

5. Briefly explain the numbers:

| Field | Meaning |
|-------|---------|
| Context % | Session context window fill (`signals.json`) |
| tokens | used / total context tokens |
| 轮次 / Turns | User turns this session |
| 工具 / Tools | Tool call count + recent activity line |
| ● 活跃 | Process still running |

If no sessions are found, suggest starting `grok` in a project directory, or pass `--cwd`.
