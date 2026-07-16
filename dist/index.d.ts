#!/usr/bin/env node
export interface CliOptions {
    watch: boolean;
    once: boolean;
    tmux: boolean;
    json: boolean;
    all: boolean;
    noColor: boolean;
    plain: boolean;
    cwd?: string;
    session?: string;
    grokHome?: string;
    refreshMs?: number;
    initConfig: boolean;
    help: boolean;
    version: boolean;
    /** on | off | status */
    telemetryCmd?: 'on' | 'off' | 'status';
}
//# sourceMappingURL=index.d.ts.map