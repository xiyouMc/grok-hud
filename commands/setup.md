---
description: Install and wire up grok-hud (build binary, write config, optional PATH link)
argument-hint: "[--link]"
---

# /grok-hud:setup

Install the **grok-hud** CLI so you can watch Grok context usage outside the TUI (Grok has no native statusline API).

## Arguments

$ARGUMENTS

- `--link` — also run `npm link` so `grok-hud` is on PATH

## Steps (run them)

1. Resolve plugin root:
   - Prefer env `GROK_PLUGIN_ROOT` if set
   - Else use the directory that contains this plugin's `package.json` / `bin/grok-hud.js`

2. Build:

```bash
PLUGIN_ROOT="${GROK_PLUGIN_ROOT:-$(pwd)}"
# If not already in the plugin dir, locate it:
#   grok plugin details grok-hud
cd "$PLUGIN_ROOT"
npm install
npm run build
chmod +x bin/grok-hud.js
```

3. Write default config (idempotent):

```bash
node bin/grok-hud.js --init-config
```

4. If user passed `--link` (or asked for global install):

```bash
npm link
```

5. Smoke test:

```bash
node bin/grok-hud.js --once
# or, if linked:
grok-hud --once
```

6. Tell the user next steps:

| Goal | Command |
|------|---------|
| One-shot snapshot | `grok-hud` or `/grok-hud:status` |
| Live pane | `grok-hud --watch` or `/grok-hud:watch` |
| tmux bar | `set -g status-right '#(grok-hud --tmux --no-color) \| %H:%M'` |
| Config | `~/.grok/plugins/grok-hud/config.json` or `/grok-hud:configure` |

## Notes

- Data is **read-only** from `~/.grok/active_sessions.json` and session `signals.json` / `updates.jsonl`.
- Inside Grok TUI you can still use `/context`, `/session-info`, `/usage`.
- If `npm` / `node` is missing, ask the user to install Node.js ≥ 18 first.
