/**
 * Prior turns sent to the model.
 *
 * PostgREST applies LIMIT after ORDER BY, so ordering created_at ascending
 * and then limiting returns the oldest rows. Callers must query the newest
 * `RECENT_CONTEXT_LIMIT` rows (created_at descending) and pass that page here.
 */
export const RECENT_CONTEXT_LIMIT = 5;

export type ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;
};

export function chronologicalFromNewestFirst(
  newestFirst: readonly ConversationTurn[]
): ConversationTurn[] {
  return [...newestFirst].reverse();
}
