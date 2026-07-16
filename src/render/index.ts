import type { RenderContext, SessionSnapshot, ToolEntry } from '../types.js';
import { t } from '../i18n/index.js';
import {
  bar,
  colorByPercent,
  critical,
  dim,
  git,
  gitBranch,
  green,
  label,
  model,
  project,
  red,
  stats,
  tools as toolsColor,
  warning,
  yellow,
  stripAnsi,
} from './colors.js';
import {
  formatDuration,
  formatMs,
  formatTokens,
  projectPath,
  shortModel,
  shortSessionId,
} from './format.js';
import { formatCreditAmount, formatResetCountdown } from '../billing.js';

function sep(parts: string[], divider = ' │ '): string {
  return parts.filter(Boolean).join(divider);
}

function toolGlyph(status: ToolEntry['status']): string {
  switch (status) {
    case 'running':
      return '◐';
    case 'pending':
      return '○';
    case 'error':
      return '✗';
    case 'completed':
    default:
      return '✓';
  }
}

function renderToolLine(tool: ToolEntry, colors: RenderContext['config']['colors']): string {
  const glyph = toolGlyph(tool.status);
  const coloredGlyph =
    tool.status === 'error'
      ? red(glyph)
      : tool.status === 'running' || tool.status === 'pending'
        ? yellow(glyph)
        : green(glyph);
  const name = toolsColor(tool.name, colors);
  const target = tool.target ? dim(` ${tool.target}`) : '';
  return `${coloredGlyph} ${name}${target}`;
}

function renderIdentityLine(snap: SessionSnapshot, ctx: RenderContext): string {
  const { config } = ctx;
  const colors = config.colors;
  const display = config.display;
  const parts: string[] = [];

  if (display.showModel) {
    const modelId =
      snap.signals?.primaryModelId ||
      snap.summary?.current_model_id ||
      snap.signals?.modelsUsed?.[0] ||
      'grok';
    parts.push(model(`[${shortModel(modelId)}]`, colors));
  }

  if (display.showProject && snap.cwd) {
    parts.push(project(projectPath(snap.cwd, config.pathLevels), colors));
  }

  if (config.gitStatus.enabled && snap.gitStatus) {
    const branchText =
      snap.gitStatus.branch +
      (config.gitStatus.showDirty && snap.gitStatus.isDirty ? '*' : '');
    const inner: string[] = [gitBranch(branchText, colors)];
    if (config.gitStatus.showAheadBehind) {
      if (snap.gitStatus.ahead > 0) inner.push(gitBranch(`↑${snap.gitStatus.ahead}`, colors));
      if (snap.gitStatus.behind > 0) inner.push(gitBranch(`↓${snap.gitStatus.behind}`, colors));
    }
    parts.push(`${git('git:(', colors)}${inner.join(' ')}${git(')', colors)}`);
  }

  if (display.showSessionTitle) {
    const title = snap.summary?.generated_title || snap.summary?.session_summary;
    if (title) {
      const short = title.length > 32 ? `${title.slice(0, 29)}…` : title;
      parts.push(label(short, colors));
    }
  }

  const liveTag = snap.live ? green(`● ${t('label.live')}`) : dim(`○ ${t('label.stale')}`);
  parts.push(liveTag);

  if (display.showPid && snap.pid) {
    parts.push(dim(`pid ${snap.pid}`));
  }

  return sep(parts);
}

