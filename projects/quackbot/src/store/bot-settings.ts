import { getPool } from './pg';
import type { ThinkingLevel } from '../core/agentic-loop';

/**
 * Runtime bot settings (DATA0-60): a tiny key/value table (`bot_settings`,
 * migrations/002) edited from the admin dash, layered over env vars.
 *
 * Resolution per key — row present wins, absent row falls back to env, then
 * to the hardcoded default:
 *   prompt_addendum → (none)                    → ''  (no injection)
 *   model           → OPENROUTER_MODEL          → llm-client DEFAULT_MODEL
 *   thinking_level  → QUACKBOT_THINKING_LEVEL   → 'medium' (invalid row value
 *                     behaves as absent)
 *   allowed_users   → QUACKBOT_ALLOWED_USERS    → open. A present row is
 *                     AUTHORITATIVE (env ignored); "*" = explicitly open; an
 *                     empty/whitespace row value behaves as absent so a
 *                     half-saved edit can't silently flip the gate.
 *
 * Reads are cached for 45s with a single-flight refresh, so config edits
 * propagate in under a minute without a per-message Postgres round trip. A
 * failed read keeps the last-known rows (or none) and warns once per failure
 * streak — a down settings table must never take the bot down.
 */

const VALID_THINKING: ReadonlySet<string> = new Set([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
]);

export interface ResolvedBotSettings {
  /** Trimmed operator addendum for the system prompt; '' = none configured. */
  promptAddendum: string;
  /** OpenRouter model id override; undefined = env/default applies. */
  modelOverride?: string;
  /** Validated thinking-level override; undefined = env/default applies. */
  thinkingOverride?: ThinkingLevel;
  /** allowed_users row value (trimmed, non-empty); null = no row → env fallback. */
  allowedUsers: string | null;
}

const CACHE_TTL_MS = 45_000;

let cached: { at: number; rows: Map<string, string> } | null = null;
let inflight: Promise<void> | null = null;
let warnedFailure = false;

/** Test hook: drop the cache so the next read hits (the mocked) Postgres. */
export function resetBotSettingsCache(): void {
  cached = null;
  inflight = null;
  warnedFailure = false;
}

async function refresh(): Promise<void> {
  try {
    const pool = getPool();
    const res = await pool.query<{ key: string; value: string }>(
      'select key, value from bot_settings'
    );
    cached = { at: Date.now(), rows: new Map(res.rows.map((r) => [r.key, r.value])) };
    warnedFailure = false;
  } catch (err) {
    if (!warnedFailure) {
      console.warn(
        `[bot-settings] read failed — using env fallbacks: ${err instanceof Error ? err.message : String(err)}`
      );
      warnedFailure = true;
    }
    // Keep stale rows when we have them, else behave as "no rows". Stamp the
    // clock either way so a down Postgres is retried at most once per TTL.
    cached = { at: Date.now(), rows: cached?.rows ?? new Map() };
  }
}

async function rowsFresh(): Promise<Map<string, string>> {
  if (!cached || Date.now() - cached.at > CACHE_TTL_MS) {
    inflight ??= refresh().finally(() => {
      inflight = null;
    });
    await inflight;
  }
  return (cached as { rows: Map<string, string> }).rows;
}

export async function getResolvedBotSettings(): Promise<ResolvedBotSettings> {
  const rows = await rowsFresh();
  const addendum = (rows.get('prompt_addendum') ?? '').trim();
  const model = (rows.get('model') ?? '').trim();
  const thinkingRaw = (rows.get('thinking_level') ?? '').trim();
  const allowedRaw = (rows.get('allowed_users') ?? '').trim();
  return {
    promptAddendum: addendum,
    modelOverride: model || undefined,
    thinkingOverride: VALID_THINKING.has(thinkingRaw) ? (thinkingRaw as ThinkingLevel) : undefined,
    allowedUsers: allowedRaw || null,
  };
}
