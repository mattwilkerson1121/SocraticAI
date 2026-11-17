import { describe, expect, it } from 'vitest';
import {
  RECENT_CONTEXT_LIMIT,
  chronologicalFromNewestFirst,
  type ConversationTurn,
} from './recent-messages';

function turn(n: number, role: ConversationTurn['role'] = n % 2 === 1 ? 'user' : 'assistant'): ConversationTurn {
  return { role, content: `m${n}` };
}

/**
 * The previous query ordered ascending and limited to 10, then kept the last 5.
 * That is the oldest page, not the latest turns.
 */
function legacyWindow(chronological: ConversationTurn[]): ConversationTurn[] {
  return chronological.slice(0, 10).slice(-RECENT_CONTEXT_LIMIT);
}

function currentWindow(chronological: ConversationTurn[]): ConversationTurn[] {
  const newestFirst = [...chronological].reverse().slice(0, RECENT_CONTEXT_LIMIT);
  return chronologicalFromNewestFirst(newestFirst);
}

describe('recent conversation window', () => {
  it('restores chronological order after a newest-first fetch', () => {
    expect(
      chronologicalFromNewestFirst([turn(5), turn(4), turn(3)]).map((m) => m.content)
    ).toEqual(['m3', 'm4', 'm5']);
  });

  it('matches the last five turns while the session still fits in one page', () => {
    const chronological = Array.from({ length: 8 }, (_, i) => turn(i + 1));
    expect(currentWindow(chronological).map((m) => m.content)).toEqual([
      'm4',
      'm5',
      'm6',
      'm7',
      'm8',
    ]);
    expect(currentWindow(chronological)).toEqual(legacyWindow(chronological));
  });

  it('keeps the latest turns after the session grows past the old 10-row page', () => {
    const chronological = Array.from({ length: 12 }, (_, i) => turn(i + 1));

    expect(legacyWindow(chronological).map((m) => m.content)).toEqual([
      'm6',
      'm7',
      'm8',
      'm9',
      'm10',
    ]);
    expect(currentWindow(chronological).map((m) => m.content)).toEqual([
      'm8',
      'm9',
      'm10',
      'm11',
      'm12',
    ]);
  });
});
