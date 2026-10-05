/**
 * Vercel serverless function: the only place the Gemini API key lives. The browser sends { model, payload } here and this forwards it to
 * Google, so the key is never part of the site's JavaScript. Set GEMINI_API_KEY in the Vercel project's environment variables (NOT a
 * VITE_ variable - those are compiled into the public bundle).
 *
 * Protections (best effort - serverless instances are short-lived, so counters are per instance; the real spending limit is a quota on the key
 * in Google Cloud): same-origin only (no CORS headers), model allow-list, request size and token caps, and a per-IP rate limit.
 */

interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

const ALLOWED_MODELS = new Set(['gemini-3.5-flash-lite']);
const MAX_BODY_CHARS = 4_000_000;
const MAX_OUTPUT_TOKENS = 4096;
const UPSTREAM_TIMEOUT_MS = 25_000;

/** At most this many requests per IP in the window. */
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function clientIp(req: ApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || 'unknown';
}

/** Records a request and returns true when this IP is over its limit. */
function isRateLimited(ip: string, now: number = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) for (const [key, times] of hits) if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(key);
  return false;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey = process.env.GEMINI_API_KEY;

  // Lets the app (and you) see whether the server side is configured, without revealing anything about the key.
  if (req.method === 'GET') {
    res.status(200).json({ enabled: Boolean(apiKey) });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  if (!apiKey) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  // Browsers always send Origin on a cross-origin POST; the site's own pages send the same host (or nothing).
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (typeof origin === 'string' && typeof host === 'string') {
    try {
      if (new URL(origin).host !== host) {
        res.status(403).json({ error: 'forbidden_origin' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'forbidden_origin' });
      return;
    }
  }

  if (isRateLimited(clientIp(req))) {
    res.status(429).json({ error: 'rate_limited' });
    return;
  }

  const body = req.body;
  if (!isObject(body) || typeof body.model !== 'string' || !ALLOWED_MODELS.has(body.model) || !isObject(body.payload)) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  const payload = body.payload;
  if (!Array.isArray(payload.contents) || payload.contents.length === 0 || JSON.stringify(payload).length > MAX_BODY_CHARS) {
    res.status(400).json({ error: 'bad_request' });
    return;
  }
  // Only what the app itself sends is forwarded: no tools, and a hard ceiling on the answer length.
  const generationConfig = isObject(payload.generationConfig) ? { ...payload.generationConfig } : {};
  const requested = typeof generationConfig.maxOutputTokens === 'number' ? generationConfig.maxOutputTokens : MAX_OUTPUT_TOKENS;
  generationConfig.maxOutputTokens = Math.min(requested, MAX_OUTPUT_TOKENS);
  const upstreamBody = {
    contents: payload.contents,
    ...(payload.systemInstruction !== undefined ? { systemInstruction: payload.systemInstruction } : {}),
    generationConfig,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${body.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });
    const text = await upstream.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: 'bad_upstream_response' };
    }
    res.status(upstream.ok ? 200 : upstream.status === 429 ? 429 : 502).json(upstream.ok ? data : { error: 'upstream_error', status: upstream.status });
  } catch {
    res.status(504).json({ error: 'upstream_timeout' });
  } finally {
    clearTimeout(timer);
  }
}
