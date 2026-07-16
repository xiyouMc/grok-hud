export interface CreditUsage {
    /** 0–100 usage percent for the active period */
    percent: number;
    periodType: 'weekly' | 'monthly' | 'unknown';
    periodStart: string | null;
    periodEnd: string | null;
    /** Absolute credits when available (usually monthly endpoint) */
    used?: number | null;
    limit?: number | null;
    product?: string | null;
    /** Which API field supplied the percentage */
    metric: 'weekly_percent' | 'monthly_absolute' | 'unknown';
    fetchedAt: string;
    source: 'live' | 'cache';
}
/**
 * Prefer weekly percent when API still provides it; otherwise fall back to
 * monthly used/monthlyLimit. Keep weekly period end for reset countdown when present.
 */
export declare function mergeBillingResponses(creditsBody: unknown, monthlyBody: unknown): Omit<CreditUsage, 'fetchedAt' | 'source'> | null;
/**
 * Fetch credit usage from Grok's billing API (weekly % preferred, monthly fallback).
 * Cached under ~/.grok/plugins/grok-hud/billing-cache.json.
 */
export declare function getCreditUsage(options: {
    grokHome: string;
    ttlMs?: number;
    force?: boolean;
}): Promise<CreditUsage | null>;
export declare function formatResetCountdown(periodEnd: string | null, now?: number): string;
export declare function formatCreditAmount(n: number): string;
//# sourceMappingURL=billing.d.ts.map