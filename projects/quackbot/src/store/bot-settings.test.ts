import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('./pg', () => ({
  getPool: () => ({ query: queryMock }),
}));

import { getResolvedBotSettings, resetBotSettingsCache } from './bot-settings';

const rows = (entries: Array<[string, string]>) => ({
  rows: entries.map(([key, value]) => ({ key, value })),
});

beforeEach(() => {
  queryMock.mockReset();
  resetBotSettingsCache();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getResolvedBotSettings — resolution semantics', () => {
  it('empty table resolves to all fallbacks', async () => {
    queryMock.mockResolvedValueOnce(rows([]));
    const s = await getResolvedBotSettings();
    expect(s).toEqual({
      promptAddendum: '',
      modelOverride: undefined,
      thinkingOverride: undefined,
      allowedUsers: null,
    });
  });

  it('present rows win: addendum trimmed, model and thinking overrides set', async () => {
    queryMock.mockResolvedValueOnce(
      rows([
        ['prompt_addendum', '  Always cite the table you queried.  '],
        ['model', 'openai/gpt-5.6-luna'],
        ['thinking_level', 'high'],
        ['allowed_users', 'U1,U2'],
      ])
    );
    const s = await getResolvedBotSettings();
    expect(s.promptAddendum).toBe('Always cite the table you queried.');
    expect(s.modelOverride).toBe('openai/gpt-5.6-luna');
    expect(s.thinkingOverride).toBe('high');
    expect(s.allowedUsers).toBe('U1,U2');
  });

  it('invalid thinking_level row behaves as absent', async () => {
    queryMock.mockResolvedValueOnce(rows([['thinking_level', 'turbo']]));
    const s = await getResolvedBotSettings();
    expect(s.thinkingOverride).toBeUndefined();
  });

  it('empty/whitespace allowed_users row behaves as absent (no half-saved gate flips)', async () => {
    queryMock.mockResolvedValueOnce(rows([['allowed_users', '   ']]));
    const s = await getResolvedBotSettings();
    expect(s.allowedUsers).toBeNull();
  });

  it('empty model row behaves as absent', async () => {
    queryMock.mockResolvedValueOnce(rows([['model', '  ']]));
    const s = await getResolvedBotSettings();
    expect(s.modelOverride).toBeUndefined();
  });
});

describe('getResolvedBotSettings — caching', () => {
  it('serves repeat reads within the TTL from cache (one query)', async () => {
    queryMock.mockResolvedValue(rows([['model', 'a/b']]));
    await getResolvedBotSettings();
    await getResolvedBotSettings();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('single-flights concurrent cold reads (one query)', async () => {
    let release!: (v: { rows: Array<{ key: string; value: string }> }) => void;
    queryMock.mockReturnValueOnce(new Promise((r) => (release = r)));
    const p1 = getResolvedBotSettings();
    const p2 = getResolvedBotSettings();
    release(rows([]));
    await Promise.all([p1, p2]);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('resetBotSettingsCache forces a fresh read', async () => {
    queryMock.mockResolvedValue(rows([]));
    await getResolvedBotSettings();
    resetBotSettingsCache();
    await getResolvedBotSettings();
    expect(queryMock).toHaveBeenCalledTimes(2);
  });
});

describe('getResolvedBotSettings — failure behavior', () => {
  it('pg failure falls back to env-only behavior and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    queryMock.mockRejectedValueOnce(new Error('connection refused'));
    const s = await getResolvedBotSettings();
    expect(s.allowedUsers).toBeNull();
    expect(s.modelOverride).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    // Within the TTL the failed read is not retried (no query hammering).
    await getResolvedBotSettings();
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('keeps last-known rows when a later refresh fails', async () => {
    vi.useFakeTimers();
    try {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      queryMock.mockResolvedValueOnce(rows([['model', 'a/b']]));
      expect((await getResolvedBotSettings()).modelOverride).toBe('a/b');

      // Expire the TTL, then fail the refresh: stale rows survive + one warn.
      vi.advanceTimersByTime(46_000);
      queryMock.mockRejectedValueOnce(new Error('boom'));
      const s = await getResolvedBotSettings();
      expect(s.modelOverride).toBe('a/b');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
