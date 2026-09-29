/**
 * Single-elimination bracket maths.
 *
 * Entrant counts are rarely a power of two, so most brackets contain byes. A bye is a
 * slot that no player can ever fill, and the player facing it must advance on their own
 * rather than waiting for an opponent who is never coming. Byes are resolved wherever
 * they occur, not just in the opening round.
 */

export type BracketMatch = { a: string | null; b: string | null; winner: string | null };
export type Bracket = { rounds: BracketMatch[][]; generatedAt: string };

export function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * How many real entrants can ever reach each match, derived from the opening round.
 * A match with a capacity of one is a bye: whoever arrives there has already won it.
 * Round one never changes after generation, so this is safe to recompute at any time.
 */
export function matchCapacities(bracket: Bracket): number[][] {
  const first = (bracket.rounds[0] ?? []).map((match) => (match.a ? 1 : 0) + (match.b ? 1 : 0));
  const capacities: number[][] = [first];
  for (let round = 1; round < bracket.rounds.length; round += 1) {
    const previous = capacities[round - 1];
    const current: number[] = [];
    for (let match = 0; match < bracket.rounds[round].length; match += 1) {
      current.push((previous[match * 2] ?? 0) + (previous[match * 2 + 1] ?? 0));
    }
    capacities.push(current);
  }
  return capacities;
}

/**
 * Pull every decided winner through to the next round and resolve any bye they land on,
 * repeating until nothing changes. Safe to run on a freshly generated bracket or after a
 * single reported result; it only ever fills in slots that are already determined.
 *
 * A seat is dead when the match feeding it has no entrants anywhere beneath it. Whoever
 * sits opposite a dead seat has nobody to play and advances immediately.
 */
export function settleBracket(bracket: Bracket): Bracket {
  const capacities = matchCapacities(bracket);
  let changed = true;

  while (changed) {
    changed = false;
    for (let round = 1; round < bracket.rounds.length; round += 1) {
      for (let match = 0; match < bracket.rounds[round].length; match += 1) {
        const target = bracket.rounds[round][match];
        const left = bracket.rounds[round - 1][match * 2];
        const right = bracket.rounds[round - 1][match * 2 + 1];

        if (left?.winner && target.a !== left.winner) {
          target.a = left.winner;
          changed = true;
        }
        if (right?.winner && target.b !== right.winner) {
          target.b = right.winner;
          changed = true;
        }

        if (!target.winner) {
          const seatADead = (capacities[round - 1][match * 2] ?? 0) === 0;
          const seatBDead = (capacities[round - 1][match * 2 + 1] ?? 0) === 0;
          const solo = seatBDead && target.a ? target.a : seatADead && target.b ? target.b : null;
          if (solo) {
            target.winner = solo;
            changed = true;
          }
        }
      }
    }
  }

  return bracket;
}

/** Build a seeded single-elimination bracket with every bye already resolved. */
export function generateBracket(userIds: string[]): Bracket {
  const seeded = shuffle(userIds);
  let size = 1;
  while (size < seeded.length) size *= 2;

  const firstRound: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = seeded[i] ?? null;
    const b = seeded[i + 1] ?? null;
    firstRound.push({ a, b, winner: a && !b ? a : !a && b ? b : null });
  }

  const rounds: BracketMatch[][] = [firstRound];
  let current = firstRound;
  while (current.length > 1) {
    const next: BracketMatch[] = [];
    for (let i = 0; i < current.length; i += 2) {
      next.push({ a: current[i]?.winner ?? null, b: current[i + 1]?.winner ?? null, winner: null });
    }
    rounds.push(next);
    current = next;
  }

  return settleBracket({ rounds, generatedAt: new Date().toISOString() });
}

/** The tournament winner, once the final has been decided. */
export function championOf(bracket: Bracket): string | null {
  const finalRound = bracket.rounds[bracket.rounds.length - 1];
  if (!finalRound || finalRound.length !== 1) return null;
  return finalRound[0].winner;
}

/**
 * Matches that still need a result: both players present and no winner yet. A bye is
 * never playable, so it never appears here.
 */
export function playableMatches(bracket: Bracket): Array<{ round: number; match: number }> {
  const playable: Array<{ round: number; match: number }> = [];
  bracket.rounds.forEach((round, roundIndex) => {
    round.forEach((match, matchIndex) => {
      if (!match.winner && match.a && match.b) playable.push({ round: roundIndex, match: matchIndex });
    });
  });
  return playable;
}
