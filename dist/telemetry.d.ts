export interface TelemetryConfig {
    enabled: boolean;
    /**
     * Optional custom endpoint.
     * - empty: use built-in CounterAPI (aggregate installs/starts only)
     * - http(s): POST JSON payload for self-hosted collectors
     */
    endpoint: string;
}
export declare const DEFAULT_TELEMETRY: TelemetryConfig;
interface TelemetryState {
    installId: string;
    firstInstallPinged: boolean;
    lastStartDay: string | null;
    enabled: boolean;
}
/**
 * Fire-and-forget anonymous telemetry.
 * Default OFF. When enabled:
 * - first run: count as one install
 * - at most one "start" ping per UTC day
 *
 * Does NOT send: cwd, paths, tokens, email, prompts, or session content.
 */
export declare function maybePingTelemetry(options: {
    grokHome: string;
    telemetry: TelemetryConfig;
    mode: 'once' | 'watch' | 'tmux' | 'json';
}): Promise<void>;
export declare function setTelemetryEnabled(grokHome: string, enabled: boolean): TelemetryState;
export declare function telemetryStatus(grokHome: string, telemetry: TelemetryConfig): Promise<string>;
export {};
//# sourceMappingURL=telemetry.d.ts.map