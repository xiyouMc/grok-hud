import type { HudConfig } from './config.js';
import type { GitStatus } from './git.js';

/** Subset of ~/.grok/active_sessions.json entries */
export interface ActiveSession {
  session_id: string;
  pid?: number;
  cwd?: string;
  opened_at?: string;
}

/** Subset of session summary.json */
export interface SessionSummary {
  info?: {
    id?: string;
    cwd?: string;
  };
  session_summary?: string;
  generated_title?: string;
  created_at?: string;
  updated_at?: string;
  last_active_at?: string;
  current_model_id?: string;
  head_branch?: string;
  head_commit?: string;
  git_root_dir?: string;
  num_messages?: number;
  num_chat_messages?: number;
  agent_name?: string;
  reasoning_effort?: string;
}

/** Subset of session signals.json */
export interface SessionSignals {
  turnCount?: number;
  userMessageCount?: number;
  assistantMessageCount?: number;
  errorCount?: number;
  toolFailureCount?: number;
  contextWindowUsage?: number;
  contextTokensUsed?: number;
  contextWindowTokens?: number;
  toolCallCount?: number;
  toolsUsed?: string[];
  modelsUsed?: string[];
  primaryModelId?: string;
  sessionDurationSeconds?: number;
  avgTimeToFirstTokenMs?: number;
  avgResponseTimeMs?: number;
  agentLinesAdded?: number;
  agentLinesRemoved?: number;
  agentFilesTouched?: number;
  totalFilesTouched?: number;
  peakRssBytes?: number;
  compactionCount?: number;
}

export type ToolStatus = 'running' | 'completed' | 'error' | 'pending';

export interface ToolEntry {
  id: string;
  name: string;
  target?: string;
  status: ToolStatus;
  startTime?: Date;
  endTime?: Date;
}

export interface SessionSnapshot {
  sessionId: string;
  cwd: string;
  dir: string;
  pid?: number;
  openedAt?: string;
  live: boolean;
  summary: SessionSummary | null;
  signals: SessionSignals | null;
  tools: ToolEntry[];
  gitStatus: GitStatus | null;
}

export interface RenderContext {
  sessions: SessionSnapshot[];
  focus: SessionSnapshot | null;
  config: HudConfig;
  now: number;
}
