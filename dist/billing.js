import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
const BILLING_URL = 'https://cli-chat-proxy.grok.com/v1/billing?format=credits';
const DEFAULT_TTL_MS = 60_000;
const FAILURE_TTL_MS = 30_000;
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
        const payload = { fetchedAt: data.fetchedAt, data };
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
function parseCreditsResponse(body) {
    if (!body || typeof body !== 'object')
        return null;
    const root = body;
    const config = (root.config ?? root);
    if (!config || typeof config !== 'object')
        return null;
    const percentRaw = config.creditUsagePercent;
    let percent = typeof percentRaw === 'number' && Number.isFinite(percentRaw) ? percentRaw : null;
    // Fallback: productUsage[0].usagePercent
    if (percent === null && Array.isArray(config.productUsage) && config.productUsage[0]) {
        const p = config.productUsage[0].usagePercent;
        if (typeof p === 'number' && Number.isFinite(p))
            percent = p;
    }
    if (percent === null)
        return null;
    const period = (config.currentPeriod ?? {});
    const periodType = mapPeriodType(typeof period.type === 'string' ? period.type : undefined);
    let product = null;
    if (Array.isArray(config.productUsage) && config.productUsage[0]) {
        const name = config.productUsage[0].product;
        if (typeof name === 'string')
            product = name;
    }
    return {
        percent: Math.max(0, Math.min(100, percent)),
        periodType,
        periodStart: (typeof period.start === 'string' && period.start) ||
            (typeof config.billingPeriodStart === 'string' && config.billingPeriodStart) ||
            null,
        periodEnd: (typeof period.end === 'string' && period.end) ||
            (typeof config.billingPeriodEnd === 'string' && config.billingPeriodEnd) ||
            null,
        product,
    };
}
function httpsGetJson(url, token, timeoutMs = 8000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json',
                'User-Agent': 'grok-hud/0.1',
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
 * Fetch weekly/period credit usage from Grok's billing API.
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
        const json = await httpsGetJson(BILLING_URL, token);
        const parsed = parseCreditsResponse(json);
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
        // On failure, return stale cache if any (even past TTL, short failure window)
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
    let ms = end - now;
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
//# sourceMappingURL=billing.js.map