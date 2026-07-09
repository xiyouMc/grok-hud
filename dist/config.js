import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
export const DEFAULT_CONFIG = {
    language: 'en',
    lineLayout: 'expanded',
    pathLevels: 2,
    refreshMs: 1000,
    grokHome: path.join(os.homedir(), '.grok'),
    gitStatus: {
        enabled: true,
        showDirty: true,
        showAheadBehind: false,
    },
    display: {
        showModel: true,
        showProject: true,
        showContextBar: true,
        contextValue: 'both',
        showUsage: true,
        usageBarEnabled: true,
        usageThreshold: 0,
        showDuration: true,
        showTurns: true,
        showToolCount: true,
        showTools: true,
        showLatency: false,
        showLines: false,
        showSessionTitle: true,
        showPid: false,
        showAllSessions: false,
        maxTools: 5,
        warningThreshold: 70,
        criticalThreshold: 90,
    },
    usage: {
        cacheTtlMs: 60_000,
    },
    colors: {
        context: 'green',
        warning: 'yellow',
        critical: 'red',
        model: 'cyan',
        project: 'yellow',
        git: 'magenta',
        gitBranch: 'cyan',
        label: 'dim',
        tools: 'brightBlue',
        stats: 'dim',
    },
};
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function deepMerge(base, override) {
    const out = { ...base };
    for (const [key, value] of Object.entries(override)) {
        if (value === undefined)
            continue;
        const current = out[key];
        if (isObject(current) && isObject(value)) {
            out[key] = deepMerge(current, value);
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
function configPaths(grokHome) {
    return [
        path.join(grokHome, 'plugins', 'grok-hud', 'config.json'),
        path.join(grokHome, 'grok-hud', 'config.json'),
        path.join(os.homedir(), '.config', 'grok-hud', 'config.json'),
        path.join(process.cwd(), 'grok-hud.config.json'),
    ];
}
export function loadConfig(overrides = {}) {
    let config = structuredClone(DEFAULT_CONFIG);
    if (overrides.grokHome) {
        config.grokHome = overrides.grokHome;
    }
    for (const file of configPaths(config.grokHome)) {
        try {
            if (!fs.existsSync(file))
                continue;
            const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
            config = deepMerge(config, raw);
            break;
        }
        catch {
            // ignore invalid config files and try next path
        }
    }
    config = deepMerge(config, overrides);
    if (!config.grokHome) {
        config.grokHome = path.join(os.homedir(), '.grok');
    }
    return config;
}
export function defaultConfigPath(grokHome) {
    const home = grokHome ?? path.join(os.homedir(), '.grok');
    return path.join(home, 'plugins', 'grok-hud', 'config.json');
}
//# sourceMappingURL=config.js.map