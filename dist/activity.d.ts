import type { ToolEntry } from './types.js';
/**
 * Parse recent tool activity from updates.jsonl.
 * Reads the tail of the file for speed.
 */
export declare function parseRecentTools(updatesPath: string, limit?: number): ToolEntry[];
//# sourceMappingURL=activity.d.ts.map