import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { allowedUser } from './allowlist';

describe('allowedUser (optional QUACKBOT_ALLOWED_USERS gate)', () => {
  const original = process.env.QUACKBOT_ALLOWED_USERS;
  afterEach(() => {
    if (original === undefined) delete process.env.QUACKBOT_ALLOWED_USERS;
    else process.env.QUACKBOT_ALLOWED_USERS = original;
  });

  describe('unset / empty ⇒ no restriction (upstream default)', () => {
    beforeEach(() => {
      delete process.env.QUACKBOT_ALLOWED_USERS;
    });

    it('allows any user when unset', () => {
      expect(allowedUser('U123')).toBe(true);
    });

    it('allows a missing user id when unset', () => {
      expect(allowedUser(undefined)).toBe(true);
    });

    it('treats a whitespace-only value as unset', () => {
      process.env.QUACKBOT_ALLOWED_USERS = '   ';
      expect(allowedUser('U123')).toBe(true);
    });
  });

  describe('set ⇒ hard cap', () => {
    beforeEach(() => {
      process.env.QUACKBOT_ALLOWED_USERS = 'U111, U222 ,U333';
    });

    it('allows a listed user (tolerating spaces around ids)', () => {
      expect(allowedUser('U111')).toBe(true);
      expect(allowedUser('U222')).toBe(true);
      expect(allowedUser('U333')).toBe(true);
    });

    it('denies an unlisted user', () => {
      expect(allowedUser('U999')).toBe(false);
    });

    it('fails closed on a missing user id', () => {
      expect(allowedUser(undefined)).toBe(false);
    });

    it('does not substring-match ids', () => {
      expect(allowedUser('U11')).toBe(false);
      expect(allowedUser('U1111')).toBe(false);
    });
  });
});
