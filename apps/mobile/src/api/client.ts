export class ApiError extends Error {
  /** HTTP status; 0 for network failures and non-JSON responses. */
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let currentUserId: string | null = null;

export function setUserId(id: string | null): void {
  currentUserId = id;
}

export function getUserId(): string | null {
  return currentUserId;
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Called when an authed request gets a 401 (the saved user_id is no longer valid).
 * Never fires for /auth/* — a wrong password there is an ordinary error.
 */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

const TIMEOUT_MS = 10_000;

function baseUrl(): string {
  // Must stay a literal `process.env.EXPO_PUBLIC_…` access so Expo inlines it at build time.
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(0, 'EXPO_PUBLIC_API_URL is not set (see apps/mobile/.env.example)');
  }
  return url.replace(/\/+$/, '');
}

type RequestOptions = {
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Defaults to true; sends the x-user-id header. */
  auth?: boolean;
};

export async function request<T>(
  method: string,
  path: string,
  { body, query, auth = true }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    if (!currentUserId) {
      throw new ApiError(401, 'Not logged in');
    }
    headers['x-user-id'] = currentUserId;
  }
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) {
      params.append(key, value);
    }
  }
  const qs = params.toString();
  const url = `${baseUrl()}${path}${qs ? `?${qs}` : ''}`;

  // React Native's fetch never times out on its own.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, controller.signal.aborted ? 'Request timed out' : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && auth) {
    unauthorizedHandler?.();
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(res.ok ? 0 : res.status, 'Unexpected response from server');
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message);
  }
  return data as T;
}
