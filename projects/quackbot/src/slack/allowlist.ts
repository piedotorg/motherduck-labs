/**
 * Optional user allowlist, mirroring the QUACKBOT_DATABASES pattern:
 * `QUACKBOT_ALLOWED_USERS` env (comma-separated Slack user IDs, e.g.
 * "U111,U222"). Empty/unset ⇒ no restriction (upstream behavior unchanged).
 *
 * When set it is a hard cap on WHO can talk to the bot — every surface
 * (channel @mention, DM, assistant thread) funnels through handlers.ts
 * `handle()`, which consults this before doing anything else. A message
 * with no user id fails closed: the manifest grants workspace-wide DM
 * access (`message.im`), so an unattributable message must not reach the
 * warehouse-querying loop.
 */
export function allowedUser(userId: string | undefined): boolean {
  const raw = (process.env.QUACKBOT_ALLOWED_USERS ?? '').trim();
  if (!raw) return true;
  if (!userId) return false;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId);
}
