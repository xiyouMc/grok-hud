import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
const CREDITS_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
const MONTHLY_URL = 'https://cli-chat-proxy.grok.com/v1/billing';
const DEFAULT_TTL_MS = 60_000;
const FAILURE_TTL_MS = 30_000;
/** Bump when cache shape / merge logic changes so stale entries are ignored. */
const CACHE_VERSION = 2;
function readAuthToken(grokHome) {
    const authPath = path.join(grokHome, 'auth.json');
    try {
        if (!fs.existsSync(authPath))
            return null;
        const raw = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        for (const entry of Object.values(raw)) {
            const token = entry?.key || entry?.access_token;
            if (typeof token === 'string' && token.length > 10) {
                return token;
            }
        }
    }
    catch {
        // ignore
    }
    return null;
}
function cachePath(grokHome) {
    return path.join(grokHome, 'plugins', 'grok-hud', 'billing-cache.json');
}
function readCache(grokHome, ttlMs) {
    try {
        const file = cachePath(grokHome);
        if (!fs.existsSync(file))
            return null;
        const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (cached.version !== CACHE_VERSION)
            return null;
        const age = Date.now() - Date.parse(cached.fetchedAt);
        if (!Number.isFinite(age) || age < 0 || age > ttlMs)
            return null;
        if (!cached.data || typeof cached.data.percent !== 'number')
            return null;
        return { ...cached.data, source: 'cache' };
    }
    catch {
        return null;
    }
}
function writeCache(grokHome, data) {
    try {
        const file = cachePath(grokHome);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const payload = {
            version: CACHE_VERSION,
            fetchedAt: data.fetchedAt,
            data,
        };
        fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    }
    catch {
        // ignore cache write failures
    }
}
function mapPeriodType(raw) {
    if (!raw)
        return 'unknown';
    const u = raw.toUpperCase();
    if (u.includes('WEEK'))
        return 'weekly';
    if (u.includes('MONTH'))
        return 'monthly';
    return 'unknown';
}
function numVal(obj) {
    if (typeof obj === 'number' && Number.isFinite(obj))
        return obj;
    if (obj && typeof obj === 'object' && 'val' in obj) {
        const v = obj.val;
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
    }
    return null;
}
function parseCreditsOnly(body) {
    if (!body || typeof body !== 'object')
        return null;
    const root = body;
    const config = (root.config ?? root);
    if (!config || typeof config !== 'object')
        return null;
    let percent = typeof config.creditUsagePercent === 'number' && Number.isFinite(config.creditUsagePercent)
        ? config.creditUsagePercent
        : null;
    if (percent === null && Array.isArray(config.productUsage) && config.productUsage[0]) {
        const p = config.productUsage[0].usagePercent;
        if (typeof p === 'number' && Number.isFinite(p))
            percent = p;
    }
    const period = (config.currentPeriod ?? {});
    let product = null;
    if (Array.isArray(config.productUsage) && config.productUsage[0]) {
        const name = config.productUsage[0].product;
        if (typeof name === 'string')
            product = name;
    }
    return {
        percent: percent === null ? undefined : Math.max(0, Math.min(100, percent)),
        periodType: mapPeriodType(typeof period.type === 'string' ? period.type : undefined),
        periodStart: (typeof period.start === 'string' && period.start) ||
            (typeof config.billingPeriodStart === 'string' && config.billingPeriodStart) ||
            null,
        periodEnd: (typeof period.end === 'string' && period.end) ||
            (typeof config.billingPeriodEnd === 'string' && config.billingPeriodEnd) ||
            null,
        product,
        metric: percent !== null ? 'weekly_percent' : undefined,
    };
}
function parseMonthlyOnly(body) {
    if (!body || typeof body !== 'object')
        return null;
    const root = body;
    const config = (root.config ?? root);
    if (!config || typeof config !== 'object')
        return null;
    const used = numVal(config.used);
    const limit = numVal(config.monthlyLimit);
    if (used === null || limit === null || limit <= 0)
        return null;
    const percent = Math.max(0, Math.min(100, (used / limit) * 100));
    return {
        percent,
        periodType: 'monthly',
        periodStart: typeof config.billingPeriodStart === 'string' ? config.billingPeriodStart : null,
        periodEnd: typeof config.billingPeriodEnd === 'string' ? config.billingPeriodEnd : null,
        used,
        limit,
        metric: 'monthly_absolute',
    };
}
/**
 * Prefer weekly percent when API still provides it; otherwise fall back to
 * monthly used/monthlyLimit. Keep weekly period end for reset countdown when present.
 */
