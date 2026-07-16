export interface CreditUsage {
    /** 0–100 usage percent for the primary bar */
    percent: number;
    /** Primary bar period type (what the % refers to) */
    periodType: 'weekly' | 'monthly' | 'unknown';
    periodStart: string | null;
    periodEnd: string | null;
    /**
     * Weekly window from format=credits (often still present even when weekly % is gone).
     * Used to show "week ends / resets" alongside a monthly usage bar.
     */
    weekStart?: string | null;
    weekEnd?: string | null;
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
 * monthly used/monthlyLimit. Always keep weekly window metadata when present
 * so the HUD can show "week ends / resets" next to a monthly bar.
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