export const en = {
  'label.context': 'Context',
  'label.usage': 'Usage',
  'label.tools': 'Tools',
  'label.turns': 'Turns',
  'label.duration': 'Time',
  'label.latency': 'TTFT',
  'label.lines': 'Lines',
  'label.session': 'Session',
  'label.live': 'live',
  'label.stale': 'stale',
  'label.noSessions': 'No Grok sessions found',
  'label.inactiveHint': 'Start grok or pass --cwd / --session',
  'status.running': 'running',
  'status.completed': 'done',
  'status.error': 'error',
  'status.pending': 'pending',
  'init.banner': 'grok-hud — real-time HUD for Grok (inspired by claude-hud)',
  'init.help': 'Try: grok-hud --watch   or   grok-hud --tmux',
} as const;

export type MessageKey = keyof typeof en;
