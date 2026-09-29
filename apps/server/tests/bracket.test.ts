import test from "node:test";
import assert from "node:assert/strict";
import {
  championOf,
  generateBracket,
  matchCapacities,
  playableMatches,
  settleBracket,
  type Bracket,
} from "../src/lib/bracket.js";

function players(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p${i}`);
}

/**
 * A match where one player is seated, the other seat can never be filled, and no winner
 * has been recorded. A player waiting on a match that is still being played is not a bye.
 */
function unresolvedByes(bracket: Bracket): string[] {
  const capacities = matchCapacities(bracket);
  const bad: string[] = [];
  bracket.rounds.forEach((round, ri) => {
    round.forEach((match, mi) => {
      if (match.winner) return;
      const seatADead = ri === 0 ? !match.a : (capacities[ri - 1][mi * 2] ?? 0) === 0;
      const seatBDead = ri === 0 ? !match.b : (capacities[ri - 1][mi * 2 + 1] ?? 0) === 0;
      if ((seatBDead && match.a) || (seatADead && match.b)) bad.push(`r${ri}m${mi}`);
    });
  });
  return bad;
}

/** Play a bracket to completion, only ever reporting matches that have two real players. */
function playOut(bracket: Bracket): { champion: string | null; reported: number } {
  let reported = 0;
  for (let guard = 0; guard < 200; guard += 1) {
    const champion = championOf(bracket);
    if (champion) return { champion, reported };
    const next = playableMatches(bracket)[0];
    if (!next) return { champion: null, reported };
    const match = bracket.rounds[next.round][next.match];
    match.winner = match.a;
    settleBracket(bracket);
    reported += 1;
  }
  return { champion: championOf(bracket), reported };
}

test("bracket rounds size up to the next power of two", () => {
  assert.equal(generateBracket(players(2)).rounds.length, 1);
  assert.equal(generateBracket(players(4)).rounds.length, 2);
  assert.equal(generateBracket(players(5)).rounds.length, 3);
  assert.equal(generateBracket(players(16)).rounds.length, 4);
  assert.equal(generateBracket(players(5)).rounds[0].length, 4);
});

test("every entrant appears exactly once in the opening round", () => {
  for (const count of [2, 3, 5, 6, 7, 9, 13]) {
    const bracket = generateBracket(players(count));
    const seats = bracket.rounds[0].flatMap((match) => [match.a, match.b]).filter(Boolean);
    assert.equal(seats.length, count, `count ${count}`);
    assert.equal(new Set(seats).size, count, `count ${count} had duplicates`);
  }
});

test("no bye is left unresolved at generation, for any entrant count", () => {
  for (let count = 2; count <= 33; count += 1) {
    const bracket = generateBracket(players(count));
    assert.deepEqual(unresolvedByes(bracket), [], `entrant count ${count} stranded a bye`);
  }
});

test("a five player bracket advances the bye into the final without a phantom match", () => {
  // Fixed seeding so the shape is deterministic: p4 draws the bye side of the draw.
  const bracket: Bracket = {
    generatedAt: new Date().toISOString(),
    rounds: [
      [
        { a: "p0", b: "p1", winner: null },
        { a: "p2", b: "p3", winner: null },
        { a: "p4", b: null, winner: "p4" },
        { a: null, b: null, winner: null },
      ],
      [
        { a: null, b: null, winner: null },
        { a: "p4", b: null, winner: null },
      ],
      [{ a: null, b: null, winner: null }],
    ],
  };
  settleBracket(bracket);
  assert.equal(bracket.rounds[1][1].winner, "p4", "p4 should advance on the bye");
  assert.equal(bracket.rounds[2][0].b, "p4", "p4 should already be seated in the final");
  assert.deepEqual(unresolvedByes(bracket), []);
});

test("every entrant count plays to a champion using only two player matches", () => {
  for (let count = 2; count <= 33; count += 1) {
    const bracket = generateBracket(players(count));
    const { champion, reported } = playOut(bracket);
    assert.ok(champion, `entrant count ${count} never crowned a champion`);
    // A single-elimination bracket needs exactly one real match per eliminated entrant.
    assert.equal(reported, count - 1, `entrant count ${count} played ${reported} matches`);
  }
});

test("capacities count the entrants that can reach each match", () => {
  const bracket = generateBracket(players(5));
  const capacities = matchCapacities(bracket);
  assert.equal(capacities[0].reduce((sum, value) => sum + value, 0), 5);
  assert.equal(capacities[capacities.length - 1][0], 5, "the final is reachable by everyone");
  assert.ok(capacities[1].includes(1), "a five player draw has a bye in the second round");
});

test("settleBracket is idempotent", () => {
  const bracket = generateBracket(players(11));
  const once = JSON.stringify(settleBracket(bracket));
  const twice = JSON.stringify(settleBracket(bracket));
  assert.equal(once, twice);
});

test("playableMatches never offers a match with an empty seat", () => {
  for (let count = 2; count <= 20; count += 1) {
    const bracket = generateBracket(players(count));
    for (const { round, match } of playableMatches(bracket)) {
      const entry = bracket.rounds[round][match];
      assert.ok(entry.a && entry.b, `entrant count ${count} offered r${round}m${match} with an empty seat`);
    }
  }
});

test("championOf stays null until the final is decided", () => {
  const bracket = generateBracket(players(4));
  assert.equal(championOf(bracket), null);
  const { champion } = playOut(bracket);
  assert.equal(champion, bracket.rounds[1][0].winner);
});
