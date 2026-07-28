export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_RETRIES = 2;
const DEFAULT_BASE_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Retries a flaky async call with exponential backoff + jitter. Store
 * search/lookup calls (iTunes fetch, google-play-scraper) hit rate limits
 * and transient network blips often enough in practice that one failed
 * attempt shouldn't fail an entire daily tracking pass. Not retried forever
 * by default - `shouldRetry` lets callers skip retrying genuinely
 * non-transient errors (e.g. a 404) so those still fail fast. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = DEFAULT_RETRIES, baseDelayMs = DEFAULT_BASE_DELAY_MS, shouldRetry = () => true } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (attempt === retries || !shouldRetry(e)) throw e;
      const backoff = baseDelayMs * 2 ** attempt;
      const jitter = Math.random() * baseDelayMs;
      await sleep(backoff + jitter);
    }
  }
  throw lastError;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** 429 (rate limited) and 5xx (transient server error) are worth retrying;
 * other 4xx statuses (bad request, not found, etc.) won't succeed on retry. */
export function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
