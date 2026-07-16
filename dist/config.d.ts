import { type TelemetryConfig } from './telemetry.js';
export type LineLayoutType = 'compact' | 'expanded';
export type ContextValueMode = 'percent' | 'tokens' | 'remaining' | 'both';
export type Language = 'en' | 'zh';
export type { TelemetryConfig };
export type HudColorName = 'dim' | 'red' | 'green' | 'yellow' | 'magenta' | 'cyan' | 'brightBlue' | 'brightMagenta';
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
    /**
     * Anonymous opt-in telemetry (default OFF).
     * When enabled, pings an aggregate counter at most once per install + once per day.
     * Never sends cwd, tokens, prompts, or file paths.
     */
    telemetry: TelemetryConfig;
    colors: HudColorOverrides;
}
export declare const DEFAULT_CONFIG: HudConfig;
export declare function loadConfig(overrides?: Partial<HudConfig>): HudConfig;
export declare function defaultConfigPath(grokHome?: string): string;
/** Read-modify-write user config.json (creates defaults if missing). */
export declare function updateUserConfig(grokHome: string, mutator: (cfg: Record<string, unknown>) => void): string;
//# sourceMappingURL=config.d.ts.map