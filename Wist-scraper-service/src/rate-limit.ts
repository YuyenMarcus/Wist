/**
 * Sliding-window limiter per scrape URL.
 *
 * IMPORTANT: Do NOT key only by client IP. When Next.js/Vercel calls this service,
 * every request shares the same outbound IP — that made one global bucket per domain
 * and caused false "Rate limit exceeded" for all users.
 */
interface WindowState {
  hits: number[];
}

const store = new Map<string, WindowState>();

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_PER_WINDOW) || 45;

function prune(key: string, now: number) {
  const state = store.get(key);
  if (!state) return;
  state.hits = state.hits.filter((t) => now - t < WINDOW_MS);
  if (state.hits.length === 0) store.delete(key);
}

export function checkRateLimit(url: string): { allowed: boolean; retryAfter?: number } {
  const key = url.trim();
  const now = Date.now();
  prune(key, now);

  let state = store.get(key);
  if (!state) {
    state = { hits: [] };
    store.set(key, state);
  }

  state.hits = state.hits.filter((t) => now - t < WINDOW_MS);

  if (state.hits.length >= MAX_REQUESTS) {
    const oldest = state.hits[0];
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    return { allowed: false, retryAfter };
  }

  state.hits.push(now);
  return { allowed: true };
}

export function clearRateLimit(url: string): void {
  store.delete(url.trim());
}

setInterval(() => {
  const now = Date.now();
  for (const key of [...store.keys()]) {
    prune(key, now);
  }
}, 120_000);
