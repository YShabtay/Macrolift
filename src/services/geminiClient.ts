/**
 * The single door to Gemini. In production every request goes to this site's own `/api/gemini` function (see api/gemini.ts), which holds
 * the API key on the server: a key shipped in the JavaScript bundle can be read by anyone who opens the site and used on their bill.
 * Only `npm run dev` may call Google directly, with a VITE_GEMINI_API_KEY from .env.local - that value is compiled out of production builds.
 */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

// `import.meta.env.DEV` is a build-time constant: in a production build this whole expression folds to `undefined` and the key string is dropped.
const DEV_API_KEY: string | undefined = import.meta.env.DEV ? (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) : undefined;

/**
 * Whether AI features should be offered. In production the server decides (a missing server key surfaces as MissingApiKeyError on first
 * use); in local development it needs the key from .env.local.
 */
export const hasGeminiApiKey: boolean = import.meta.env.DEV ? Boolean(DEV_API_KEY) : true;

/** Thrown when no Gemini key is configured (server or local), so callers can show their dedicated "AI isn't connected" notice. */
export class MissingApiKeyError extends Error {}

export class GeminiRateLimitError extends Error {
  constructor() {
    super('בוצעו יותר מדי בקשות AI בזמן קצר. נסו שוב בעוד כמה דקות.');
    this.name = 'GeminiRateLimitError';
  }
}

/** Sends a generateContent request body and returns the raw response (callers check `ok` and read the JSON as before). */
export async function postToGemini(body: unknown): Promise<Response> {
  if (import.meta.env.DEV) {
    if (!DEV_API_KEY) throw new MissingApiKeyError('VITE_GEMINI_API_KEY is not configured');
    return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': DEV_API_KEY },
      body: JSON.stringify(body),
    });
  }

  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: GEMINI_MODEL, payload: body }),
  });
  if (response.status === 503) throw new MissingApiKeyError('Gemini is not configured on the server');
  if (response.status === 429) throw new GeminiRateLimitError();
  return response;
}
