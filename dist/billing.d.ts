export interface CreditUsage {
    /** 0–100 weekly (or current period) credit usage percent */
    percent: number;
    periodType: 'weekly' | 'monthly' | 'unknown';
    periodStart: string | null;
    periodEnd: string | null;
    /** Optional absolute credits when available from non-format endpoint */
    used?: number | null;
    limit?: number | null;
    product?: string | null;
    fetchedAt: string;
    source: 'live' | 'cache';
}
/**
 * Fetch weekly/period credit usage from Grok's billing API.
 * Cached under ~/.grok/plugins/grok-hud/billing-cache.json.
 */
export declare function getCreditUsage(options: {
    grokHome: string;
    ttlMs?: number;
    force?: boolean;
}): Promise<CreditUsage | null>;
export declare function formatResetCountdown(periodEnd: string | null, now?: number): string;
//# sourceMappingURL=billing.d.ts.map