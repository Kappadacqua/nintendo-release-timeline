const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Spaces out request starts to respect per-second rate limits. */
export class Throttle {
  private next = 0;
  constructor(private readonly minIntervalMs: number) {}

  async wait() {
    const now = Date.now();
    const at = Math.max(now, this.next);
    this.next = at + this.minIntervalMs;
    if (at > now) await sleep(at - now);
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const TIMEOUT_MS = 30_000;
/** Longest wait accepted from a Retry-After header. */
const MAX_RETRY_WAIT_MS = 60_000;

type Init = RequestInit & {
  throttle?: Throttle;
  label?: string;
  /** false: a 429 fails at once (a daily quota, where waiting a few seconds does not help). */
  retry429?: boolean;
};

/** fetchText + JSON. */
export async function fetchJson<T>(url: string, init: Init = {}, retries = 4): Promise<T> {
  const text = await fetchText(url, init, retries);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${init.label ?? url}: invalid JSON ${text.slice(0, 300)}`);
  }
}

/**
 * fetch + body text, retrying 429, 5xx and network errors (timeouts included) with
 * exponential backoff. Every error message starts with the label.
 */
export async function fetchText(url: string, init: Init = {}, retries = 4): Promise<string> {
  const { throttle, label = url, retry429 = true, ...request } = init;
  const backoff = (attempt: number) => sleep(1000 * 2 ** attempt);
  for (let attempt = 0; ; attempt++) {
    await throttle?.wait();
    let res: Response;
    try {
      res = await fetch(url, { ...request, signal: request.signal ?? AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      // DNS, connection reset, timeout: fetch rejects without a response.
      if (attempt < retries) {
        await backoff(attempt);
        continue;
      }
      throw new Error(`${label}: ${(err as Error).message}`);
    }
    if (res.ok) return res.text();

    const retryable = (res.status === 429 && retry429) || res.status >= 500;
    if (retryable && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) await sleep(Math.min(retryAfter * 1000, MAX_RETRY_WAIT_MS));
      else await backoff(attempt);
      continue;
    }
    const body = (await res.text()).slice(0, 300);
    throw new HttpError(res.status, `${label}: HTTP ${res.status} ${body}`);
  }
}
