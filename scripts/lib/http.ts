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

/** fetch + JSON, retrying 429 and 5xx with exponential backoff. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { throttle?: Throttle; label?: string } = {},
  retries = 4,
): Promise<T> {
  const { throttle, label = url, ...request } = init;
  for (let attempt = 0; ; attempt++) {
    await throttle?.wait();
    const res = await fetch(url, request);
    if (res.ok) return (await res.json()) as T;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
      continue;
    }
    const body = (await res.text()).slice(0, 300);
    throw new HttpError(res.status, `${label}: HTTP ${res.status} ${body}`);
  }
}
