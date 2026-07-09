---
name: grok-hud
description: >-
  Real-time status HUD for Grok sessions (context tokens, model, git, recent tools).
  Use when the user asks about context usage, token usage, statusline/HUD, how full
  the context window is, grok-hud setup, or wants a live watch / tmux status bar.
when-to-use: >-
  User mentions grok-hud, statusline, HUD, context %, token usage meter, tmux status
  for Grok, or wants claude-hud-like monitoring inside/outside Grok.
argument-hint: "[setup | status | watch | configure]"
---

# grok-hud skill

**grok-hud** is an external CLI (Grok has no native statusline API). It reads:

- `~/.grok/active_sessions.json`
- `~/.grok/sessions/<cwd>/<id>/signals.json`
- `~/.grok/sessions/<cwd>/<id>/summary.json`
- `~/.grok/sessions/<cwd>/<id>/updates.jsonl`

## Quick routes

| User intent | Action |
|-------------|--------|
| Install / first time | Follow `/grok-hud:setup` (build + config) |
| Show usage now | Run `grok-hud --once` or `/grok-hud:status` |
| Live dashboard | Tell them to run `grok-hud --watch` in another pane |
| tmux bar | `#(grok-hud --tmux --no-color)` |
| Change labels/layout | `/grok-hud:configure` or edit config JSON |
| Account credits | Grok builtin `/usage` (not this HUD) |
| In-TUI context | Grok builtin `/context` or `/session-info` |

## Resolve binary

```bash
# Preferred after setup
grok-hud --once

# From plugin install
node "${GROK_PLUGIN_ROOT}/bin/grok-hud.js" --once
```

If missing, run setup: `npm install && npm run build` inside `$GROK_PLUGIN_ROOT`.

## Config

`~/.grok/plugins/grok-hud/config.json` — see `config.example.json` in the plugin root.

## Do not confuse

| Tool | Purpose |
|------|---------|
| `grok-hud` | Session context + tools HUD (this plugin) |
| `/context` | Built-in context snapshot in TUI |
| `/usage` | Account credits / billing |
| claude-hud | Claude Code only; not used by Grok |