function renderContextLine(snap: SessionSnapshot, ctx: RenderContext): string {
  const { config } = ctx;
  const colors = config.colors;
  const display = config.display;
  const parts: string[] = [];

  const used = snap.signals?.contextTokensUsed ?? 0;
  const total = snap.signals?.contextWindowTokens ?? 0;
  const pct =
    snap.signals?.contextWindowUsage ??
    (total > 0 ? Math.round((used / total) * 100) : 0);
  const warn = display.warningThreshold;
  const crit = display.criticalThreshold;

  if (display.showContextBar) {
    const barStr = bar(pct, 10, colors, warn, crit);
    let value = '';
    switch (display.contextValue) {
      case 'percent':
        value = `${pct}%`;
        break;
      case 'tokens':
        value = total > 0 ? `${formatTokens(used)}/${formatTokens(total)}` : formatTokens(used);
        break;
      case 'remaining':
        value = total > 0 ? `${Math.max(0, 100 - pct)}% left` : `${pct}%`;
        break;
      case 'both':
      default:
        value =
          total > 0
            ? `${pct}% (${formatTokens(used)}/${formatTokens(total)})`
            : `${pct}%`;
        break;
    }
    parts.push(
      `${label(t('label.context'), colors)} ${barStr} ${colorByPercent(value, pct, colors, warn, crit)}`,
    );
  }

  if (display.showDuration) {
    const dur =
      formatDuration(snap.signals?.sessionDurationSeconds) ||
      (snap.openedAt
        ? formatDuration((ctx.now - Date.parse(snap.openedAt)) / 1000)
        : '');
    if (dur) parts.push(`${label(t('label.duration'), colors)} ${stats(dur, colors)}`);
  }

  if (display.showTurns && snap.signals?.turnCount !== undefined) {
    parts.push(
      `${label(t('label.turns'), colors)} ${stats(String(snap.signals.turnCount), colors)}`,
    );
  }

  if (display.showToolCount && snap.signals?.toolCallCount !== undefined) {
    parts.push(
      `${label(t('label.tools'), colors)} ${stats(String(snap.signals.toolCallCount), colors)}`,
    );
  }

  if (display.showLatency && snap.signals?.avgTimeToFirstTokenMs) {
    parts.push(
      `${label(t('label.latency'), colors)} ${stats(formatMs(snap.signals.avgTimeToFirstTokenMs), colors)}`,
    );
  }

  if (display.showLines) {
    const add = snap.signals?.agentLinesAdded ?? 0;
    const del = snap.signals?.agentLinesRemoved ?? 0;
    if (add || del) {
      parts.push(
        `${label(t('label.lines'), colors)} ${green(`+${add}`)} ${red(`-${del}`)}`,
      );
    }
  }

  // High context warning
  if (pct >= crit) {
    parts.push(critical('⚠ context critical', colors));
  } else if (pct >= warn) {
    parts.push(warning('⚠ context high', colors));
  }

  return sep(parts);
}

function renderUsageLine(ctx: RenderContext): string | null {
  const display = ctx.config.display;
  if (display.showUsage === false) return null;
  const usage = ctx.creditUsage;
  if (!usage) return null;

  const threshold = display.usageThreshold ?? 0;
  if (usage.percent < threshold) return null;

  const colors = ctx.config.colors;
  const warn = display.warningThreshold;
  const crit = display.criticalThreshold;
  const usageLabel = label(t('label.usage'), colors);

  if (usage.percent >= 100) {
    const reset = formatResetCountdown(usage.periodEnd, ctx.now);
    const resetPart = reset ? ` (${t('label.resets')} ${reset})` : '';
    return `${usageLabel} ${critical(`⚠ ${t('status.limitReached')}${resetPart}`, colors)}`;
  }

  const periodLabel =
    usage.periodType === 'weekly'
      ? t('label.weekly')
      : usage.periodType === 'monthly'
        ? t('label.monthly')
        : '';

  const barEnabled = display.usageBarEnabled !== false;
  const barStr = barEnabled ? ` ${bar(usage.percent, 10, colors, warn, crit)}` : '';

  let value = `${Math.round(usage.percent)}%`;
  if (
    usage.metric === 'monthly_absolute' &&
    typeof usage.used === 'number' &&
    typeof usage.limit === 'number' &&
    usage.limit > 0
  ) {
    value = `${Math.round(usage.percent)}% (${formatCreditAmount(usage.used)}/${formatCreditAmount(usage.limit)})`;
  }

  const pctStr = colorByPercent(value, usage.percent, colors, warn, crit);
  const periodPart = periodLabel ? ` ${dim(`(${periodLabel})`)}` : '';
  const reset = formatResetCountdown(usage.periodEnd, ctx.now);
  const resetPart = reset ? dim(` · ${t('label.resets')} ${reset}`) : '';

  return `${usageLabel}${barStr} ${pctStr}${periodPart}${resetPart}`;
}

