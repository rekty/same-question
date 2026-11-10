import test from "node:test";
import assert from "node:assert/strict";
import { tokenize, jaccard, group, verdict, campsFromLabels } from "../shared/agree.js";

const A = { model: "a", ok: true, text: "Yes. A hot dog is a sandwich because bread surrounds a filling." };
const B = { model: "b", ok: true, text: "Yes, a hot dog is a sandwich: bread on both sides around a filling." };
const C = { model: "c", ok: true, text: "No. A sandwich needs two separate slices of bread, so a hinged bun does not count." };

test("tokenize drops stopwords, keeps content words", () => {
  const words = tokenize("The hot dog is a sandwich because it is bread.");
  assert.ok(words.includes("sandwich"));
  assert.ok(words.includes("bread"));
  assert.ok(!words.includes("the"));
});

test("jaccard is symmetric and bounded", () => {
  const left = "bread surrounds a filling";
  const right = "bread around a filling";
  assert.equal(jaccard(left, right), jaccard(right, left));
  assert.ok(jaccard(left, right) > 0 && jaccard(left, right) <= 1);
  assert.equal(jaccard("", right), 0);
  assert.equal(jaccard(left, left), 1);
});

test("similar answers land in one camp and the odd one out stays alone", () => {
  const result = group([A, B, C]);
  assert.equal(result.size, 3);
  assert.equal(result.camps.length, 2);
  assert.equal(result.camps[0].length, 2);
  assert.equal(result.camps[1].length, 1);
  assert.equal(result.camps[1][0].model, "c");
});

test("nothing groups when every answer is unrelated", () => {
  const result = group([
    { model: "a", ok: true, text: "Volcanoes erupt when pressure from dissolved gas exceeds the rock strength." },
    { model: "b", ok: true, text: "Sourdough rises because wild yeast ferments flour over many hours." },
    { model: "c", ok: true, text: "Interest rates move bond prices in the opposite direction." },
  ]);
  assert.equal(result.camps.length, 3);
  assert.ok(result.mean < 0.3);
});

test("failed answers are ignored, not treated as agreement", () => {
  const result = group([A, { model: "x", ok: false, error: "boom" }, B]);
  assert.equal(result.size, 2);
  assert.equal(result.camps.length, 1);
});

test("verdict describes the shape in words", () => {
  assert.match(verdict(group([A, B, C])), /2 camps across 3 answers/);
  assert.match(verdict(group([A])), /at least two models/);
  assert.match(verdict(group([A, B])), /one camp/);
});

test("judge labels group answers and keep order", () => {
  const answers = [A, C, B, { model: "d", ok: false, error: "x" }];
  const labels = ["yes", "no", "yes", null];
  const camps = campsFromLabels(answers, labels);
  assert.equal(camps.length, 2);
  assert.equal(camps[0].label, "yes");
  assert.equal(camps[0].items.length, 2);
  assert.equal(camps[1].label, "no");
  assert.equal(camps[1].items.length, 1);
});
