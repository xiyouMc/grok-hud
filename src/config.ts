import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export type LineLayoutType = 'compact' | 'expanded';
export type ContextValueMode = 'percent' | 'tokens' | 'remaining' | 'both';
export type Language = 'en' | 'zh';

export type HudColorName =
  | 'dim'
  | 'red'
  | 'green'
  | 'yellow'
  | 'magenta'
  | 'cyan'
  | 'brightBlue'
  | 'brightMagenta';

export type HudColorValue = HudColorName | number | string;

export interface HudColorOverrides {
  context: HudColorValue;
  warning: HudColorValue;
  critical: HudColorValue;
  model: HudColorValue;
  project: HudColorValue;
  git: HudColorValue;
  gitBranch: HudColorValue;
  label: HudColorValue;
  tools: HudColorValue;
  stats: HudColorValue;
}

export interface HudConfig {
  language: Language;
  lineLayout: LineLayoutType;
  pathLevels: 1 | 2 | 3;
  refreshMs: number;
  grokHome: string;
  gitStatus: {
    enabled: boolean;
    showDirty: boolean;
    showAheadBehind: boolean;
  };
  display: {
    showModel: boolean;
    showProject: boolean;
    showContextBar: boolean;
    contextValue: ContextValueMode;
    showUsage: boolean;
    usageBarEnabled: boolean;
    usageThreshold: number;
    showDuration: boolean;
    showTurns: boolean;
    showToolCount: boolean;
    showTools: boolean;
    showLatency: boolean;
    showLines: boolean;
    showSessionTitle: boolean;
    showPid: boolean;
    showAllSessions: boolean;
    maxTools: number;
    warningThreshold: number;
    criticalThreshold: number;
  };
  usage: {
    /** Cache TTL for billing API (ms). Avoid hammering the network in --watch. */
    cacheTtlMs: number;
  };
  colors: HudColorOverrides;
}

export const DEFAULT_CONFIG: HudConfig = {
  language: 'zh',
  lineLayout: 'expanded',
  pathLevels: 2,
  refreshMs: 1000,
  grokHome: path.join(os.homedir(), '.grok'),
  gitStatus: {
    enabled: true,
    showDirty: true,
    showAheadBehind: false,
  },
  display: {
    showModel: true,
    showProject: true,
    showContextBar: true,
    contextValue: 'both',
    showUsage: true,
    usageBarEnabled: true,
    usageThreshold: 0,
    showDuration: true,
    showTurns: true,
    showToolCount: true,
    showTools: true,
    showLatency: false,
    showLines: false,
    showSessionTitle: true,
    showPid: false,
    showAllSessions: false,
    maxTools: 5,
    warningThreshold: 70,
    criticalThreshold: 90,
  },
  usage: {
    cacheTtlMs: 60_000,
  },
  colors: {
    context: 'green',
    warning: 'yellow',
    critical: 'red',
    model: 'cyan',
    project: 'yellow',
    git: 'magenta',
    gitBranch: 'cyan',
    label: 'dim',
    tools: 'brightBlue',
    stats: 'dim',
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(base: T, override: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const current = out[key];
    if (isObject(current) && isObject(value)) {
      out[key] = deepMerge(current, value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function configPaths(grokHome: string): string[] {
  return [
    path.join(grokHome, 'plugins', 'grok-hud', 'config.json'),
    path.join(grokHome, 'grok-hud', 'config.json'),
    path.join(os.homedir(), '.config', 'grok-hud', 'config.json'),
    path.join(process.cwd(), 'grok-hud.config.json'),
  ];
}

export function loadConfig(overrides: Partial<HudConfig> = {}): HudConfig {
  let config = structuredClone(DEFAULT_CONFIG);

  if (overrides.grokHome) {
    config.grokHome = overrides.grokHome;
  }

  for (const file of configPaths(config.grokHome)) {
    try {
      if (!fs.existsSync(file)) continue;
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
      config = deepMerge(config as unknown as Record<string, unknown>, raw) as unknown as HudConfig;
      break;
    } catch {
      // ignore invalid config files and try next path
    }
  }

  config = deepMerge(
    config as unknown as Record<string, unknown>,
    overrides as unknown as Record<string, unknown>,
  ) as unknown as HudConfig;

  if (!config.grokHome) {
    config.grokHome = path.join(os.homedir(), '.grok');
  }

  return config;
}

export function defaultConfigPath(grokHome?: string): string {
  const home = grokHome ?? path.join(os.homedir(), '.grok');
  return path.join(home, 'plugins', 'grok-hud', 'config.json');
}
