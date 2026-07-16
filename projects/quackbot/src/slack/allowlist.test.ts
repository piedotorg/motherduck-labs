import { describe, expect, it } from 'vitest';
import { allowedUser } from './allowlist';

describe('allowedUser (pure membership check)', () => {
  describe('open configurations', () => {
    it('allows any user when the list is empty (no restriction configured)', () => {
      expect(allowedUser('U123', '')).toBe(true);
    });

    it('allows a missing user id when the list is empty', () => {
      expect(allowedUser(undefined, '')).toBe(true);
    });

    it('treats a whitespace-only list as open', () => {
      expect(allowedUser('U123', '   ')).toBe(true);
    });

    it('treats "*" as explicitly open', () => {
      expect(allowedUser('U123', '*')).toBe(true);
      expect(allowedUser(undefined, '*')).toBe(true);
    });
  });

  describe('restricted configurations', () => {
    const LIST = 'U111, U222 ,U333';

    it('allows a listed user (tolerating spaces around ids)', () => {
      expect(allowedUser('U111', LIST)).toBe(true);
      expect(allowedUser('U222', LIST)).toBe(true);
      expect(allowedUser('U333', LIST)).toBe(true);
    });

    it('denies an unlisted user', () => {
      expect(allowedUser('U999', LIST)).toBe(false);
    });

    it('fails closed on a missing user id', () => {
      expect(allowedUser(undefined, LIST)).toBe(false);
    });

    it('does not substring-match ids', () => {
      expect(allowedUser('U11', LIST)).toBe(false);
      expect(allowedUser('U1111', LIST)).toBe(false);
    });
  });
});
