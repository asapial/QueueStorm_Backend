import { env } from "../config/env.js";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "google/gemma-4-31b-it:free";

// ─── Retry Config ─────────────────────────────────────────────────────────────
const MAX_ATTEMPTS = 3;
const TOTAL_TIMEOUT_MS = 30_000;          // 30 s hard deadline for the whole call
const PER_ATTEMPT_TIMEOUT_MS = 12_000;    // 12 s per individual fetch attempt
const BASE_BACKOFF_MS = 1_000;            // 1 s base, doubles each retry

// Errors that are worth retrying (transient)
const RETRYABLE_HTTP_CODES = new Set([429, 500, 502, 503, 504]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableError = (err: unknown): boolean => {
  if (err instanceof Error) {
    // Network-level failures (ECONNRESET, ETIMEDOUT, fetch abort)
    const retryableMessages = ["fetch failed", "aborted", "network", "timeout", "econnreset"];
    return retryableMessages.some((m) =>
      err.message.toLowerCase().includes(m),
    );
  }
  // HTTP errors we tagged with a status code
  if (typeof err === "object" && err !== null && "status" in err) {
    return RETRYABLE_HTTP_CODES.has((err as { status: number }).status);
  }
  return false;
};

// ─── Single Attempt ───────────────────────────────────────────────────────────

const fetchOnce = async (fullPrompt: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`Per-attempt timeout (${PER_ATTEMPT_TIMEOUT_MS}ms) exceeded`)),
    PER_ATTEMPT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.openRouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: fullPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenRouter HTTP error:", response.status, JSON.stringify(err));
      const error = Object.assign(new Error("AI service error"), { status: response.status });
      throw error;
    }

    const result = (await response.json()) as {
      choices: { message: { content: string } }[];
    };

    const content = result.choices[0]?.message?.content;
    if (!content) throw new Error("OpenRouter returned an empty response.");

    return content.trim();
  } finally {
    clearTimeout(timer);
  }
};

// ─── Public API with Retry + 30 s Total Deadline ─────────────────────────────

/**
 * Calls OpenRouter with up to MAX_ATTEMPTS retries.
 * The entire operation is bounded by TOTAL_TIMEOUT_MS (30 seconds).
 * Each individual attempt is bounded by PER_ATTEMPT_TIMEOUT_MS (12 seconds).
 * Retries use exponential back-off (1 s, 2 s) between attempts.
 */
export const chatWithAI = async (fullPrompt: string): Promise<string> => {
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Check total budget before starting the attempt
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      console.error(`[openrouter] Total timeout of ${TOTAL_TIMEOUT_MS}ms exhausted after ${attempt - 1} attempt(s).`);
      break;
    }

    try {
      console.log(`[openrouter] Attempt ${attempt}/${MAX_ATTEMPTS} (${remaining}ms remaining)`);
      const result = await fetchOnce(fullPrompt);
      if (attempt > 1) {
        console.log(`[openrouter] Succeeded on attempt ${attempt}.`);
      }
      return result;
    } catch (err) {
      lastError = err;
      const isLast = attempt === MAX_ATTEMPTS;
      const shouldRetry = !isLast && isRetryableError(err);

      console.error(
        `[openrouter] Attempt ${attempt} failed:`,
        err instanceof Error ? err.message : err,
      );

      if (!shouldRetry) break;

      // Exponential back-off, capped so we don't blow past the deadline
      const backoff = Math.min(
        BASE_BACKOFF_MS * 2 ** (attempt - 1),
        deadline - Date.now() - 1,
      );
      if (backoff > 0) {
        console.log(`[openrouter] Retrying in ${backoff}ms…`);
        await sleep(backoff);
      }
    }
  }

  // All attempts exhausted — throw the last known error
  throw lastError ?? new Error(`AI service failed after ${MAX_ATTEMPTS} attempts within ${TOTAL_TIMEOUT_MS}ms.`);
};
