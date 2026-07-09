#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, defaultConfigPath, type HudConfig } from './config.js';
import { collectSnapshots } from './session.js';
import { setLanguage, t } from './i18n/index.js';
import { render, renderJson, renderTmux, lineCount } from './render/index.js';
import type { RenderContext } from './types.js';

export interface CliOptions {
  watch: boolean;
  once: boolean;
  tmux: boolean;
  json: boolean;
  all: boolean;
  noColor: boolean;
  plain: boolean;
  cwd?: string;
  session?: string;
  grokHome?: string;
  refreshMs?: number;
  initConfig: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    watch: false,
    once: true,
    tmux: false,
    json: false,
    all: false,
    noColor: false,
    plain: false,
    initConfig: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case '-w':
      case '--watch':
        opts.watch = true;
        opts.once = false;
        break;
      case '--once':
        opts.once = true;
        opts.watch = false;
        break;
      case '--tmux':
        opts.tmux = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--all':
        opts.all = true;
        break;
      case '--no-color':
      case '--plain':
        opts.noColor = true;
        opts.plain = true;
        break;
      case '--cwd':
        opts.cwd = argv[++i];
        break;
      case '--session':
        opts.session = argv[++i];
        break;
      case '--grok-home':
        opts.grokHome = argv[++i];
        break;
      case '--interval':
      case '-n': {
        const n = Number.parseInt(argv[++i] ?? '', 10);
        if (Number.isFinite(n) && n > 0) opts.refreshMs = n;
        break;
      }
      case '--init-config':
        opts.initConfig = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      case '-v':
      case '--version':
        opts.version = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown flag: ${arg}`);
          opts.help = true;
        }
        break;
    }
  }

  return opts;
}

function printHelp(): void {
  console.log(`
${t('init.banner')}

Usage:
  grok-hud [options]

Options:
  --watch, -w          Refresh continuously (default interval 1000ms)
  --once               Print once and exit (default)
  --tmux               Single-line output for tmux status bar
  --json               Machine-readable JSON
  --all                Show all active sessions
  --cwd <path>         Focus session for this working directory
  --session <id>       Focus a specific session id
  --grok-home <path>   Override ~/.grok
  --interval, -n <ms>  Watch refresh interval
  --no-color           Disable ANSI colors
  --init-config        Write default config to ~/.grok/plugins/grok-hud/config.json
  --help, -h           Show help
  --version, -v        Show version

Examples:
  grok-hud                     # one-shot HUD for current/active session
  grok-hud --watch             # live dashboard in another pane
  grok-hud --cwd ~/dev/app     # focus project
  grok-hud --tmux              # for tmux status-right
  grok-hud --json | jq         # script integration

Data sources (read-only):
  ~/.grok/active_sessions.json
  ~/.grok/sessions/<cwd>/<id>/signals.json
  ~/.grok/sessions/<cwd>/<id>/summary.json
  ~/.grok/sessions/<cwd>/<id>/updates.jsonl

Config:
  ${defaultConfigPath()}
`);
}

function writeDefaultConfig(config: HudConfig): string {
  const file = defaultConfigPath(config.grokHome);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    const { grokHome: _gh, ...rest } = config;
    fs.writeFileSync(file, JSON.stringify(rest, null, 2) + '\n', 'utf8');
  }
  return file;
}

async function buildContext(config: HudConfig, opts: CliOptions): Promise<RenderContext> {
  const sessions = await collectSnapshots({
    grokHome: config.grokHome,
    cwdFilter: opts.cwd ? path.resolve(opts.cwd) : undefined,
    sessionId: opts.session,
    enableGit: config.gitStatus.enabled,
    maxTools: config.display.maxTools,
    includeInactive: true,
  });

  // Prefer session matching process cwd when not specified
  let focus = sessions[0] ?? null;
  if (!opts.session && !opts.cwd) {
    const here = path.resolve(process.cwd());
    const match = sessions.find((s) => s.cwd && path.resolve(s.cwd) === here);
    if (match) focus = match;
  }

  const cfg: HudConfig = {
    ...config,
    display: {
      ...config.display,
      showAllSessions: opts.all || config.display.showAllSessions,
    },
  };

  return {
    sessions,
    focus,
    config: cfg,
    now: Date.now(),
  };
}

function output(text: string, opts: CliOptions): void {
  if (opts.noColor) {
    // strip ANSI
    // eslint-disable-next-line no-control-regex
    process.stdout.write(text.replace(/\x1b\[[0-9;]*m/g, '') + (text.endsWith('\n') ? '' : '\n'));
    return;
  }
  process.stdout.write(text.endsWith('\n') ? text : text + '\n');
}

async function runOnce(config: HudConfig, opts: CliOptions): Promise<void> {
  const ctx = await buildContext(config, opts);
  if (opts.json) {
    output(renderJson(ctx), opts);
    return;
  }
  if (opts.tmux) {
    output(renderTmux(ctx, !opts.noColor), opts);
    return;
  }
  output(render(ctx), opts);
}

async function runWatch(config: HudConfig, opts: CliOptions): Promise<void> {
  const interval = opts.refreshMs ?? config.refreshMs;
  let lastLines = 0;

  const tick = async () => {
    try {
      const ctx = await buildContext(config, opts);
      let text: string;
      if (opts.json) {
        text = renderJson(ctx);
      } else if (opts.tmux) {
        text = renderTmux(ctx, !opts.noColor);
      } else {
        text = render(ctx);
      }

      if (process.stdout.isTTY && !opts.tmux && !opts.json) {
        // Move cursor up and clear previous frame
        if (lastLines > 0) {
          process.stdout.write(`\x1b[${lastLines}A`);
        }
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          process.stdout.write(`\x1b[2K${lines[i]}\n`);
        }
        // Clear leftover lines if frame shrank
        if (lastLines > lines.length) {
          for (let i = 0; i < lastLines - lines.length; i++) {
            process.stdout.write('\x1b[2K\n');
          }
          process.stdout.write(`\x1b[${lastLines - lines.length}A`);
        }
        lastLines = Math.max(lineCount(text), lines.length);
      } else {
        // Non-TTY: print with separator
        process.stdout.write(text + '\n');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[grok-hud] ${msg}\n`);
    }
  };

  // Hide cursor
  if (process.stdout.isTTY) {
    process.stdout.write('\x1b[?25l');
    const restore = () => {
      process.stdout.write('\x1b[?25h\n');
      process.exit(0);
    };
    process.on('SIGINT', restore);
    process.on('SIGTERM', restore);
  }

  await tick();
  setInterval(tick, interval);
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  const override: Partial<HudConfig> = {};
  if (opts.grokHome) override.grokHome = opts.grokHome;
  if (opts.refreshMs) override.refreshMs = opts.refreshMs;
  const config = loadConfig(override);

  if (opts.all) {
    config.display.showAllSessions = true;
  }
  if (opts.refreshMs) {
    config.refreshMs = opts.refreshMs;
  }

  setLanguage(config.language);

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.version) {
    console.log('0.1.0');
    return;
  }

  if (opts.initConfig) {
    const file = writeDefaultConfig(config);
    console.log(`Config written: ${file}`);
    return;
  }

  // Auto-detect cwd focus when launched inside a project that has a session
  if (!opts.cwd && !opts.session) {
    // keep default discovery
  }

  if (opts.watch) {
    await runWatch(config, opts);
  } else {
    await runOnce(config, opts);
  }
}

main().catch((err) => {
  console.error('[grok-hud] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
