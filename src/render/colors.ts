import type { HudColorName, HudColorValue, HudColorOverrides } from '../config.js';

export const RESET = '\x1b[0m';

const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const BRIGHT_BLUE = '\x1b[94m';
const BRIGHT_MAGENTA = '\x1b[95m';

const ANSI_BY_NAME: Record<HudColorName, string> = {
  dim: DIM,
  red: RED,
  green: GREEN,
  yellow: YELLOW,
  magenta: MAGENTA,
  cyan: CYAN,
  brightBlue: BRIGHT_BLUE,
  brightMagenta: BRIGHT_MAGENTA,
};

function hexToAnsi(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function resolveAnsi(value: HudColorValue | undefined, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return `\x1b[38;5;${value}m`;
  if (typeof value === 'string' && value.startsWith('#') && value.length === 7) {
    return hexToAnsi(value);
  }
  return ANSI_BY_NAME[value as HudColorName] ?? fallback;
}

function colorize(text: string, color: string): string {
  return `${color}${text}${RESET}`;
}

function withOverride(text: string, value: HudColorValue | undefined, fallback: string): string {
  return colorize(text, resolveAnsi(value, fallback));
}

export function dim(text: string): string {
  return colorize(text, DIM);
}

export function green(text: string): string {
  return colorize(text, GREEN);
}

export function yellow(text: string): string {
  return colorize(text, YELLOW);
}

export function red(text: string): string {
  return colorize(text, RED);
}

export function cyan(text: string): string {
  return colorize(text, CYAN);
}

export function magenta(text: string): string {
  return colorize(text, MAGENTA);
}

export function model(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.model, CYAN);
}

export function project(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.project, YELLOW);
}

export function git(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.git, MAGENTA);
}

export function gitBranch(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.gitBranch, CYAN);
}

export function label(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.label, DIM);
}

export function tools(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.tools, BRIGHT_BLUE);
}

export function stats(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.stats, DIM);
}

export function warning(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.warning, YELLOW);
}

export function critical(text: string, colors?: HudColorOverrides): string {
  return withOverride(text, colors?.critical, RED);
}

export function contextColor(percent: number, colors?: HudColorOverrides, warn = 70, crit = 90): string {
  if (percent >= crit) return resolveAnsi(colors?.critical, RED);
  if (percent >= warn) return resolveAnsi(colors?.warning, YELLOW);
  return resolveAnsi(colors?.context, GREEN);
}

export function colorByPercent(
  text: string,
  percent: number,
  colors?: HudColorOverrides,
  warn = 70,
  crit = 90,
): string {
  return colorize(text, contextColor(percent, colors, warn, crit));
}

export function bar(
  percent: number,
  width = 10,
  colors?: HudColorOverrides,
  warn = 70,
  crit = 90,
): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);
  const body = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;
  return colorize(body, contextColor(clamped, colors, warn, crit));
}

/** Strip ANSI for width calculations / tmux plain mode */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
