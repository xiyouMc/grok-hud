import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export interface TelemetryConfig {
  enabled: boolean;
  /**
   * Optional custom endpoint.
   * - empty: use built-in CounterAPI (aggregate installs/starts only)
   * - http(s): POST JSON payload for self-hosted collectors
   */
  endpoint: string;
}

export const DEFAULT_TELEMETRY: TelemetryConfig = {
  enabled: false,
  endpoint: '',
};

const COUNTER_NAMESPACE = 'xiyoumc';
const COUNTER_INSTALLS = 'grok-hud-installs';
const COUNTER_STARTS = 'grok-hud-starts';

interface TelemetryState {
  installId: string;
  firstInstallPinged: boolean;
  lastStartDay: string | null;
  enabled: boolean;
}

function dataDir(grokHome: string): string {
  return path.join(grokHome, 'plugins', 'grok-hud');
}

function statePath(grokHome: string): string {
  return path.join(dataDir(grokHome), 'telemetry.json');
}

function packageVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.join(here, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function loadState(grokHome: string): TelemetryState {
  const file = statePath(grokHome);
  try {
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<TelemetryState>;
      if (typeof raw.installId === 'string' && raw.installId.length >= 8) {
        return {
          installId: raw.installId,
          firstInstallPinged: !!raw.firstInstallPinged,
          lastStartDay: typeof raw.lastStartDay === 'string' ? raw.lastStartDay : null,
          enabled: !!raw.enabled,
        };
      }
    }
  } catch {
    // recreate below
  }
  const fresh: TelemetryState = {
    installId: crypto.randomUUID(),
    firstInstallPinged: false,
    lastStartDay: null,
    enabled: false,
  };
  // Persist immediately so installId is stable across commands
  saveState(grokHome, fresh);
  return fresh;
}

function saveState(grokHome: string, state: TelemetryState): void {
  try {
    const dir = dataDir(grokHome);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath(grokHome), JSON.stringify(state, null, 2) + '\n', 'utf8');
  } catch {
    // ignore
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function httpsGetJson(url: string, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('http:') ? http : https;
    const req = lib.get(url, { timeout: timeoutMs, headers: { Accept: 'application/json' } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if ((res.statusCode ?? 500) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

function httpsPostJson(url: string, body: unknown, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const u = new URL(url);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || undefined,
        path: u.pathname + u.search,
        method: 'POST',
        timeout: timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
          Accept: 'application/json',
          'User-Agent': `grok-hud/${packageVersion()}`,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => {
          if ((res.statusCode ?? 500) >= 400) {
            reject(new Error(`HTTP ${res.statusCode}`));
          } else {
            resolve();
          }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('timeout'));
    });
    req.write(payload);
    req.end();
  });
}

async function counterUp(name: string): Promise<number | null> {
  try {
    const url = `https://api.counterapi.dev/v1/${COUNTER_NAMESPACE}/${name}/up`;
    const json = (await httpsGetJson(url)) as { count?: number };
    return typeof json.count === 'number' ? json.count : null;
  } catch {
    return null;
  }
}

async function counterGet(name: string): Promise<number | null> {
  try {
    const url = `https://api.counterapi.dev/v1/${COUNTER_NAMESPACE}/${name}/`;
    const json = (await httpsGetJson(url)) as { count?: number };
    return typeof json.count === 'number' ? json.count : null;
  } catch {
    return null;
  }
}

function buildPayload(state: TelemetryState, event: 'install' | 'start', mode: string) {
  return {
    v: 1,
    event,
    mode,
    installId: state.installId,
    version: packageVersion(),
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    ts: new Date().toISOString(),
  };
}

/**
 * Fire-and-forget anonymous telemetry.
 * Default OFF. When enabled:
 * - first run: count as one install
 * - at most one "start" ping per UTC day
 *
 * Does NOT send: cwd, paths, tokens, email, prompts, or session content.
 */
export async function maybePingTelemetry(options: {
  grokHome: string;
  telemetry: TelemetryConfig;
  mode: 'once' | 'watch' | 'tmux' | 'json';
}): Promise<void> {
  if (!options.telemetry?.enabled) return;

  const state = loadState(options.grokHome);
  // Config is source of truth when present
  state.enabled = true;

  const endpoint = (options.telemetry.endpoint || '').trim();
  const day = todayUtc();
  const tasks: Array<Promise<unknown>> = [];

  const send = async (event: 'install' | 'start') => {
    const payload = buildPayload(state, event, options.mode);
    if (endpoint) {
      await httpsPostJson(endpoint, payload);
      return;
    }
    // Built-in aggregate counters (no PII; install-id stays local)
    if (event === 'install') {
      await counterUp(COUNTER_INSTALLS);
    } else {
      await counterUp(COUNTER_STARTS);
    }
  };

  if (!state.firstInstallPinged) {
    tasks.push(
      send('install')
        .then(() => {
          state.firstInstallPinged = true;
        })
        .catch(() => {
          /* silent */
        }),
    );
  }

  if (state.lastStartDay !== day) {
    tasks.push(
      send('start')
        .then(() => {
          state.lastStartDay = day;
        })
        .catch(() => {
          /* silent */
        }),
    );
  }

  if (tasks.length === 0) {
    saveState(options.grokHome, state);
    return;
  }

  await Promise.allSettled(tasks);
  saveState(options.grokHome, state);
}

export function setTelemetryEnabled(grokHome: string, enabled: boolean): TelemetryState {
  const state = loadState(grokHome);
  state.enabled = enabled;
  saveState(grokHome, state);
  return state;
}

export async function telemetryStatus(grokHome: string, telemetry: TelemetryConfig): Promise<string> {
  const state = loadState(grokHome);
  const enabled = telemetry.enabled || state.enabled;
  const lines = [
    `telemetry: ${enabled ? 'on' : 'off'} (default off; opt-in only)`,
    `installId: ${state.installId}`,
    `firstInstallPinged: ${state.firstInstallPinged}`,
    `lastStartDay: ${state.lastStartDay ?? '—'}`,
    `endpoint: ${telemetry.endpoint?.trim() ? telemetry.endpoint : 'built-in CounterAPI (aggregate only)'}`,
    `privacy: no cwd/paths/tokens/prompts; anonymous install id is local`,
  ];

  if (enabled || true) {
    // Always try to show public aggregate counts when using built-in backend
    if (!telemetry.endpoint?.trim()) {
      const [installs, starts] = await Promise.all([
        counterGet(COUNTER_INSTALLS),
        counterGet(COUNTER_STARTS),
      ]);
      lines.push(`public installs (approx): ${installs ?? 'n/a'}`);
      lines.push(`public starts (approx, daily pings): ${starts ?? 'n/a'}`);
      lines.push(
        `counters: https://api.counterapi.dev/v1/${COUNTER_NAMESPACE}/${COUNTER_INSTALLS}/`,
      );
    }
  }

  return lines.join('\n');
}
