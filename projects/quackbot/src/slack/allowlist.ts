/**
 * User allowlist membership check — pure so it unit-tests without env or pg.
 *
 * `listValue` is the EFFECTIVE allowlist string after resolution by the
 * caller (handlers.ts): the `bot_settings.allowed_users` row when present
 * (authoritative — env ignored), else the `QUACKBOT_ALLOWED_USERS` env var.
 *
 *   empty/whitespace → open (upstream default: no restriction configured)
 *   "*"              → explicitly open
 *   otherwise        → comma-separated Slack user ids; a message with no
 *                      user id fails closed (the manifest grants
 *                      workspace-wide DM access, so an unattributable
 *                      message must not reach the warehouse-querying loop)
 */
export function allowedUser(userId: string | undefined, listValue: string): boolean {
  const raw = (listValue ?? '').trim();
  if (!raw || raw === '*') return true;
  if (!userId) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
