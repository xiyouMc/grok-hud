import * as fs from 'node:fs';
import type { ToolEntry, ToolStatus } from './types.js';

interface RawUpdate {
  timestamp?: number;
  params?: {
    update?: {
      sessionUpdate?: string;
      toolCallId?: string;
      tool_call_id?: string;
      title?: string;
      kind?: string;
      rawInput?: Record<string, unknown>;
      status?: string;
      content?: unknown;
      _meta?: {
        'x.ai/tool'?: {
          name?: string;
          label?: string;
          kind?: string;
        };
      };
    };
    _meta?: {
      agentTimestampMs?: number;
      updateParams?: {
        toolCallId?: string;
        title?: string;
        status?: string;
        kind?: string;
      };
      updateType?: string;
    };
  };
}

function mapStatus(raw?: string): ToolStatus {
  switch ((raw || '').toLowerCase()) {
    case 'completed':
    case 'success':
      return 'completed';
    case 'failed':
    case 'error':
      return 'error';
    case 'inprogress':
    case 'in_progress':
    case 'running':
      return 'running';
    case 'pending':
    default:
      return 'pending';
  }
}

function toolTarget(name: string, rawInput?: Record<string, unknown>): string | undefined {
  if (!rawInput) return undefined;
  const candidates = [
    rawInput.path,
    rawInput.target_file,
    rawInput.file_path,
    rawInput.directory,
    rawInput.target_directory,
    rawInput.command,
    rawInput.pattern,
    rawInput.query,
    rawInput.description,
    rawInput.url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const s = c.trim().replace(/\s+/g, ' ');
      return s.length > 48 ? `${s.slice(0, 45)}...` : s;
    }
  }
  // nested tool for use_tool
  if (typeof rawInput.tool_name === 'string') return rawInput.tool_name;
  return name;
}

function basenamePath(p: string): string {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1] || p;
}

function normalizeToolName(title: string, metaName?: string): string {
  if (metaName && metaName.trim()) return metaName.trim();
  if (!title) return 'tool';
  // "Execute `ls -la ...`" → keep as shell-ish label
  if (/^Execute\s+/i.test(title)) return 'run_terminal_command';
  // Prefer bare identifiers
  if (/^[a-z][a-z0-9_]*$/i.test(title)) return title;
  // "Run Command" style labels
  if (title.length <= 32 && !title.includes('`') && !title.includes('/')) {
    return title.replace(/\s+/g, '_').toLowerCase();
  }
  return 'tool';
}

/**
 * Parse recent tool activity from updates.jsonl.
 * Reads the tail of the file for speed.
 */
export function parseRecentTools(updatesPath: string, limit = 12): ToolEntry[] {
  if (!fs.existsSync(updatesPath)) return [];

  let content: string;
  try {
    const stat = fs.statSync(updatesPath);
    const fd = fs.openSync(updatesPath, 'r');
    try {
      const maxBytes = Math.min(stat.size, 512 * 1024);
      const start = Math.max(0, stat.size - maxBytes);
      const buf = Buffer.alloc(maxBytes);
      const read = fs.readSync(fd, buf, 0, maxBytes, start);
      content = buf.subarray(0, read).toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }

  const lines = content.split('\n').filter(Boolean);
  // If we started mid-line, drop first partial line
  if (lines.length > 0 && !lines[0]!.trimStart().startsWith('{')) {
    lines.shift();
  }

  const tools = new Map<string, ToolEntry>();

  for (const line of lines) {
    let raw: RawUpdate;
    try {
      raw = JSON.parse(line) as RawUpdate;
    } catch {
      continue;
    }

    const update = raw.params?.update;
    if (!update) continue;
    const kind = update.sessionUpdate;
    if (kind !== 'tool_call' && kind !== 'tool_call_update') continue;

    const id =
      update.toolCallId ||
      update.tool_call_id ||
      raw.params?._meta?.updateParams?.toolCallId ||
      '';
    if (!id) continue;

    const toolMeta = update._meta?.['x.ai/tool'];
    const rawTitle =
      toolMeta?.name ||
      update.title ||
      raw.params?._meta?.updateParams?.title ||
      '';
    // Prefer stable tool ids over "Execute `...`" titles
    const name = normalizeToolName(rawTitle, toolMeta?.name);

    const statusRaw =
      raw.params?._meta?.updateParams?.status ||
      update.status ||
      (kind === 'tool_call' ? 'Pending' : undefined);

    const tsMs = raw.params?._meta?.agentTimestampMs ?? (raw.timestamp ? raw.timestamp * 1000 : Date.now());
    const existing = tools.get(id);

    if (!existing) {
      let target = toolTarget(name, update.rawInput);
      if (target && (name === 'read_file' || name === 'search_replace' || name === 'write' || name === 'list_dir')) {
        // prefer basename for file tools in HUD
        if (target.includes('/') || target.includes('\\')) {
          target = basenamePath(target);
        }
      }
      // If name is generic, pull target from Execute-style titles
      if ((!target || target === name) && rawTitle && rawTitle !== name) {
        const t = rawTitle.replace(/^Execute\s+`?/, '').replace(/`$/, '');
        if (t && t !== name) {
          target = t.length > 48 ? `${t.slice(0, 45)}...` : t;
        }
      }
      tools.set(id, {
        id,
        name,
        target,
        status: mapStatus(statusRaw),
        startTime: new Date(tsMs),
      });
    } else {
      const status = mapStatus(statusRaw);
      existing.status = status;
      if (status === 'completed' || status === 'error') {
        existing.endTime = new Date(tsMs);
      }
      if (status === 'running' || status === 'pending') {
        existing.endTime = undefined;
      }
      if (existing.name === 'tool' && name !== 'tool') {
        existing.name = name;
      }
      if (!existing.target && update.rawInput) {
        existing.target = toolTarget(existing.name, update.rawInput);
      }
      // title on update can be more descriptive
      if (update.title && update.title !== existing.name && !existing.target) {
        const t = update.title.replace(/^Execute\s+`?/, '').replace(/`$/, '');
        existing.target = t.length > 48 ? `${t.slice(0, 45)}...` : t;
      }
    }
  }

  const list = Array.from(tools.values());
  // Running first, then newest
  list.sort((a, b) => {
    const rank = (s: ToolStatus) => (s === 'running' || s === 'pending' ? 0 : 1);
    if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
    return (b.startTime?.getTime() ?? 0) - (a.startTime?.getTime() ?? 0);
  });

  return list.slice(0, limit);
}
