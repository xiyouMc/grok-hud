---
description: Configure grok-hud display options (language, layout, thresholds)
argument-hint: "[language=zh|en] [layout=expanded|compact]"
---

# /grok-hud:configure

Edit or create the grok-hud config file.

## Config path

```
~/.grok/plugins/grok-hud/config.json
```

Create defaults if missing:

```bash
grok-hud --init-config
# or
node "$GROK_PLUGIN_ROOT/bin/grok-hud.js" --init-config
```

## Arguments

$ARGUMENTS

If the user passes simple prefs, apply them with a small edit:

| Pref | JSON path | Values |
|------|-----------|--------|
| language | `language` | `zh` (default), `en` |
| layout | `lineLayout` | `expanded`, `compact` |
| path depth | `pathLevels` | `1`, `2`, `3` |
| tools line | `display.showTools` | `true` / `false` |
| context format | `display.contextValue` | `percent`, `tokens`, `remaining`, `both` |
| warn / critical | `display.warningThreshold` / `criticalThreshold` | 0–100 |
| refresh | `refreshMs` | ms (watch mode) |

## Steps

1. Read existing config (or create via `--init-config`).
2. Apply requested changes with a careful JSON edit (preserve unknown keys / colors).
3. Show a preview:

```bash
grok-hud --once
```

4. Point to full option list in the plugin README (`$GROK_PLUGIN_ROOT/README.md` or https://github.com/xiyouMc/grok-hud).

## Example config snippet

```json
{
  "language": "zh",
  "lineLayout": "expanded",
  "pathLevels": 2,
  "display": {
    "showTools": true,
    "contextValue": "both",
    "warningThreshold": 70,
    "criticalThreshold": 90
  }
}
```
