---
description: How to run a live grok-hud watch pane (or start one in background)
argument-hint: "[--cwd <path>] [--interval <ms>]"
---

# /grok-hud:watch

Grok cannot inject a statusline into its own TUI. Live HUD is an **external** process.

## Arguments

$ARGUMENTS

## What to do

1. Ensure CLI is built (`/grok-hud:setup` if needed).

2. Give the user a ready-to-paste command for a **second terminal pane**:

```bash
# Prefer linked binary
grok-hud --watch --cwd "$(pwd)"

# Or via plugin root
node "$GROK_PLUGIN_ROOT/bin/grok-hud.js" --watch --cwd "$(pwd)"
```

Optional:

```bash
grok-hud --watch --interval 2000 --all
```

3. **tmux** one-liner for status bar:

```tmux
set -g status-right '#(grok-hud --tmux --no-color) | %H:%M'
set -g status-interval 2
```

4. Do **not** start a long-running watch that blocks this Grok session unless the user explicitly asks. Prefer printing the command.

5. If the user explicitly wants you to start watch in the background for them, run:

```bash
# background, log to plugin data dir when available
LOG_DIR="${GROK_PLUGIN_DATA:-$HOME/.grok/plugins/grok-hud}"
mkdir -p "$LOG_DIR"
nohup grok-hud --watch --no-color >"$LOG_DIR/watch.log" 2>&1 &
echo "PID $!  log: $LOG_DIR/watch.log"
```

Then tell them how to stop it (`kill <pid>`).