export function mergeBillingResponses(creditsBody, monthlyBody) {
    const credits = parseCreditsOnly(creditsBody);
    const monthly = parseMonthlyOnly(monthlyBody);
    // Best case: weekly percentage still present
    if (credits && typeof credits.percent === 'number') {
        return {
            percent: credits.percent,
            periodType: credits.periodType === 'unknown' ? 'weekly' : (credits.periodType ?? 'weekly'),
            periodStart: credits.periodStart ?? monthly?.periodStart ?? null,
            periodEnd: credits.periodEnd ?? monthly?.periodEnd ?? null,
            used: monthly?.used ?? null,
            limit: monthly?.limit ?? null,
            product: credits.product ?? null,
            metric: 'weekly_percent',
        };
    }
    // Fallback: monthly absolute credits (API often omits weekly % now)
    if (monthly && typeof monthly.percent === 'number') {
        return {
            percent: monthly.percent,
            periodType: 'monthly',
            periodStart: monthly.periodStart ?? credits?.periodStart ?? null,
            periodEnd: monthly.periodEnd ?? credits?.periodEnd ?? null,
            used: monthly.used ?? null,
            limit: monthly.limit ?? null,
            product: credits?.product ?? null,
            metric: 'monthly_absolute',
        };
    }
    // Credits has period metadata only — not enough for a bar
    return null;
}
function httpsGetJson(url, token, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'User-Agent': 'grok-hud/0.1.3',
                'x-grok-client-version': '0.2.93',
            },
            timeout: timeoutMs,
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                if ((res.statusCode ?? 500) >= 400) {
                    reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 120)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(text));
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
}
/**
 * Fetch credit usage from Grok's billing API (weekly % preferred, monthly fallback).
 * Cached under ~/.grok/plugins/grok-hud/billing-cache.json.
 */
export async function getCreditUsage(options) {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    if (!options.force) {
        const cached = readCache(options.grokHome, ttlMs);
        if (cached)
            return cached;
    }
    const token = readAuthToken(options.grokHome);
    if (!token)
        return null;
    try {
        const results = await Promise.allSettled([
            httpsGetJson(CREDITS_URL, token),
            httpsGetJson(MONTHLY_URL, token),
        ]);
        const creditsBody = results[0].status === 'fulfilled' ? results[0].value : null;
        const monthlyBody = results[1].status === 'fulfilled' ? results[1].value : null;
        if (!creditsBody && !monthlyBody) {
            throw new Error('both billing endpoints failed');
        }
        const parsed = mergeBillingResponses(creditsBody, monthlyBody);
        if (!parsed)
            return null;
        const data = {
            ...parsed,
            fetchedAt: new Date().toISOString(),
            source: 'live',
        };
        writeCache(options.grokHome, data);
        return data;
    }
    catch {
        const stale = readCache(options.grokHome, Math.max(ttlMs, FAILURE_TTL_MS * 10));
        if (stale)
            return { ...stale, source: 'cache' };
        return null;
    }
}
export function formatResetCountdown(periodEnd, now = Date.now()) {
    if (!periodEnd)
        return '';
    const end = Date.parse(periodEnd);
    if (!Number.isFinite(end))
        return '';
    const ms = end - now;
    if (ms <= 0)
        return 'soon';
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 48) {
        const h = Math.max(1, hours);
        return `${h}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
}
export function formatCreditAmount(n) {
    if (!Number.isFinite(n) || n < 0)
        return '0';
    if (n >= 1_000_000)
        return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000)
        return `${Math.round(n / 1000)}k`;
    if (n >= 1000)
        return `${(n / 1000).toFixed(1)}k`;
    return String(Math.round(n));
}
//# sourceMappingURL=billing.js.map