function renderToolsLine(snap: SessionSnapshot, ctx: RenderContext): string | null {
  if (!ctx.config.display.showTools) return null;
  const recent = snap.tools.slice(0, ctx.config.display.maxTools);
  if (recent.length === 0) return null;

  // Collapse completed counts when many
  const running = recent.filter((t) => t.status === 'running' || t.status === 'pending');
  const done = recent.filter((t) => t.status === 'completed');
  const failed = recent.filter((t) => t.status === 'error');

  const chunks: string[] = [];
  for (const tool of running.slice(0, 3)) {
    chunks.push(renderToolLine(tool, ctx.config.colors));
  }
  if (failed.length > 0) {
    chunks.push(renderToolLine(failed[0]!, ctx.config.colors));
  }

  // Aggregate completed by name
  if (done.length > 0 && running.length < 2) {
    const counts = new Map<string, number>();
    for (const t of done) {
      counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    }
    for (const [name, count] of Array.from(counts.entries()).slice(0, 3)) {
      const suffix = count > 1 ? ` ×${count}` : '';
      chunks.push(`${green('✓')} ${toolsColor(name, ctx.config.colors)}${dim(suffix)}`);
    }
  }

  if (chunks.length === 0) return null;
  return chunks.join(' | ');
}

function renderSessionBlock(snap: SessionSnapshot, ctx: RenderContext): string[] {
  const lines: string[] = [];
  if (ctx.config.lineLayout === 'compact') {
    const id = dim(shortSessionId(snap.sessionId));
    const usage = renderUsageLine(ctx);
    lines.push(
      sep(
        [renderIdentityLine(snap, ctx), renderContextLine(snap, ctx), usage ?? '', id].filter(
          Boolean,
        ),
        '  ',
      ),
    );
    return lines;
  }

  lines.push(renderIdentityLine(snap, ctx));
  lines.push(renderContextLine(snap, ctx));
  const usageLine = renderUsageLine(ctx);
  if (usageLine) lines.push(usageLine);
  const toolsLine = renderToolsLine(snap, ctx);
  if (toolsLine) lines.push(toolsLine);
  return lines;
}

export function render(ctx: RenderContext): string {
  if (!ctx.focus && ctx.sessions.length === 0) {
    return `${label(t('label.noSessions'), ctx.config.colors)}\n${dim(t('label.inactiveHint'))}`;
  }

  const blocks: string[] = [];
  const list =
    ctx.config.display.showAllSessions || ctx.sessions.length <= 1
      ? ctx.sessions
      : ctx.focus
        ? [ctx.focus]
        : ctx.sessions.slice(0, 1);

  for (const snap of list) {
    blocks.push(renderSessionBlock(snap, ctx).join('\n'));
  }

  if (!ctx.config.display.showAllSessions && ctx.sessions.length > 1) {
    const others = ctx.sessions.length - 1;
    blocks.push(dim(`(+${others} more session${others > 1 ? 's' : ''} — use --all)`));
  }

  return blocks.join('\n\n');
}

