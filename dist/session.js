import * as fs from 'node:fs';
import * as path from 'node:path';
import { getGitStatus } from './git.js';
import { parseRecentTools } from './activity.js';
/** Best-effort context tokens from the tail of updates.jsonl */
function estimateTokensFromUpdates(updatesPath) {
    if (!fs.existsSync(updatesPath))
        return 0;
    try {
        const stat = fs.statSync(updatesPath);
        const fd = fs.openSync(updatesPath, 'r');
        try {
            const maxBytes = Math.min(stat.size, 64 * 1024);
            const start = Math.max(0, stat.size - maxBytes);
            const buf = Buffer.alloc(maxBytes);
            const read = fs.readSync(fd, buf, 0, maxBytes, start);
            const content = buf.subarray(0, read).toString('utf8');
            let best = 0;
            for (const line of content.split('\n')) {
                if (!line.includes('totalTokens'))
                    continue;
                try {
                    const o = JSON.parse(line);
                    const n = o.params?._meta?.totalTokens;
                    if (typeof n === 'number' && n > best)
                        best = n;
                }
                catch {
                    // skip
                }
            }
            return best;
        }
        finally {
            fs.closeSync(fd);
        }
    }
    catch {
        return 0;
    }
}
function readJsonFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    catch {
        return null;
    }
}
function encodeCwdSegment(cwd) {
    // Grok stores cwd as path segments joined by %2F (URL-encoded /)
    return cwd
        .split(path.sep)
        .filter((p, i) => !(i === 0 && p === ''))
        .map((seg) => encodeURIComponent(seg))
        .join('%2F')
        .replace(/^/, cwd.startsWith('/') ? '%2F' : '');
}
export function sessionDirFor(grokHome, cwd, sessionId) {
    return path.join(grokHome, 'sessions', encodeCwdSegment(cwd), sessionId);
}
/** Find session directory by walking sessions tree (fallback). */
export function findSessionDir(grokHome, sessionId) {
    const root = path.join(grokHome, 'sessions');
    if (!fs.existsSync(root))
        return null;
    try {
        for (const cwdEnc of fs.readdirSync(root)) {
            if (cwdEnc.startsWith('.') || cwdEnc === 'session_search.sqlite')
                continue;
            const candidate = path.join(root, cwdEnc, sessionId);
            if (fs.existsSync(path.join(candidate, 'summary.json')) || fs.existsSync(candidate)) {
                if (fs.statSync(candidate).isDirectory()) {
                    return candidate;
                }
            }
        }
    }
    catch {
        // ignore
    }
    return null;
}
function isPidAlive(pid) {
    if (!pid || pid <= 0)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
export function loadActiveSessions(grokHome) {
    const file = path.join(grokHome, 'active_sessions.json');
    const data = readJsonFile(file);
    if (!Array.isArray(data))
        return [];
    return data.filter((s) => s && typeof s.session_id === 'string');
}
/** List recent sessions from disk, newest first. */
export function listRecentSessions(grokHome, limit = 20) {
    const root = path.join(grokHome, 'sessions');
    const out = [];
    if (!fs.existsSync(root))
        return out;
    try {
        for (const cwdEnc of fs.readdirSync(root)) {
            if (cwdEnc.startsWith('.') || !cwdEnc.includes('%'))
                continue;
            const cwdDir = path.join(root, cwdEnc);
            let st;
            try {
                st = fs.statSync(cwdDir);
            }
            catch {
                continue;
            }
            if (!st.isDirectory())
                continue;
            for (const sessionId of fs.readdirSync(cwdDir)) {
                const dir = path.join(cwdDir, sessionId);
                try {
                    const s = fs.statSync(dir);
                    if (!s.isDirectory())
                        continue;
                    if (!fs.existsSync(path.join(dir, 'summary.json')) && !fs.existsSync(path.join(dir, 'signals.json'))) {
                        continue;
                    }
                    out.push({ sessionId, dir, mtime: s.mtimeMs });
                }
                catch {
                    // skip
                }
            }
        }
    }
    catch {
        // ignore
    }
    out.sort((a, b) => b.mtime - a.mtime);
    return out.slice(0, limit);
}
export async function loadSessionSnapshot(options) {
    const { grokHome, sessionId, enableGit, maxTools } = options;
    let dir = null;
    if (options.cwd) {
        dir = sessionDirFor(grokHome, options.cwd, sessionId);
        if (!fs.existsSync(dir))
            dir = null;
    }
    if (!dir) {
        dir = findSessionDir(grokHome, sessionId);
    }
    if (!dir)
        return null;
    const summary = readJsonFile(path.join(dir, 'summary.json'));
    let signals = readJsonFile(path.join(dir, 'signals.json'));
    const cwd = options.cwd || summary?.info?.cwd || summary?.git_root_dir || '';
    const tools = parseRecentTools(path.join(dir, 'updates.jsonl'), maxTools * 3).slice(0, maxTools);
    // Young sessions may lack signals.json; estimate context from latest updates totalTokens
    if (!signals || signals.contextTokensUsed == null) {
        const estimated = estimateTokensFromUpdates(path.join(dir, 'updates.jsonl'));
        if (estimated > 0) {
            signals = {
                ...(signals ?? {}),
                contextTokensUsed: signals?.contextTokensUsed ?? estimated,
                contextWindowTokens: signals?.contextWindowTokens ?? 500_000,
                contextWindowUsage: signals?.contextWindowUsage ??
                    Math.round((estimated / (signals?.contextWindowTokens ?? 500_000)) * 100),
                primaryModelId: signals?.primaryModelId ?? summary?.current_model_id,
            };
        }
    }
    const gitStatus = enableGit && cwd ? await getGitStatus(cwd) : null;
    return {
        sessionId,
        cwd,
        dir,
        pid: options.pid,
        openedAt: options.openedAt,
        live: isPidAlive(options.pid),
        summary,
        signals,
        tools,
        gitStatus,
    };
}
export async function collectSnapshots(options) {
    const { grokHome, enableGit, maxTools } = options;
    const active = loadActiveSessions(grokHome);
    const snapshots = [];
    const seen = new Set();
    const candidates = [];
    if (options.sessionId) {
        const match = active.find((a) => a.session_id === options.sessionId);
        candidates.push(match ?? {
            session_id: options.sessionId,
            cwd: options.cwdFilter,
        });
    }
    else if (options.cwdFilter) {
        const norm = path.resolve(options.cwdFilter);
        const filtered = active.filter((a) => a.cwd && path.resolve(a.cwd) === norm);
        if (filtered.length > 0) {
            candidates.push(...filtered);
        }
        else if (options.includeInactive !== false) {
            // fall back to most recent session under this cwd encoding
            const encoded = encodeCwdSegment(norm);
            const dir = path.join(grokHome, 'sessions', encoded);
            if (fs.existsSync(dir)) {
                const sessions = fs
                    .readdirSync(dir)
                    .map((id) => {
                    const p = path.join(dir, id);
                    try {
                        return { id, mtime: fs.statSync(p).mtimeMs };
                    }
                    catch {
                        return null;
                    }
                })
                    .filter((x) => !!x)
                    .sort((a, b) => b.mtime - a.mtime);
                if (sessions[0]) {
                    candidates.push({ session_id: sessions[0].id, cwd: norm });
                }
            }
        }
    }
    else {
        candidates.push(...active);
        if (candidates.length === 0 && options.includeInactive !== false) {
            for (const recent of listRecentSessions(grokHome, 3)) {
                candidates.push({ session_id: recent.sessionId });
            }
        }
    }
    for (const c of candidates) {
        if (seen.has(c.session_id))
            continue;
        seen.add(c.session_id);
        const snap = await loadSessionSnapshot({
            grokHome,
            sessionId: c.session_id,
            cwd: c.cwd,
            pid: c.pid,
            openedAt: c.opened_at,
            enableGit,
            maxTools,
        });
        if (snap)
            snapshots.push(snap);
    }
    // Prefer live sessions, then most recently updated
    snapshots.sort((a, b) => {
        if (a.live !== b.live)
            return a.live ? -1 : 1;
        const at = Date.parse(a.summary?.last_active_at || a.summary?.updated_at || a.openedAt || '0');
        const bt = Date.parse(b.summary?.last_active_at || b.summary?.updated_at || b.openedAt || '0');
        return bt - at;
    });
    return snapshots;
}
//# sourceMappingURL=session.js.map