import { describe, expect, it } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt operator addendum', () => {
  it('omits the operator section when no addendum is configured', () => {
    const prompt = buildSystemPrompt(['zero']);
    expect(prompt).not.toContain('## Operator instructions');
  });

  it('appends a trimmed addendum as a final bounded section', () => {
    const prompt = buildSystemPrompt(['zero'], '  Reply in Portuguese on Fridays.  ');
    expect(prompt.endsWith('Reply in Portuguese on Fridays.')).toBe(true);
    expect(prompt).toContain('## Operator instructions (set by admins');
    // The base prompt is intact ahead of the addendum.
    expect(prompt).toContain('## Turn protocol (non-negotiable)');
  });

  it('treats a whitespace-only addendum as absent', () => {
    expect(buildSystemPrompt(['zero'], '   ')).toBe(buildSystemPrompt(['zero']));
  });
});