/** Single-line output suitable for tmux status-right */
export function renderTmux(ctx: RenderContext, color = true): string {
  const snap = ctx.focus ?? ctx.sessions[0];
  if (!snap) return color ? dim('grok: —') : 'grok: —';

  const modelId =
    snap.signals?.primaryModelId || snap.summary?.current_model_id || 'grok';
  const used = snap.signals?.contextTokensUsed ?? 0;
  const total = snap.signals?.contextWindowTokens ?? 0;
  const pct =
    snap.signals?.contextWindowUsage ??
    (total > 0 ? Math.round((used / total) * 100) : 0);
  const projectName = projectPath(snap.cwd || '?', ctx.config.pathLevels);
  const branch = snap.gitStatus
    ? ` ${snap.gitStatus.branch}${snap.gitStatus.isDirty ? '*' : ''}`
    : '';
  const live = snap.live ? '●' : '○';
  const usagePct =
    ctx.creditUsage && ctx.config.display.showUsage !== false
      ? Math.round(ctx.creditUsage.percent)
      : null;

  const plain = `grok [${shortModel(modelId)}] ${projectName}${branch} ctx ${pct}% ${formatTokens(used)}${total ? '/' + formatTokens(total) : ''}${usagePct !== null ? ` use ${usagePct}%` : ''} ${live}`;

  if (!color) return plain;

  const colored = sep(
    [
      model(`[${shortModel(modelId)}]`, ctx.config.colors),
      project(projectName, ctx.config.colors) +
        (branch ? ` ${gitBranch(branch.trim(), ctx.config.colors)}` : ''),
      `${label('ctx', ctx.config.colors)} ${colorByPercent(`${pct}%`, pct, ctx.config.colors, ctx.config.display.warningThreshold, ctx.config.display.criticalThreshold)}`,
      usagePct !== null
        ? `${label('use', ctx.config.colors)} ${colorByPercent(`${usagePct}%`, usagePct, ctx.config.colors, ctx.config.display.warningThreshold, ctx.config.display.criticalThreshold)}`
        : '',
      snap.live ? green('●') : dim('○'),
    ].filter(Boolean),
    ' ',
  );
  return colored;
}

export function renderJson(ctx: RenderContext): string {
  const payload = {
    generatedAt: new Date(ctx.now).toISOString(),
    creditUsage: ctx.creditUsage,
    sessions: ctx.sessions.map((s) => ({
      sessionId: s.sessionId,
      cwd: s.cwd,
      live: s.live,
      pid: s.pid,
      model: s.signals?.primaryModelId || s.summary?.current_model_id,
      title: s.summary?.generated_title || s.summary?.session_summary,
      context: {
        percent: s.signals?.contextWindowUsage ?? null,
        used: s.signals?.contextTokensUsed ?? null,
        total: s.signals?.contextWindowTokens ?? null,
      },
      turns: s.signals?.turnCount ?? null,
      toolCallCount: s.signals?.toolCallCount ?? null,
      durationSeconds: s.signals?.sessionDurationSeconds ?? null,
      git: s.gitStatus,
      recentTools: s.tools,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function lineCount(text: string): number {
  return stripAnsi(text).split('\n').length;
}

/** Approximate terminal rows used by text (accounts for line wrap). */
export function visualRowCount(text: string, columns?: number | null): number {
  const cols =
    typeof columns === 'number' && Number.isFinite(columns) && columns > 0
      ? Math.floor(columns)
      : process.stdout?.columns && process.stdout.columns > 0
        ? process.stdout.columns
        : process.stderr?.columns && process.stderr.columns > 0
          ? process.stderr.columns
          : 80;

  let rows = 0;
  for (const line of text.split('\n')) {
    // Wide glyphs (emoji, CJK) roughly as width 2 — good enough for HUD layout.
    let width = 0;
    const plain = stripAnsi(line);
    for (const ch of plain) {
      const code = ch.codePointAt(0) ?? 0;
      if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
        // control
        continue;
      }
      // Rough East Asian / emoji width
      if (
        code >= 0x1100 &&
        (code <= 0x115f ||
          code === 0x2329 ||
          code === 0x232a ||
          (code >= 0x2e80 && code <= 0xa4cf) ||
          (code >= 0xac00 && code <= 0xd7a3) ||
          (code >= 0xf900 && code <= 0xfaff) ||
          (code >= 0xfe10 && code <= 0xfe19) ||
          (code >= 0xfe30 && code <= 0xfe6f) ||
          (code >= 0xff00 && code <= 0xff60) ||
          (code >= 0xffe0 && code <= 0xffe6) ||
          (code >= 0x1f300 && code <= 0x1faff))
      ) {
        width += 2;
      } else {
        width += 1;
      }
    }
    rows += Math.max(1, Math.ceil(Math.max(width, 1) / cols));
  }
  return Math.max(1, rows);
}

export { stripAnsi };
