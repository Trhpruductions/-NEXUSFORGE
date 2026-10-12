/**
 * Message polls: rules shared by the routes and tests (no database here).
 * The message's content is the question; the poll holds the answers and votes.
 */
import { randomUUID } from "node:crypto";

export const POLL_MAX_OPTIONS = 10;
export const POLL_MIN_OPTIONS = 2;
export const POLL_OPTION_MAX = 55;
export const POLL_QUESTION_MAX = 300;
/** Same choices as Discord. */
export const POLL_DURATIONS_HOURS = [1, 4, 8, 24, 72, 168] as const;

export type PollOption = { id: string; text: string };

/** Trim, drop blanks and case-insensitive duplicates, and give each answer an id. */
export function buildPollOptions(texts: string[]): PollOption[] | { error: string } {
  const seen = new Set<string>();
  const options: PollOption[] = [];
  for (const raw of texts) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text) continue;
    if (text.length > POLL_OPTION_MAX) return { error: `Answers can be up to ${POLL_OPTION_MAX} characters` };
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ id: randomUUID().slice(0, 8), text });
  }
  if (options.length < POLL_MIN_OPTIONS) return { error: `A poll needs at least ${POLL_MIN_OPTIONS} different answers` };
  if (options.length > POLL_MAX_OPTIONS) return { error: `A poll can have up to ${POLL_MAX_OPTIONS} answers` };
  return options;
}

export function isPollOpen(poll: { endsAt: Date; closedAt: Date | null }, now = new Date()) {
  return !poll.closedAt && poll.endsAt.getTime() > now.getTime();
}

/** Check a vote: answers must exist, and single-choice polls take at most one. Empty = remove your vote. */
export function validateVote(poll: { options: PollOption[]; allowMultiple: boolean }, optionIds: string[]): string[] | { error: string } {
  const unique = [...new Set(optionIds)];
  const valid = new Set(poll.options.map((option) => option.id));
  if (unique.some((id) => !valid.has(id))) return { error: "That answer isn't in this poll" };
  if (!poll.allowMultiple && unique.length > 1) return { error: "This poll only allows one answer" };
  return unique;
}

/** Votes per answer and how many people voted (one person can pick several answers). */
export function tallyPoll(options: PollOption[], votes: Array<{ optionId: string; userId: string }>) {
  const counts = Object.fromEntries(options.map((option) => [option.id, 0])) as Record<string, number>;
  const voters = new Set<string>();
  for (const vote of votes) {
    if (vote.optionId in counts) {
      counts[vote.optionId] += 1;
      voters.add(vote.userId);
    }
  }
  return { counts, voters: voters.size };
}
