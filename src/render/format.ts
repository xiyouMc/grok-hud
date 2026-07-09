export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const mins = Math.floor(s / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export function formatMs(ms?: number): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function shortModel(id?: string): string {
  if (!id) return 'Grok';
  // grok-4.5 → Grok 4.5 ; grok-build-plan → Grok build-plan
  if (id.startsWith('grok-')) {
    return `Grok ${id.slice(5)}`;
  }
  if (id.toLowerCase().startsWith('grok')) {
    return id;
  }
  return id;
}

export function projectPath(cwd: string, levels: number): string {
  if (!cwd) return '.';
  const segments = cwd.split(/[/\\]/).filter(Boolean);
  if (segments.length === 0) return '/';
  return segments.slice(-Math.max(1, Math.min(3, levels))).join('/');
}

export function shortSessionId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 8);
}
