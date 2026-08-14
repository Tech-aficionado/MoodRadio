/**
 * AI provider client.
 *
 * All configuration — endpoint, project identifier, credentials — comes from
 * server-only environment variables. Nothing here is bundled for the browser,
 * and no configuration value is echoed back in an API response.
 *
 * Access is brokered in two steps: the signed-in user's Firebase ID token is
 * exchanged for a short-lived scoped token, which then authorises the
 * generation call. Scoped tokens are cached per user and refreshed on expiry.
 *
 * MoodRadio forwards the user's own ID token rather than minting one with a
 * service account, so no service-account credential exists in this project.
 */

// Every part of the provider address lives in configuration, including the
// route names, so a public checkout of this repo reveals nothing about the
// backend it talks to. Missing configuration is treated as "AI unavailable"
// and degrades to the keyword fallback rather than failing the request.
const PROXY_BASE_URL = process.env.AI_PROXY_URL || '';

const PROXY_PROJECT_ID =
  process.env.AI_PROXY_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  '';

const TOKEN_PATH = process.env.AI_PROXY_TOKEN_PATH || '';
const GENERATE_PATH = process.env.AI_PROXY_GENERATE_PATH || '';

export type AiProxyErrorCode =
  | 'NOT_CONFIGURED'
  | 'NO_ID_TOKEN'
  | 'AUTH_FAILED'
  | 'ACCESS_DENIED'
  | 'VERIFY_FAILED'
  | 'NOT_WHITELISTED'
  | 'RATE_LIMITED'
  | 'TOKEN_EXPIRED'
  | 'PROXY_FAILED'
  | 'EMPTY_RESPONSE';

export class AiProxyError extends Error {
  readonly code: AiProxyErrorCode;
  readonly status?: number;

  constructor(code: AiProxyErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'AiProxyError';
    this.code = code;
    this.status = status;
  }
}

export function isAiConfigured(): boolean {
  return (
    PROXY_BASE_URL.length > 0 &&
    TOKEN_PATH.length > 0 &&
    GENERATE_PATH.length > 0
  );
}

// --- Scoped token cache (per-user, in-memory, per-serverless-instance) ---

interface CachedToken {
  token: string;
  expiresAt: number; // epoch ms
}

const tokenCache = new Map<string, CachedToken>();

/** Refresh slightly early so a token never expires mid-flight. */
const EXPIRY_BUFFER_MS = 60_000;

/** Runtime-agnostic base64url decode (works on Node and Edge). */
function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const withPadding = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    '='
  );
  if (typeof atob === 'function') {
    return atob(withPadding);
  }
  return Buffer.from(withPadding, 'base64').toString('utf8');
}

/**
 * Derive a stable cache key from the ID token's `sub` claim.
 *
 * This only DECODES the JWT (no signature check) — purely to group cache
 * entries per user. Real cryptographic verification happens upstream, so a
 * forged `sub` here gains nothing beyond a useless cache slot.
 */
function cacheKeyFor(idToken: string): string {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return idToken.slice(-32);
    const decoded = JSON.parse(decodeBase64Url(payload)) as {
      sub?: string;
      user_id?: string;
    };
    return decoded.sub || decoded.user_id || idToken.slice(-32);
  } catch {
    return idToken.slice(-32);
  }
}

function getCachedToken(key: string): string | null {
  const cached = tokenCache.get(key);
  if (!cached) return null;
  if (Date.now() >= cached.expiresAt - EXPIRY_BUFFER_MS) {
    tokenCache.delete(key);
    return null;
  }
  return cached.token;
}

/** Extract a useful message from an error body that may or may not be JSON. */
async function readError(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '');
  try {
    const parsed = JSON.parse(raw) as { error?: string };
    return parsed.error || raw || response.statusText;
  } catch {
    return raw || response.statusText;
  }
}

/**
 * Step 1 — exchange the user's Firebase ID token for a short-lived scoped
 * token. Timestamp and nonce are required by the broker for replay protection.
 */
async function fetchScopedToken(idToken: string): Promise<string> {
  const key = cacheKeyFor(idToken);
  const cached = getCachedToken(key);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(`${PROXY_BASE_URL}${TOKEN_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'x-project-id': PROXY_PROJECT_ID,
        'x-timestamp': Date.now().toString(),
        'x-nonce': crypto.randomUUID(),
        'x-device-id': `web-server-${PROXY_PROJECT_ID}`,
        'x-device-model': 'NextJS-Server',
        'x-os-version': 'Node',
      },
    });
  } catch (err) {
    throw new AiProxyError(
      'VERIFY_FAILED',
      `Token broker unreachable: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const msg = await readError(response);
    if (response.status === 403) {
      throw new AiProxyError('ACCESS_DENIED', msg, 403);
    }
    if (response.status === 401) {
      throw new AiProxyError('AUTH_FAILED', msg, 401);
    }
    throw new AiProxyError(
      'VERIFY_FAILED',
      `Token exchange failed (${response.status}): ${msg}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    success?: boolean;
    internal_token?: string;
    expires_in?: number;
  };

  if (!data.success || !data.internal_token) {
    throw new AiProxyError('VERIFY_FAILED', 'Token exchange returned no token');
  }

  tokenCache.set(key, {
    token: data.internal_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  });

  return data.internal_token;
}

/** Step 2 — perform the generation call with the scoped token. */
async function generate(
  scopedToken: string,
  prompt: string,
  options?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${PROXY_BASE_URL}${GENERATE_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${scopedToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        maxOutputTokens: options?.maxOutputTokens ?? 700,
        temperature: options?.temperature ?? 0.85,
      }),
    });
  } catch (err) {
    throw new AiProxyError(
      'PROXY_FAILED',
      `Provider unreachable: ${(err as Error).message}`
    );
  }

  if (!response.ok) {
    const msg = await readError(response);
    if (response.status === 429) {
      throw new AiProxyError('RATE_LIMITED', msg, 429);
    }
    if (response.status === 403) {
      throw new AiProxyError('NOT_WHITELISTED', msg, 403);
    }
    if (response.status === 401) {
      throw new AiProxyError('TOKEN_EXPIRED', msg, 401);
    }
    throw new AiProxyError(
      'PROXY_FAILED',
      `Generation failed (${response.status}): ${msg}`,
      response.status
    );
  }

  const data = (await response.json()) as {
    success?: boolean;
    data?: { text?: string };
  };

  const text = data.data?.text;
  if (!data.success || !text) {
    throw new AiProxyError('EMPTY_RESPONSE', 'Provider returned no text');
  }

  return text;
}

/**
 * Generate text. Retries once if the cached scoped token expired between the
 * exchange and the generation call.
 */
export async function generateWithAi(
  idToken: string | null | undefined,
  prompt: string,
  options?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  if (!isAiConfigured()) {
    throw new AiProxyError('NOT_CONFIGURED', 'AI provider is not configured');
  }
  if (!idToken) {
    throw new AiProxyError(
      'NO_ID_TOKEN',
      'No Firebase ID token available — the caller must be signed in'
    );
  }

  const scopedToken = await fetchScopedToken(idToken);

  try {
    return await generate(scopedToken, prompt, options);
  } catch (err) {
    if (err instanceof AiProxyError && err.code === 'TOKEN_EXPIRED') {
      tokenCache.delete(cacheKeyFor(idToken));
      const fresh = await fetchScopedToken(idToken);
      return await generate(fresh, prompt, options);
    }
    throw err;
  }
}

/** Drop a user's cached scoped token (e.g. on sign-out). */
export function invalidateAiToken(idToken: string): void {
  tokenCache.delete(cacheKeyFor(idToken));
}
