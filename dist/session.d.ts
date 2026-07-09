import type { ActiveSession, SessionSnapshot } from './types.js';
export declare function sessionDirFor(grokHome: string, cwd: string, sessionId: string): string;
/** Find session directory by walking sessions tree (fallback). */
export declare function findSessionDir(grokHome: string, sessionId: string): string | null;
export declare function loadActiveSessions(grokHome: string): ActiveSession[];
/** List recent sessions from disk, newest first. */
export declare function listRecentSessions(grokHome: string, limit?: number): Array<{
    sessionId: string;
    dir: string;
    mtime: number;
}>;
export declare function loadSessionSnapshot(options: {
    grokHome: string;
    sessionId: string;
    cwd?: string;
    pid?: number;
    openedAt?: string;
    enableGit: boolean;
    maxTools: number;
}): Promise<SessionSnapshot | null>;
export declare function collectSnapshots(options: {
    grokHome: string;
    cwdFilter?: string;
    sessionId?: string;
    enableGit: boolean;
    maxTools: number;
    includeInactive?: boolean;
}): Promise<SessionSnapshot[]>;
//# sourceMappingURL=session.d.ts.map