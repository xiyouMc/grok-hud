# grok-hud

Real-time statusline HUD for **Grok** (xAI CLI), inspired by [claude-hud](https://github.com/jarrodwatts/claude-hud).

Grok does not expose a Claude-style native statusline API, so **grok-hud** reads live session files under `~/.grok/` and renders a terminal HUD (watch mode, one-shot, or tmux line).

```
[Grok 4.5] │ CoachFlow git:(main*) │ 体优化执行… │ ● 活跃
上下文 ████░░░░░░ 37% (190k/500k) │ 时长 1h 17m │ 轮次 9 │ 工具 140
◐ run_terminal_command ls -la … | ✓ read_file ×3 | ✓ grep ×2
```

## Install

```bash
cd /path/to/grok-hud
npm install
npm run build
npm link          # optional: puts `grok-hud` on PATH
```

Or run directly:

```bash
node bin/grok-hud.js --watch
```

## Usage

| Command | What it does |
|---------|----------------|
| `grok-hud` | One-shot snapshot of the best matching session |
| `grok-hud --watch` | Live refresh (default 1s) in another pane |
| `grok-hud --tmux` | Single line for tmux `status-right` |
| `grok-hud --json` | Machine-readable dump |
| `grok-hud --all` | Show every active session |
| `grok-hud --cwd ~/dev/app` | Focus a project |
| `grok-hud --session <id>` | Focus a session id |
| `grok-hud --init-config` | Write default config |

### Side-by-side with Grok

```bash
# pane 1
grok

# pane 2
grok-hud --watch --cwd "$(pwd)"
```

### tmux status bar

```tmux
set -g status-right '#(grok-hud --tmux --no-color) | %H:%M'
set -g status-interval 2
```

Or with color (if your tmux supports it):

```tmux
set -g status-right '#(grok-hud --tmux) | %H:%M'
```

## What you see

| Field | Source |
|-------|--------|
| Model | `signals.json` / `summary.json` |
| Project path + git branch | session cwd + `git` |
| Context bar % / tokens | `signals.contextWindowUsage`, `contextTokensUsed`, `contextWindowTokens` |
| Duration, turns, tool count | `signals.json` |
| Recent tools | tail of `updates.jsonl` |
| Live / stale | `active_sessions.json` + process PID |

## Configuration

```bash
grok-hud --init-config
# → ~/.grok/plugins/grok-hud/config.json
```

Search order:

1. `~/.grok/plugins/grok-hud/config.json`
2. `~/.grok/grok-hud/config.json`
3. `~/.config/grok-hud/config.json`
4. `./grok-hud.config.json`

Useful keys:

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "pathLevels": 2,
  "refreshMs": 1000,
  "display": {
    "showContextBar": true,
    "contextValue": "both",
    "showTools": true,
    "showDuration": true,
    "showTurns": true,
    "warningThreshold": 70,
    "criticalThreshold": 90
  },
  "gitStatus": {
    "enabled": true,
    "showDirty": true
  }
}
```

`language`: `"zh"` | `"en"`  
`lineLayout`: `"expanded"` | `"compact"`  
`contextValue`: `"percent"` | `"tokens"` | `"remaining"` | `"both"`

## How it works

```
Grok TUI ──writes──▶ ~/.grok/sessions/.../signals.json
                     ~/.grok/sessions/.../updates.jsonl
                     ~/.grok/active_sessions.json
                              │
                              ▼
                         grok-hud (poll)
                              │
                              ▼
                    stdout HUD / tmux line
```

Unlike claude-hud (stdin statusline hook inside Claude Code), grok-hud is an **external reader**. That means:

- Works without Grok shipping a statusline API
- Safe read-only access to session files
- Can run in a second terminal pane, tmux status, or scripts

Inside Grok you can still use `/context`, `/session-info`, and `/usage` for interactive checks.

## Comparison with claude-hud

| | claude-hud | grok-hud |
|--|------------|----------|
| Host | Claude Code statusline API | External CLI |
| Context tokens | stdin JSON from host | `signals.json` |
| Tools / agents | transcript JSONL | `updates.jsonl` |
| Subscriber usage bars | Claude rate_limits | N/A (use Grok `/usage`) |
| Refresh | host-driven ~300ms | poll (`--watch`, default 1s) |

## Development

```bash
npm run build
npm start -- --once
npm run watch
```

## License

MIT
