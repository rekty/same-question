import test from "node:test";
import assert from "node:assert/strict";
import { shuffle, letter, tally, mergeVote, votesFrom } from "../shared/blind.js";

test("shuffle keeps every item and does not mutate the input", () => {
  const input = ["a", "b", "c", "d", "e"];
  const out = shuffle(input);
  assert.deepEqual(input, ["a", "b", "c", "d", "e"]);
  assert.deepEqual([...out].sort(), [...input].sort());
});

test("shuffle is deterministic when the source of randomness is fixed", () => {
  const seeded = () => {
    let s = 42;
    return () => {
      s = (s * 1103515245 + 12345) % 2147483648;
      return s / 2147483648;
    };
  };
  const a = shuffle([1, 2, 3, 4, 5, 6], seeded());
  const b = shuffle([1, 2, 3, 4, 5, 6], seeded());
  assert.deepEqual(a, b);
});

test("letters walk A..F", () => {
  assert.deepEqual([0, 1, 5, 25].map(letter), ["A", "B", "F", "Z"]);
});

test("tally counts votes, sorts by count and breaks ties by name", () => {
  const { rows, total } = tally(["meta", "meta", "openai", "deepseek", "deepseek"]);
  assert.equal(total, 5);
  assert.deepEqual(rows.map((r) => [r.model, r.count]), [
    ["deepseek", 2],
    ["meta", 2],
    ["openai", 1],
  ]);
  assert.equal(Math.round(rows[0].share * 100), 40);
});

test("an empty tally is empty rather than NaN", () => {
  const { rows, total } = tally([]);
  assert.equal(total, 0);
  assert.deepEqual(rows, []);
  assert.equal(tally().total, 0);
});

test("votes survive a store round trip", () => {
  let store = {};
  store = mergeVote(store, "meta");
  store = mergeVote(store, "meta");
  store = mergeVote(store, "xai");
  assert.deepEqual(store, { meta: 2, xai: 1 });
  assert.deepEqual(votesFrom(store), ["meta", "meta", "xai"]);
  assert.equal(votesFrom({ bogus: "nope" }).length, 0);
});
