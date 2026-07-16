# grok-hud

Real-time statusline HUD for **Grok** (xAI CLI), inspired by [claude-hud](https://github.com/jarrodwatts/claude-hud).

Grok does not expose a Claude-style native statusline API, so **grok-hud** reads live session files under `~/.grok/` and renders a terminal HUD (watch mode, one-shot, or tmux line).

```
[Grok 4.5] │ CoachFlow git:(main*) │ admin split optimization… │ ● live
Context ████░░░░░░ 37% (190k/500k) │ Time 1h 17m │ Turns 9 │ Tools 140
Usage ██░░░░░░░░ 25% (3.7k/15k) (monthly) · monthly resets 16d · week ends 6h
◐ run_terminal_command ls -la … | ✓ read_file ×3 | ✓ grep ×2
```

## Install

### npm (CLI)

```bash
npm install -g grok-hud
grok-hud --watch
```

### Grok plugin

```bash
# from GitHub
grok plugin install xiyouMc/grok-hud --trust
grok plugin enable grok-hud

# or from a local clone
grok plugin install /path/to/grok-hud --trust
grok plugin enable grok-hud
```

Then in a Grok session:

| Slash command | Purpose |
|---------------|---------|
| `/grok-hud:setup` | `npm install` + build + write config (+ optional `npm link`) |
| `/grok-hud:status` | One-shot HUD snapshot |
| `/grok-hud:watch` | Instructions for a live pane / tmux |
| `/grok-hud:configure` | Edit display options |

Also installs a **skill** (`grok-hud`) so the agent knows how to help with context/HUD questions.

Validate the package:

```bash
grok plugin validate .
```

### From source

```bash
git clone git@github.com:xiyouMc/grok-hud.git
cd grok-hud
npm install
npm run build
npm link          # optional: puts `grok-hud` on PATH
```

## Usage

### CLI

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
| `grok-hud --telemetry on\|off\|status` | Opt-in anonymous usage counts (default **off**) |

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
| Usage bar (credits) | Prefers weekly `%` from `GET /v1/billing?format=credits`; falls back to monthly `used/monthlyLimit` from `GET /v1/billing`. Still shows weekly window (`week ends`) when the API returns a WEEKLY period without a percent. Auth from `~/.grok/auth.json`, cached ~60s |
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
  "language": "en",
  "lineLayout": "expanded",
  "pathLevels": 2,
  "refreshMs": 1000,
  "display": {
    "showContextBar": true,
    "contextValue": "both",
    "showUsage": true,
    "usageBarEnabled": true,
    "showTools": true,
    "showDuration": true,
    "showTurns": true,
    "warningThreshold": 70,
    "criticalThreshold": 90
  },
  "usage": {
    "cacheTtlMs": 60000
  },
  "gitStatus": {
    "enabled": true,
    "showDirty": true
  }
}
```

`language`: `"en"` | `"zh"`  
`lineLayout`: `"expanded"` | `"compact"`  
`contextValue`: `"percent"` | `"tokens"` | `"remaining"` | `"both"`  
`display.showUsage`: weekly credit bar from Grok billing API (disable to stay offline-only)

### Telemetry (opt-in, default off)

Anonymous install/start counts so maintainers can estimate adoption. **Off by default.**

```bash
grok-hud --telemetry on      # opt in
grok-hud --telemetry status  # local id + public aggregates
grok-hud --telemetry off     # opt out
```

Or in config:

```json
{
  "telemetry": {
    "enabled": false,
    "endpoint": ""
  }
}
```

| Setting | Meaning |
|---------|---------|
| `enabled` | Must be `true` to send anything |
| `endpoint` | Empty = built-in aggregate CounterAPI; or your own `POST` JSON URL |

**What is sent (only when enabled):** package version, OS/arch, Node version, anonymous local `installId`, event type (`install` once / `start` at most once per UTC day).

**What is never sent:** cwd, file paths, tokens, emails, prompts, session transcripts, billing details.

Public aggregates (CounterAPI):

- installs: `https://api.counterapi.dev/v1/xiyoumc/grok-hud-installs/`
- starts: `https://api.counterapi.dev/v1/xiyoumc/grok-hud-starts/`

npm download stats (after publish): https://www.npmjs.com/package/grok-hud

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
