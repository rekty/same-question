// Pure text agreement maths. No network, no model, so the same answers always
// group the same way and the tests can pin the behaviour.

const STOP = new Set(`a about above after again against all am an and any are as at be because been
before being below between both but by can cannot could did do does doing down during each few for
from further had has have having he her here hers herself him himself his how i if in into is it its
itself just me more most my myself no nor not now of off on once only or other our ours ourselves out
over own same she should so some such than that the their theirs them themselves then there these
they this those through to too under until up very was we were what when where which while who whom
why will with would you your yours yourself yourselves`.split(/\s+/));

export function tokenize(text) {
  const out = [];
  for (const raw of String(text || "").toLowerCase().split(/[^a-z0-9']+/)) {
    const word = raw.replace(/'s$/, "").replace(/^'+|'+$/g, "");
    if (word.length < 3 || STOP.has(word)) continue;
    out.push(word);
  }
  return out;
}

export function jaccard(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

// Union-find over the pairwise scores. Answers join a camp when they overlap at
// least `threshold` of their vocabulary, so a camp means "says the same things",
// not "uses the same length".
export function group(answers, { threshold = 0.22 } = {}) {
  const list = answers.filter((a) => a && a.ok);
  const parent = list.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const pairs = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const score = jaccard(list[i].text, list[j].text);
      pairs.push({ i, j, score });
      if (score >= threshold) union(i, j);
    }
  }
  const buckets = new Map();
  list.forEach((answer, i) => {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(answer);
  });
  const camps = [...buckets.values()].sort((a, b) => b.length - a.length);
  const mean = pairs.length ? pairs.reduce((sum, p) => sum + p.score, 0) / pairs.length : 0;
  return { camps, pairs, mean, size: list.length };
}

// One line describing the shape of the result, used above the camps.
export function verdict({ camps, mean, size }) {
  if (size < 2) return "Ask at least two models to compare them.";
  if (camps.length === 1) return `All ${size} answers land in one camp (overlap ${(mean * 100) | 0}%).`;
  const biggest = camps[0].length;
  return `${camps.length} camps across ${size} answers; the largest holds ${biggest} (mean overlap ${(mean * 100) | 0}%).`;
}

export function campsFromLabels(answers, labels) {
  const buckets = new Map();
  answers.forEach((answer, i) => {
    if (!answer || !answer.ok) return;
    const label = (labels?.[i] || "unlabelled").trim().toLowerCase() || "unlabelled";
    if (!buckets.has(label)) buckets.set(label, []);
    buckets.get(label).push(answer);
  });
  return [...buckets.entries()]
    .map(([label, items]) => ({ label, items }))
    .sort((a, b) => b.items.length - a.items.length);
}
